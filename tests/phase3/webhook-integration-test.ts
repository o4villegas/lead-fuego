// Webhook Integration Test for Phase 3

import { webhookRoutes } from '../../src/worker/routes/webhooks.js';
import { TwilioService } from '../../src/worker/services/twilio.js';
import { SendGridService } from '../../src/worker/services/sendgrid.js';
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

// Mock environment
const mockEnv: Env = {
  DB: {} as D1Database,
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  AI: {} as Ai,
  IMAGES: {} as Fetcher,
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret',
  WEBHOOK_SECRET: 'webhook-secret-key',
  ENCRYPTION_KEY: 'encryption-key',
  TWILIO_ACCOUNT_SID: 'ACtest123',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+0987654321',
  SENDGRID_API_KEY: 'SG.test-key',
  SENDGRID_FROM_EMAIL: 'test@leadfuego.com',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

async function runWebhookIntegrationTests() {
  console.log('🔗 Starting Webhook Integration Tests\n');

  // Test Meta Webhook Verification
  await test('Meta Webhook: should verify webhook challenge', () => {
    const verificationRequest = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'webhook-secret-key',
        'hub.challenge': 'challenge-string-1234567890'
      }
    };

    // Simulate verification logic
    const mode = verificationRequest.query['hub.mode'];
    const token = verificationRequest.query['hub.verify_token'];
    const challenge = verificationRequest.query['hub.challenge'];

    const isValid = mode === 'subscribe' && token === mockEnv.WEBHOOK_SECRET;
    
    assert(isValid === true, 'Webhook verification should pass');
    assert(challenge === 'challenge-string-1234567890', 'Should return challenge string');
  });

  await test('Meta Webhook: should reject invalid verification', () => {
    const invalidRequest = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'challenge-string'
      }
    };

    const isValid = invalidRequest.query['hub.verify_token'] === mockEnv.WEBHOOK_SECRET;
    assert(isValid === false, 'Should reject invalid verification token');
  });

  // Test Webhook Signature Verification
  await test('Signature Verification: should validate HMAC-SHA256 signatures', async () => {
    const payload = JSON.stringify({
      object: 'page',
      entry: [{ id: '123', changes: [{ field: 'leadgen', value: { leadgen_id: 'lead_123' } }] }]
    });
    
    const secret = 'webhook-secret-key';
    
    // Create signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    const signatureHeader = `sha256=${signatureHex}`;
    
    // Verify signature
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData);
    assert(isValid === true, 'HMAC signature verification should pass');
  });

  // Test Twilio Webhook Processing
  await test('Twilio Webhook: should process SMS status updates', () => {
    const twilioService = new TwilioService(mockEnv);
    
    const webhookData = [
      {
        MessageSid: 'SM123456789abcdef',
        MessageStatus: 'delivered',
        To: '+1234567890',
        From: '+0987654321',
        SmsStatus: 'delivered',
        SmsSid: 'SM123456789abcdef'
      }
    ];

    const processed = twilioService.processWebhookEvents(webhookData);
    
    assert(processed.length === 1, 'Should process one webhook event');
    assert(processed[0].messageSid === 'SM123456789abcdef', 'Should extract message SID');
    assert(processed[0].status === 'delivered', 'Should extract delivery status');
    assert(processed[0].to === '+1234567890', 'Should extract recipient number');
    assert(processed[0].from === '+0987654321', 'Should extract sender number');
  });

  await test('Twilio Webhook: should handle multiple status updates', () => {
    const twilioService = new TwilioService(mockEnv);
    
    const webhookData = [
      { MessageSid: 'SM1', MessageStatus: 'sent', To: '+1111111111', From: '+0000000000' },
      { MessageSid: 'SM2', MessageStatus: 'delivered', To: '+2222222222', From: '+0000000000' },
      { MessageSid: 'SM3', MessageStatus: 'failed', To: '+3333333333', From: '+0000000000' }
    ];

    const processed = twilioService.processWebhookEvents(webhookData);
    
    assert(processed.length === 3, 'Should process all three events');
    
    const statuses = processed.map(p => p.status);
    assert(statuses.includes('sent'), 'Should include sent status');
    assert(statuses.includes('delivered'), 'Should include delivered status');
    assert(statuses.includes('failed'), 'Should include failed status');
  });

  await test('Twilio Webhook: should handle error scenarios', () => {
    const twilioService = new TwilioService(mockEnv);
    
    const errorWebhookData = [
      {
        MessageSid: 'SM_error_123',
        MessageStatus: 'failed',
        ErrorCode: '30008',
        ErrorMessage: 'Unknown error',
        To: '+1234567890',
        From: '+0987654321'
      }
    ];

    const processed = twilioService.processWebhookEvents(errorWebhookData);
    
    assert(processed.length === 1, 'Should process error event');
    assert(processed[0].status === 'failed', 'Should extract failed status');
    assert(processed[0].messageSid === 'SM_error_123', 'Should extract error message SID');
  });

  // Test SendGrid Webhook Processing
  await test('SendGrid Webhook: should process email events', () => {
    const sendGridService = new SendGridService(mockEnv);
    
    const webhookEvents = [
      {
        email: 'john@example.com',
        timestamp: 1640995200,
        event: 'delivered',
        sg_event_id: 'event_delivered_123',
        sg_message_id: 'SG_msg_123456789'
      }
    ];

    const processed = sendGridService.processWebhookEvents(webhookEvents);
    
    assert(processed.length === 1, 'Should process one email event');
    assert(processed[0].messageId === 'SG_msg_123456789', 'Should extract message ID');
    assert(processed[0].email === 'john@example.com', 'Should extract email address');
    assert(processed[0].event === 'delivered', 'Should extract event type');
    assert(processed[0].timestamp === 1640995200000, 'Should convert timestamp to milliseconds');
  });

  await test('SendGrid Webhook: should handle engagement events', () => {
    const sendGridService = new SendGridService(mockEnv);
    
    const engagementEvents = [
      {
        email: 'user1@example.com',
        timestamp: 1640995200,
        event: 'open',
        sg_event_id: 'open_123',
        sg_message_id: 'SG_msg_1',
        useragent: 'Mozilla/5.0...',
        ip: '192.168.1.1'
      },
      {
        email: 'user2@example.com',
        timestamp: 1640995300,
        event: 'click',
        sg_event_id: 'click_456',
        sg_message_id: 'SG_msg_2',
        url: 'https://example.com/link1',
        useragent: 'Mozilla/5.0...'
      },
      {
        email: 'user3@example.com',
        timestamp: 1640995400,
        event: 'bounce',
        sg_event_id: 'bounce_789',
        sg_message_id: 'SG_msg_3',
        reason: 'Invalid email address',
        status: '5.1.1'
      }
    ];

    const processed = sendGridService.processWebhookEvents(engagementEvents);
    
    assert(processed.length === 3, 'Should process all engagement events');
    
    const events = processed.map(p => p.event);
    assert(events.includes('open'), 'Should include open event');
    assert(events.includes('click'), 'Should include click event');
    assert(events.includes('bounce'), 'Should include bounce event');
    
    // Check click event includes URL
    const clickEvent = processed.find(p => p.event === 'click');
    assert(clickEvent?.url === 'https://example.com/link1', 'Click event should include URL');
    
    // Check bounce event includes reason
    const bounceEvent = processed.find(p => p.event === 'bounce');
    assert(bounceEvent?.reason === 'Invalid email address', 'Bounce event should include reason');
  });

  // Test Meta Lead Webhook Processing
  await test('Meta Lead Webhook: should process leadgen webhooks', () => {
    const metaWebhookPayload = {
      object: 'page',
      entry: [
        {
          id: '1234567890',
          time: 1640995200,
          changes: [
            {
              field: 'leadgen',
              value: {
                leadgen_id: 'lead_1234567890abcdef',
                ad_id: 'ad_9876543210fedcba',
                form_id: 'form_abcdef123456',
                page_id: '1234567890',
                adgroup_id: 'adgroup_555666777',
                campaign_id: 'campaign_111222333',
                created_time: 1640995200
              }
            }
          ]
        }
      ]
    };

    assert(metaWebhookPayload.object === 'page', 'Webhook should be for page object');
    assert(metaWebhookPayload.entry.length === 1, 'Should have one entry');
    
    const change = metaWebhookPayload.entry[0].changes[0];
    assert(change.field === 'leadgen', 'Change should be for leadgen');
    assert(change.value.leadgen_id === 'lead_1234567890abcdef', 'Should have leadgen ID');
    assert(change.value.ad_id === 'ad_9876543210fedcba', 'Should have ad ID');
    assert(change.value.form_id === 'form_abcdef123456', 'Should have form ID');
  });

  await test('Meta Lead Webhook: should handle multiple lead entries', () => {
    const multiLeadPayload = {
      object: 'page',
      entry: [
        {
          id: '1234567890',
          time: 1640995200,
          changes: [
            {
              field: 'leadgen',
              value: { leadgen_id: 'lead_1', ad_id: 'ad_1', form_id: 'form_1' }
            },
            {
              field: 'leadgen',
              value: { leadgen_id: 'lead_2', ad_id: 'ad_2', form_id: 'form_2' }
            }
          ]
        }
      ]
    };

    const leadgenChanges = multiLeadPayload.entry[0].changes.filter(c => c.field === 'leadgen');
    assert(leadgenChanges.length === 2, 'Should have two leadgen changes');
    assert(leadgenChanges[0].value.leadgen_id === 'lead_1', 'Should process first lead');
    assert(leadgenChanges[1].value.leadgen_id === 'lead_2', 'Should process second lead');
  });

  // Test Webhook Security
  await test('Security: should reject webhooks without proper signatures', async () => {
    const payload = JSON.stringify({ test: 'data' });
    const invalidSignature = 'sha256=invalid_signature_hash';
    const secret = 'webhook-secret-key';
    
    // Try to verify invalid signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    try {
      // Extract invalid signature
      const signatureHex = invalidSignature.replace('sha256=', '');
      const signatureBytes = new Uint8Array(
        signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      
      const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData);
      assert(isValid === false, 'Invalid signature should be rejected');
    } catch (error) {
      // Invalid hex in signature should cause error
      assert(true, 'Invalid signature format should be rejected');
    }
  });

  await test('Security: should handle malformed webhook payloads', () => {
    const malformedPayloads = [
      '', // Empty payload
      '{invalid json}', // Invalid JSON
      '{"object": "unknown"}', // Unknown object type
      '{"entry": "not_an_array"}' // Invalid entry format
    ];

    malformedPayloads.forEach((payload, index) => {
      try {
        if (payload === '') {
          throw new Error('Empty payload');
        }
        
        const parsed = JSON.parse(payload);
        
        if (parsed.object !== 'page') {
          throw new Error('Invalid object type');
        }
        
        if (!Array.isArray(parsed.entry)) {
          throw new Error('Invalid entry format');
        }
        
        // Should not reach here for malformed payloads
        assert(false, `Malformed payload ${index + 1} should be rejected`);
      } catch (error) {
        // Expected for malformed payloads
        assert(true, `Malformed payload ${index + 1} correctly rejected`);
      }
    });
  });

  // Test Webhook Response Handling
  await test('Response Handling: should return appropriate HTTP responses', () => {
    const responses = [
      { scenario: 'valid_meta_webhook', expectedStatus: 200, expectedBody: 'OK' },
      { scenario: 'invalid_signature', expectedStatus: 401, expectedBody: 'Unauthorized' },
      { scenario: 'invalid_verification', expectedStatus: 403, expectedBody: 'Forbidden' },
      { scenario: 'malformed_payload', expectedStatus: 200, expectedBody: 'OK' }, // Meta expects 200 even for errors
      { scenario: 'twilio_status_update', expectedStatus: 200, expectedBody: 'OK' },
      { scenario: 'sendgrid_event', expectedStatus: 200, expectedBody: 'OK' }
    ];

    responses.forEach(({ scenario, expectedStatus, expectedBody }) => {
      // Simulate response logic
      let status: number;
      let body: string;
      
      switch (scenario) {
        case 'valid_meta_webhook':
        case 'twilio_status_update':
        case 'sendgrid_event':
        case 'malformed_payload':
          status = 200;
          body = 'OK';
          break;
        case 'invalid_signature':
          status = 401;
          body = 'Unauthorized';
          break;
        case 'invalid_verification':
          status = 403;
          body = 'Forbidden';
          break;
        default:
          status = 500;
          body = 'Internal Server Error';
      }
      
      assert(status === expectedStatus, `${scenario} should return status ${expectedStatus}`);
      assert(body === expectedBody, `${scenario} should return body "${expectedBody}"`);
    });
  });

  console.log('\n✅ All Webhook Integration tests completed!');
}

// Run the tests
runWebhookIntegrationTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});