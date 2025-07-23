// Webhook routes for Meta lead capture and external integrations

import { Hono } from 'hono';
import { Env } from '../types/env';
import { Lead, LeadJourney } from '../types/database';
import { DatabaseService } from '../services/database';
import { generateId } from '../utils/crypto';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

/**
 * Verify webhook signature for security
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Parse signature (format: sha256=hash)
    const signatureHash = signature.replace('sha256=', '');
    const signatureBytes = new Uint8Array(
      signatureHash.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    return await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// GET /api/webhooks/meta - Webhook verification (required by Meta)
webhookRoutes.get('/meta', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  
  // Verify the token
  if (mode === 'subscribe' && token === c.env.WEBHOOK_SECRET) {
    console.log('Meta webhook verified successfully');
    return c.text(challenge || '');
  }
  
  console.error('Meta webhook verification failed');
  return c.text('Forbidden', 403);
});

// POST /api/webhooks/meta - Meta lead capture webhook
webhookRoutes.post('/meta', async (c) => {
  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header('x-hub-signature-256') || '';
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(rawBody, signature, c.env.WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return c.text('Unauthorized', 401);
    }
    
    // Parse webhook payload
    const payload = JSON.parse(rawBody);
    console.log('Meta webhook received:', JSON.stringify(payload, null, 2));
    
    // Process each entry in the webhook
    if (payload.entry && Array.isArray(payload.entry)) {
      const db = new DatabaseService(c.env.DB);
      
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              await processLeadGenChange(change.value, db, c.env);
            }
          }
        }
      }
    }
    
    // Meta requires a 200 response
    return c.text('OK');
    
  } catch (error) {
    console.error('Meta webhook processing error:', error);
    // Still return 200 to avoid Meta retrying
    return c.text('OK');
  }
});

/**
 * Process Meta leadgen webhook change
 */
async function processLeadGenChange(changeValue: any, db: DatabaseService, env: Env): Promise<void> {
  try {
    if (changeValue.leadgen_id) {
      const leadgenId = changeValue.leadgen_id;
      const adId = changeValue.ad_id;
      const formId = changeValue.form_id;
      const pageId = changeValue.page_id;
      
      console.log(`Processing lead: ${leadgenId} from ad: ${adId}`);
      
      // In a real implementation, you would:
      // 1. Fetch lead details from Meta API using leadgen_id
      // 2. Map the lead to a campaign in your database
      // 3. Store the lead data
      // 4. Trigger any follow-up actions (email, SMS, etc.)
      
      // For now, create a mock lead entry
      const leadId = await generateId();
      const lead: Lead = {
        id: leadId,
        campaign_id: 'unknown', // Would need to map from ad_id to campaign
        meta_lead_id: leadgenId,
        first_name: 'Unknown',
        last_name: 'Lead',
        email: 'lead@example.com',
        phone: undefined,
        company: undefined,
        custom_fields: JSON.stringify({
          ad_id: adId,
          form_id: formId,
          page_id: pageId
        }),
        captured_at: Date.now(),
        status: 'active'
      };
      
      // Check for duplicate leads
      const existingLead = await db.getLeadByMetaId(leadgenId);
      if (!existingLead) {
        await db.createLead(lead);
        console.log(`Lead ${leadgenId} stored successfully`);
        
        // Trigger drip campaign sequence
        await triggerDripCampaign(lead, db, env);
      } else {
        console.log(`Lead ${leadgenId} already exists, skipping`);
      }
    }
  } catch (error) {
    console.error('Lead processing error:', error);
    throw error;
  }
}

// POST /api/webhooks/test - Test webhook endpoint (development only)
webhookRoutes.post('/test', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.text('Not Found', 404);
  }
  
  try {
    const body = await c.req.json();
    
    console.log('Test webhook received:', JSON.stringify(body, null, 2));
    
    // Mock lead data for testing
    const leadId = await generateId();
    const testLead: Lead = {
      id: leadId,
      campaign_id: body.campaignId || 'test-campaign',
      meta_lead_id: `test_${Date.now()}`,
      first_name: body.firstName || 'Test',
      last_name: body.lastName || 'User',
      email: body.email || 'test@example.com',
      phone: body.phone,
      company: body.company,
      custom_fields: JSON.stringify(body.customFields || {}),
      captured_at: Date.now(),
      status: 'active'
    };
    
    const db = new DatabaseService(c.env.DB);
    await db.createLead(testLead);
    
    return c.json({
      success: true,
      message: 'Test lead created',
      leadId: leadId
    });
    
  } catch (error) {
    console.error('Test webhook error:', error);
    return c.json({
      success: false,
      error: 'Failed to process test webhook'
    }, 500);
  }
});

// GET /api/webhooks/health - Webhook health check
webhookRoutes.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    webhooks: {
      meta: {
        endpoint: '/api/webhooks/meta',
        methods: ['GET', 'POST'],
        description: 'Meta lead generation webhook'
      },
      test: {
        endpoint: '/api/webhooks/test',
        methods: ['POST'],
        description: 'Test webhook for development'
      }
    }
  });
});

// POST /api/webhooks/twilio - Twilio SMS status webhook (Phase 3)
webhookRoutes.post('/twilio', async (c) => {
  try {
    const body = await c.req.text();
    console.log('Twilio webhook received:', body);
    
    // Parse Twilio webhook data
    const params = new URLSearchParams(body);
    const messageSid = params.get('MessageSid');
    const messageStatus = params.get('MessageStatus');
    const to = params.get('To');
    const from = params.get('From');
    
    console.log('Twilio status update:', { messageSid, messageStatus, to, from });
    
    // TODO: Update lead interaction status in database
    // This would be implemented in Phase 3
    
    return c.text('OK');
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return c.text('OK');
  }
});

// POST /api/webhooks/sendgrid - SendGrid email event webhook (Phase 3)
webhookRoutes.post('/sendgrid', async (c) => {
  try {
    const events = await c.req.json();
    console.log('SendGrid webhook received:', JSON.stringify(events, null, 2));
    
    // Process email events (delivered, opened, clicked, etc.)
    if (Array.isArray(events)) {
      for (const event of events) {
        // TODO: Update lead interaction status based on email events
        // This would be implemented in Phase 3
        console.log(`Email event: ${event.event} for ${event.email}`);
      }
    }
    
    return c.text('OK');
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return c.text('OK');
  }
});

/**
 * Trigger drip campaign for a new lead
 */
async function triggerDripCampaign(lead: Lead, db: DatabaseService, env: Env): Promise<void> {
  try {
    // Find active drip campaigns that should trigger for Meta leads
    const campaigns = await db.getDripCampaignsByUser('system'); // TODO: Map to actual user ID
    const metaLeadCampaigns = campaigns.filter(c => 
      c.trigger_type === 'meta_lead' && c.active
    );

    if (metaLeadCampaigns.length === 0) {
      console.log('No active Meta lead drip campaigns found');
      return;
    }

    // For now, use the first matching campaign
    // In practice, you might have logic to select the best campaign
    const campaign = metaLeadCampaigns[0];
    
    console.log(`Starting drip campaign ${campaign.id} for lead ${lead.id}`);

    // Check if journey already exists
    const existingJourney = await db.getJourneyByLeadAndCampaign(lead.id, campaign.id);
    if (existingJourney) {
      console.log(`Journey already exists for lead ${lead.id} and campaign ${campaign.id}`);
      return;
    }

    // Create new journey
    const journeyId = await generateId();
    const now = Date.now();

    const journey: LeadJourney = {
      id: journeyId,
      lead_id: lead.id,
      campaign_id: campaign.id,
      current_step: 0,
      status: 'active',
      started_at: now,
      last_interaction_at: now,
      total_sms_sent: 0,
      total_emails_sent: 0,
      total_opens: 0,
      total_clicks: 0,
      created_at: now,
      updated_at: now
    };

    await db.createLeadJourney(journey);
    console.log(`Journey ${journeyId} created for lead ${lead.id}`);

    // Queue first step using the same function from drip-campaigns.ts
    await queueNextStepInJourney(journey, env, db);
    
  } catch (error) {
    console.error('Error triggering drip campaign:', error);
    // Don't throw to avoid breaking webhook processing
  }
}

/**
 * Queue next step in a lead journey (adapted from drip-campaigns.ts)
 */
async function queueNextStepInJourney(journey: LeadJourney, env: Env, db: DatabaseService): Promise<void> {
  const nextStepNumber = journey.current_step + 1;

  // Get next step
  const step = await db.getDripStepByNumber(journey.campaign_id, nextStepNumber);
  if (!step || !step.active) {
    // Journey complete
    await db.updateLeadJourney(journey.id, {
      status: 'completed',
      completed_at: Date.now(),
      updated_at: Date.now()
    });
    return;
  }

  // Get lead information
  const lead = await db.getLeadById(journey.lead_id);
  if (!lead) {
    throw new Error('Lead not found');
  }

  // Calculate send time
  const scheduledAt = Date.now() + (step.delay_minutes * 60 * 1000);
  const messageId = await generateId();

  if (step.channel === 'sms') {
    // Queue SMS
    if (!lead.phone) {
      console.log(`Skipping SMS step for lead ${lead.id} - no phone number`);
      return;
    }

    const smsMessage = {
      id: messageId,
      lead_id: lead.id,
      drip_step_id: step.id,
      to_number: lead.phone,
      from_number: env.TWILIO_PHONE_NUMBER || '',
      content: step.content_template || 'Thank you for your interest!',
      status: 'pending' as const,
      scheduled_at: scheduledAt,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await db.createSMSMessage(smsMessage);
  } else if (step.channel === 'email') {
    // Queue Email
    if (!lead.email) {
      console.log(`Skipping email step for lead ${lead.id} - no email address`);
      return;
    }

    const emailMessage = {
      id: messageId,
      lead_id: lead.id,
      drip_step_id: step.id,
      to_email: lead.email,
      subject: step.subject_template || 'Thank you for your interest!',
      template_id: step.sendgrid_template_id,
      dynamic_data: JSON.stringify({
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company
      }),
      status: 'pending' as const,
      scheduled_at: scheduledAt,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await db.createEmailMessage(emailMessage);
  }

  // Update journey current step
  await db.updateLeadJourney(journey.id, {
    current_step: nextStepNumber,
    updated_at: Date.now()
  });
}