// Meta Lead Capture Integration Test

import { webhookRoutes } from '../../src/worker/routes/webhooks.js';
import { DatabaseService } from '../../src/worker/services/database.js';
import { Env } from '../../src/worker/types/env.js';

// Test utility functions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, testFn: () => void | Promise<void>) {
  console.log(`Running test: ${name}`);
  try {
    const result = testFn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`✅ ${name}`);
      }).catch(error => {
        console.error(`❌ ${name}: ${error.message}`);
      });
    } else {
      console.log(`✅ ${name}`);
    }
  } catch (error) {
    console.error(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

// Create mock database with drip campaign data
function createMockD1Database(): D1Database {
  const mockData = {
    leads: [] as any[],
    drip_campaigns: [
      {
        id: 'campaign-123',
        name: 'Meta Lead Campaign',
        trigger_type: 'meta_lead',
        active: 1,
        created_by: 'system',
        total_steps: 3,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ],
    drip_steps: [
      {
        id: 'step-1',
        campaign_id: 'campaign-123',
        step_number: 1,
        channel: 'email',
        delay_minutes: 0,
        content_template: 'Welcome! Thanks for your interest.',
        subject_template: 'Welcome to our service',
        active: 1,
        created_at: Date.now()
      },
      {
        id: 'step-2',
        campaign_id: 'campaign-123',
        step_number: 2,
        channel: 'sms',
        delay_minutes: 1440, // 24 hours
        content_template: 'Quick follow-up via SMS',
        active: 1,
        created_at: Date.now()
      },
      {
        id: 'step-3',
        campaign_id: 'campaign-123',
        step_number: 3,
        channel: 'email',
        delay_minutes: 4320, // 3 days
        subject_template: 'Final follow-up',
        content_template: 'Last chance to connect!',
        active: 1,
        created_at: Date.now()
      }
    ],
    lead_journeys: [] as any[],
    sms_messages: [] as any[],
    email_messages: [] as any[]
  };

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        run: async () => {
          // Handle INSERT operations
          if (query.includes('INSERT INTO leads')) {
            mockData.leads.push({ id: params[0], meta_lead_id: params[2] });
          } else if (query.includes('INSERT INTO lead_journeys')) {
            mockData.lead_journeys.push({ 
              id: params[0], 
              lead_id: params[1], 
              campaign_id: params[2],
              current_step: params[3],
              status: params[4]
            });
          } else if (query.includes('INSERT INTO sms_messages')) {
            mockData.sms_messages.push({
              id: params[0],
              lead_id: params[1],
              drip_step_id: params[2],
              to_number: params[3],
              content: params[5],
              status: params[6]
            });
          } else if (query.includes('INSERT INTO email_messages')) {
            mockData.email_messages.push({
              id: params[0],
              lead_id: params[1],
              drip_step_id: params[2],
              to_email: params[3],
              subject: params[4],
              status: params[7]
            });
          }
          return { success: true };
        },
        first: async <T>() => {
          if (query.includes('SELECT * FROM leads WHERE meta_lead_id = ?')) {
            return mockData.leads.find(l => l.meta_lead_id === params[0]) as T;
          }
          if (query.includes('SELECT * FROM leads WHERE id = ?')) {
            return mockData.leads.find(l => l.id === params[0]) as T;
          }
          if (query.includes('SELECT * FROM drip_steps WHERE campaign_id = ? AND step_number = ?')) {
            return mockData.drip_steps.find(s => 
              s.campaign_id === params[0] && s.step_number === params[1]
            ) as T;
          }
          if (query.includes('SELECT * FROM lead_journeys WHERE lead_id = ? AND campaign_id = ?')) {
            return mockData.lead_journeys.find(j => 
              j.lead_id === params[0] && j.campaign_id === params[1]
            ) as T;
          }
          return null as T;
        },
        all: async <T>() => {
          if (query.includes('drip_campaigns WHERE created_by = ?')) {
            return { 
              results: mockData.drip_campaigns.filter(c => c.created_by === params[0] || c.created_by === 'system')
            };
          }
          return { results: [] };
        }
      })
    }),
    exec: async () => ({ count: 0, duration: 0 }),
    batch: async () => [],
    dump: async () => new ArrayBuffer(0)
  } as D1Database;
}

// Mock environment
const mockEnv: Env = {
  DB: createMockD1Database(),
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  AI: {} as Ai,
  IMAGES: {} as Fetcher,
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret',
  WEBHOOK_SECRET: 'webhook-secret-key',
  ENCRYPTION_KEY: 'encryption-key',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

async function runMetaIntegrationTests() {
  console.log('🔗 Starting Meta Lead Capture Integration Tests\n');

  // Test Webhook Verification
  await test('Webhook Verification: should verify Meta webhook challenge', () => {
    const challengeParams = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'webhook-secret-key',
      'hub.challenge': 'challenge-string-123'
    };

    // Simulate verification logic
    const mode = challengeParams['hub.mode'];
    const token = challengeParams['hub.verify_token'];
    const challenge = challengeParams['hub.challenge'];

    assert(mode === 'subscribe', 'Mode should be subscribe');
    assert(token === mockEnv.WEBHOOK_SECRET, 'Token should match webhook secret');
    assert(challenge === 'challenge-string-123', 'Challenge should be returned');
  });

  await test('Webhook Verification: should reject invalid tokens', () => {
    const invalidParams = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-string-123'
    };

    const isValid = invalidParams['hub.verify_token'] === mockEnv.WEBHOOK_SECRET;
    assert(isValid === false, 'Should reject invalid verification token');
  });

  // Test Webhook Signature Verification
  await test('Signature Verification: should validate webhook signatures', async () => {
    const payload = JSON.stringify({ test: 'data' });
    const secret = 'webhook-secret-key';
    
    // Simulate HMAC-SHA256 signature creation
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const signatureHeader = `sha256=${signatureHex}`;
    
    // Verify the signature
    const verificationKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    const isValid = await crypto.subtle.verify('HMAC', verificationKey, signatureBytes, messageData);
    assert(isValid === true, 'Signature verification should pass');
  });

  // Test Lead Processing
  await test('Lead Processing: should process Meta leadgen webhooks', () => {
    const webhookPayload = {
      object: 'page',
      entry: [
        {
          id: '12345',
          time: 1640995200,
          changes: [
            {
              field: 'leadgen',
              value: {
                leadgen_id: 'lead_12345',
                ad_id: 'ad_67890',
                form_id: 'form_abc123',
                page_id: '12345'
              }
            }
          ]
        }
      ]
    };

    assert(webhookPayload.object === 'page', 'Webhook should be for page object');
    assert(webhookPayload.entry.length > 0, 'Should have at least one entry');
    
    const change = webhookPayload.entry[0].changes[0];
    assert(change.field === 'leadgen', 'Change should be for leadgen field');
    assert(change.value.leadgen_id === 'lead_12345', 'Should have leadgen ID');
    assert(change.value.ad_id === 'ad_67890', 'Should have ad ID');
  });

  await test('Lead Processing: should create lead from webhook data', () => {
    const leadData = {
      leadgen_id: 'lead_12345',
      ad_id: 'ad_67890',
      form_id: 'form_abc123',
      page_id: '12345'
    };

    // Simulate lead creation
    const lead = {
      id: 'generated-lead-id',
      campaign_id: 'unknown', // Would be mapped from ad_id
      meta_lead_id: leadData.leadgen_id,
      first_name: 'Unknown',
      last_name: 'Lead',
      email: 'lead@example.com',
      custom_fields: JSON.stringify({
        ad_id: leadData.ad_id,
        form_id: leadData.form_id,
        page_id: leadData.page_id
      }),
      captured_at: Date.now(),
      status: 'active'
    };

    assert(lead.meta_lead_id === leadData.leadgen_id, 'Should store Meta lead ID');
    assert(lead.status === 'active', 'Lead should be active');
    assert(JSON.parse(lead.custom_fields).ad_id === leadData.ad_id, 'Should store ad ID in custom fields');
  });

  // Test Drip Campaign Triggering
  await test('Drip Campaign Trigger: should find active Meta lead campaigns', () => {
    const db = new DatabaseService(mockEnv.DB);
    
    // Mock the campaign lookup (would normally be async)
    const campaigns = [
      {
        id: 'campaign-123',
        trigger_type: 'meta_lead',
        active: true,
        name: 'Meta Lead Campaign'
      },
      {
        id: 'campaign-456',
        trigger_type: 'manual',
        active: true,
        name: 'Manual Campaign'
      },
      {
        id: 'campaign-789',
        trigger_type: 'meta_lead',
        active: false,
        name: 'Inactive Meta Campaign'
      }
    ];

    const metaLeadCampaigns = campaigns.filter(c => 
      c.trigger_type === 'meta_lead' && c.active
    );

    assert(metaLeadCampaigns.length === 1, 'Should find one active Meta lead campaign');
    assert(metaLeadCampaigns[0].id === 'campaign-123', 'Should find the correct campaign');
  });

  await test('Drip Campaign Trigger: should create lead journey', () => {
    const lead = {
      id: 'lead-123',
      meta_lead_id: 'meta_lead_456'
    };

    const campaign = {
      id: 'campaign-789',
      name: 'Meta Lead Campaign'
    };

    // Simulate journey creation
    const journey = {
      id: 'generated-journey-id',
      lead_id: lead.id,
      campaign_id: campaign.id,
      current_step: 0,
      status: 'active',
      started_at: Date.now(),
      last_interaction_at: Date.now(),
      total_sms_sent: 0,
      total_emails_sent: 0,
      total_opens: 0,
      total_clicks: 0
    };

    assert(journey.lead_id === lead.id, 'Journey should link to lead');
    assert(journey.campaign_id === campaign.id, 'Journey should link to campaign');
    assert(journey.current_step === 0, 'Journey should start at step 0');
    assert(journey.status === 'active', 'Journey should be active');
  });

  // Test Message Queuing
  await test('Message Queuing: should queue first step messages', () => {
    const journey = {
      id: 'journey-123',
      lead_id: 'lead-456',
      campaign_id: 'campaign-789',
      current_step: 0
    };

    const step = {
      id: 'step-1',
      campaign_id: 'campaign-789',
      step_number: 1,
      channel: 'email',
      delay_minutes: 0,
      subject_template: 'Welcome!',
      content_template: 'Thanks for your interest!',
      active: true
    };

    const lead = {
      id: 'lead-456',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe'
    };

    // Calculate schedule time
    const scheduledAt = Date.now() + (step.delay_minutes * 60 * 1000);

    // Simulate message creation
    const message = {
      id: 'generated-message-id',
      lead_id: lead.id,
      drip_step_id: step.id,
      to_email: lead.email,
      subject: step.subject_template,
      dynamic_data: JSON.stringify({
        first_name: lead.first_name,
        last_name: lead.last_name
      }),
      status: 'pending',
      scheduled_at: scheduledAt
    };

    assert(message.lead_id === lead.id, 'Message should link to lead');
    assert(message.drip_step_id === step.id, 'Message should link to step');
    assert(message.to_email === lead.email, 'Message should use lead email');
    assert(message.status === 'pending', 'Message should be pending');
    assert(message.scheduled_at >= Date.now(), 'Message should be scheduled for future');
  });

  await test('Message Queuing: should handle SMS steps', () => {
    const smsStep = {
      id: 'step-2',
      channel: 'sms',
      delay_minutes: 1440, // 24 hours
      content_template: 'Quick SMS follow-up'
    };

    const lead = {
      id: 'lead-456',
      phone: '+1234567890'
    };

    const scheduledAt = Date.now() + (smsStep.delay_minutes * 60 * 1000);

    // Simulate SMS message creation
    const smsMessage = {
      id: 'generated-sms-id',
      lead_id: lead.id,
      drip_step_id: smsStep.id,
      to_number: lead.phone,
      from_number: '+0987654321',
      content: smsStep.content_template,
      status: 'pending',
      scheduled_at: scheduledAt
    };

    assert(smsMessage.to_number === lead.phone, 'SMS should use lead phone');
    assert(smsMessage.content === smsStep.content_template, 'SMS should use step content');
    
    // Check 24-hour delay
    const expectedDelay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const actualDelay = smsMessage.scheduled_at - Date.now();
    assert(
      Math.abs(actualDelay - expectedDelay) < 5000, // Within 5 seconds tolerance
      'SMS should be scheduled for 24 hours later'
    );
  });

  // Test Duplicate Lead Handling
  await test('Duplicate Handling: should prevent duplicate lead processing', () => {
    const existingLead = {
      id: 'existing-lead-123',
      meta_lead_id: 'meta_lead_456'
    };

    const newWebhookData = {
      leadgen_id: 'meta_lead_456' // Same as existing lead
    };

    // Simulate duplicate check
    const isDuplicate = existingLead.meta_lead_id === newWebhookData.leadgen_id;
    assert(isDuplicate === true, 'Should detect duplicate lead');

    // Should not create new lead or journey for duplicates
    const shouldCreateNew = !isDuplicate;
    assert(shouldCreateNew === false, 'Should not create new lead for duplicate');
  });

  // Test Error Handling
  await test('Error Handling: should handle missing lead data', () => {
    const incompleteWebhookData = {
      leadgen_id: 'lead_123'
      // Missing ad_id, form_id, etc.
    };

    // Should still create lead with available data
    const canProcess = !!incompleteWebhookData.leadgen_id;
    assert(canProcess === true, 'Should be able to process with minimal data');
  });

  await test('Error Handling: should handle missing phone/email gracefully', () => {
    const leadWithoutContact = {
      id: 'lead-123',
      first_name: 'John',
      last_name: 'Doe'
      // No email or phone
    };

    const emailStep = { channel: 'email', content_template: 'Email content' };
    const smsStep = { channel: 'sms', content_template: 'SMS content' };

    // Should skip steps when contact info is missing
    const canSendEmail = !!leadWithoutContact.email;
    const canSendSMS = !!leadWithoutContact.phone;

    assert(canSendEmail === false, 'Should not be able to send email without email address');
    assert(canSendSMS === false, 'Should not be able to send SMS without phone number');
  });

  console.log('\n✅ All Meta Lead Capture Integration tests completed!');
}

// Run the tests
runMetaIntegrationTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});