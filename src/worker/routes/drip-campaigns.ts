// Drip Campaign Management API Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { DripCampaign, DripStep, LeadJourney, SMSMessage, EmailMessage } from '../types/database';
import { ApiResponse } from '../types/api';
import { DatabaseService } from '../services/database';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';

// Validation schemas
const createDripCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  trigger_type: z.enum(['meta_lead', 'manual', 'api']),
  steps: z.array(z.object({
    step_number: z.number().min(1).max(20),
    channel: z.enum(['sms', 'email']),
    delay_minutes: z.number().min(0).max(43200), // Max 30 days
    content_template: z.string().max(2000).optional(),
    subject_template: z.string().max(200).optional(),
    sendgrid_template_id: z.string().optional()
  })).min(1).max(20)
});

const updateDripCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  active: z.boolean().optional()
});

const startJourneySchema = z.object({
  leadId: z.string().min(1),
  campaignId: z.string().min(1)
});

export const dripCampaignRoutes = new Hono<{ Bindings: Env }>();

// All routes require authentication
dripCampaignRoutes.use('*', authMiddleware);

// GET /api/drip/campaigns - List all drip campaigns for user
dripCampaignRoutes.get('/campaigns', async (c) => {
  try {
    const user = c.get('user');
    const db = new DatabaseService(c.env.DB);

    const campaigns = await db.getDripCampaignsByUser(user.id);
    
    const response: ApiResponse<DripCampaign[]> = {
      success: true,
      data: campaigns
    };

    return c.json(response);
  } catch (error) {
    console.error('Get drip campaigns error:', error);
    return c.json({
      success: false,
      error: 'Failed to get drip campaigns'
    }, 500);
  }
});

// POST /api/drip/campaigns - Create new drip campaign
dripCampaignRoutes.post('/campaigns', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validated = createDripCampaignSchema.parse(body);

    const db = new DatabaseService(c.env.DB);
    const campaignId = await generateId();
    const now = Date.now();

    // Create campaign
    const campaign: DripCampaign = {
      id: campaignId,
      name: validated.name,
      description: validated.description,
      trigger_type: validated.trigger_type,
      total_steps: validated.steps.length,
      active: false, // Start as inactive
      created_by: user.id,
      created_at: now,
      updated_at: now
    };

    await db.createDripCampaign(campaign);

    // Create steps
    for (const stepData of validated.steps) {
      const stepId = await generateId();
      const step: DripStep = {
        id: stepId,
        campaign_id: campaignId,
        step_number: stepData.step_number,
        channel: stepData.channel,
        delay_minutes: stepData.delay_minutes,
        content_template: stepData.content_template,
        subject_template: stepData.subject_template,
        sendgrid_template_id: stepData.sendgrid_template_id,
        active: true,
        created_at: now
      };

      await db.createDripStep(step);
    }

    const response: ApiResponse<DripCampaign> = {
      success: true,
      data: campaign
    };

    return c.json(response, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, 400);
    }

    console.error('Create drip campaign error:', error);
    return c.json({
      success: false,
      error: 'Failed to create drip campaign'
    }, 500);
  }
});

// GET /api/drip/campaigns/:id - Get specific drip campaign with steps
dripCampaignRoutes.get('/campaigns/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const db = new DatabaseService(c.env.DB);

    const campaign = await db.getDripCampaignById(campaignId);
    if (!campaign) {
      return c.json({
        success: false,
        error: 'Campaign not found'
      }, 404);
    }

    // Verify ownership
    if (campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, 403);
    }

    const steps = await db.getDripStepsByCampaign(campaignId);

    const response: ApiResponse<{ campaign: DripCampaign; steps: DripStep[] }> = {
      success: true,
      data: {
        campaign,
        steps
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Get drip campaign error:', error);
    return c.json({
      success: false,
      error: 'Failed to get drip campaign'
    }, 500);
  }
});

// PUT /api/drip/campaigns/:id - Update drip campaign
dripCampaignRoutes.put('/campaigns/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const body = await c.req.json();
    const validated = updateDripCampaignSchema.parse(body);

    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getDripCampaignById(campaignId);

    if (!campaign) {
      return c.json({
        success: false,
        error: 'Campaign not found'
      }, 404);
    }

    if (campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, 403);
    }

    await db.updateDripCampaign(campaignId, {
      ...validated,
      updated_at: Date.now()
    });

    const updatedCampaign = await db.getDripCampaignById(campaignId);

    const response: ApiResponse<DripCampaign> = {
      success: true,
      data: updatedCampaign!
    };

    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, 400);
    }

    console.error('Update drip campaign error:', error);
    return c.json({
      success: false,
      error: 'Failed to update drip campaign'
    }, 500);
  }
});

// DELETE /api/drip/campaigns/:id - Delete drip campaign
dripCampaignRoutes.delete('/campaigns/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const db = new DatabaseService(c.env.DB);

    const campaign = await db.getDripCampaignById(campaignId);
    if (!campaign) {
      return c.json({
        success: false,
        error: 'Campaign not found'
      }, 404);
    }

    if (campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, 403);
    }

    // Check if campaign has active journeys
    const activeJourneys = await db.getActiveJourneysByCampaign(campaignId);
    if (activeJourneys.length > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete campaign with active journeys'
      }, 400);
    }

    await db.deleteDripCampaign(campaignId);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true }
    };

    return c.json(response);
  } catch (error) {
    console.error('Delete drip campaign error:', error);
    return c.json({
      success: false,
      error: 'Failed to delete drip campaign'
    }, 500);
  }
});

// POST /api/drip/campaigns/:id/activate - Activate/deactivate campaign
dripCampaignRoutes.post('/campaigns/:id/activate', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const { active } = await c.req.json();

    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getDripCampaignById(campaignId);

    if (!campaign) {
      return c.json({
        success: false,
        error: 'Campaign not found'
      }, 404);
    }

    if (campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, 403);
    }

    await db.updateDripCampaign(campaignId, {
      active: active,
      updated_at: Date.now()
    });

    const response: ApiResponse<{ active: boolean }> = {
      success: true,
      data: { active }
    };

    return c.json(response);
  } catch (error) {
    console.error('Toggle drip campaign error:', error);
    return c.json({
      success: false,
      error: 'Failed to toggle drip campaign'
    }, 500);
  }
});

// POST /api/drip/journeys/start - Start a new journey for a lead
dripCampaignRoutes.post('/journeys/start', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validated = startJourneySchema.parse(body);

    const db = new DatabaseService(c.env.DB);
    
    // Verify campaign exists and is owned by user
    const campaign = await db.getDripCampaignById(validated.campaignId);
    if (!campaign || campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Campaign not found or access denied'
      }, 404);
    }

    // Verify lead exists
    const lead = await db.getLeadById(validated.leadId);
    if (!lead) {
      return c.json({
        success: false,
        error: 'Lead not found'
      }, 404);
    }

    // Check if journey already exists
    const existingJourney = await db.getJourneyByLeadAndCampaign(validated.leadId, validated.campaignId);
    if (existingJourney) {
      return c.json({
        success: false,
        error: 'Journey already exists for this lead and campaign'
      }, 400);
    }

    // Create journey
    const journeyId = await generateId();
    const now = Date.now();

    const journey: LeadJourney = {
      id: journeyId,
      lead_id: validated.leadId,
      campaign_id: validated.campaignId,
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

    // Queue first step
    await queueNextStep(journey, c.env);

    const response: ApiResponse<LeadJourney> = {
      success: true,
      data: journey
    };

    return c.json(response, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, 400);
    }

    console.error('Start journey error:', error);
    return c.json({
      success: false,
      error: 'Failed to start journey'
    }, 500);
  }
});

// GET /api/drip/journeys - List journeys for user
dripCampaignRoutes.get('/journeys', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status');

    const db = new DatabaseService(c.env.DB);
    const journeys = await db.getJourneysByUser(user.id, limit, offset, status);

    const response: ApiResponse<LeadJourney[]> = {
      success: true,
      data: journeys
    };

    return c.json(response);
  } catch (error) {
    console.error('Get journeys error:', error);
    return c.json({
      success: false,
      error: 'Failed to get journeys'
    }, 500);
  }
});

// GET /api/drip/campaigns/:id/analytics - Get campaign analytics
dripCampaignRoutes.get('/campaigns/:id/analytics', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const db = new DatabaseService(c.env.DB);

    const campaign = await db.getDripCampaignById(campaignId);
    if (!campaign || campaign.created_by !== user.id) {
      return c.json({
        success: false,
        error: 'Campaign not found or access denied'
      }, 404);
    }

    const analytics = await db.getDripCampaignAnalytics(campaignId);

    const response: ApiResponse<any> = {
      success: true,
      data: analytics
    };

    return c.json(response);
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    return c.json({
      success: false,
      error: 'Failed to get campaign analytics'
    }, 500);
  }
});

// Helper function to queue next step in journey
async function queueNextStep(journey: LeadJourney, env: Env): Promise<void> {
  const db = new DatabaseService(env.DB);
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

    const smsMessage: SMSMessage = {
      id: messageId,
      lead_id: lead.id,
      drip_step_id: step.id,
      to_number: lead.phone,
      from_number: env.TWILIO_PHONE_NUMBER || '',
      content: step.content_template || 'Thank you for your interest!',
      status: 'pending',
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

    const emailMessage: EmailMessage = {
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
      status: 'pending',
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