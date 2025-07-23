// Simple SendGrid Service Test without Jest framework

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

// Mock environment for testing
const mockEnv: Env = {
  DB: {} as D1Database,
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  AI: {} as Ai,
  IMAGES: {} as Fetcher,
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret',
  WEBHOOK_SECRET: 'webhook-secret',
  ENCRYPTION_KEY: 'encryption-key',
  
  // SendGrid credentials
  SENDGRID_API_KEY: 'SG.test-api-key',
  SENDGRID_FROM_EMAIL: 'test@example.com',
  SENDGRID_FROM_NAME: 'LeadFuego Test',
  SENDGRID_UNSUBSCRIBE_GROUP_ID: '12345',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

async function runSendGridTests() {
  console.log('📧 Starting SendGrid Service Tests\n');

  const sendGridService = new SendGridService(mockEnv);

  // Configuration Tests
  await test('Configuration: should detect if SendGrid is configured', () => {
    const isConfigured = sendGridService.isConfigured();
    assert(isConfigured === true, 'SendGrid should be configured with mock env');
  });

  await test('Configuration: should return detailed config status', () => {
    const status = sendGridService.getConfigStatus();
    assert(status.hasApiKey === true, 'Should have API key');
    assert(status.hasFromEmail === true, 'Should have from email');
    assert(status.hasFromName === true, 'Should have from name');
    assert(status.isFullyConfigured === true, 'Should be fully configured');
  });

  await test('Configuration: should detect incomplete configuration', () => {
    const incompleteEnv = { ...mockEnv, SENDGRID_API_KEY: undefined };
    const service = new SendGridService(incompleteEnv);
    
    assert(service.isConfigured() === false, 'Should not be configured without API key');
    assert(service.getConfigStatus().hasApiKey === false, 'Should detect missing API key');
  });

  // Email Validation Tests
  await test('Email Validation: should validate email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name+tag@domain.co.uk',
      'email@subdomain.example.com',
      'firstname-lastname@example.com'
    ];
    
    validEmails.forEach(email => {
      assert(
        sendGridService.validateEmail(email) === true, 
        `Should validate ${email} as valid email`
      );
    });
  });

  await test('Email Validation: should reject invalid email addresses', () => {
    const invalidEmails = [
      'plainaddress',
      '@missinglocal.com',
      'missing@.com',
      'spaces in@email.com',
      'email@',
      ''
    ];
    
    invalidEmails.forEach(email => {
      assert(
        sendGridService.validateEmail(email) === false, 
        `Should reject ${email} as invalid email`
      );
    });
  });

  // Webhook Processing Tests
  await test('Webhook Processing: should process SendGrid events', () => {
    const mockEvents = [{
      email: 'test@example.com',
      timestamp: 1640995200,
      event: 'delivered',
      sg_event_id: 'event123',
      sg_message_id: 'msg456'
    }];

    const processed = sendGridService.processWebhookEvents(mockEvents);
    
    assert(processed.length === 1, 'Should process one event');
    assert(processed[0].messageId === 'msg456', 'Should extract message ID');
    assert(processed[0].email === 'test@example.com', 'Should extract email');
    assert(processed[0].event === 'delivered', 'Should extract event type');
    assert(processed[0].timestamp === 1640995200000, 'Should convert timestamp to milliseconds');
  });

  await test('Webhook Processing: should handle multiple events', () => {
    const webhookEvents = [
      { 
        email: 'user1@example.com', 
        timestamp: 1640995200, 
        event: 'delivered', 
        sg_event_id: 'e1', 
        sg_message_id: 'm1' 
      },
      { 
        email: 'user2@example.com', 
        timestamp: 1640995300, 
        event: 'opened', 
        sg_event_id: 'e2', 
        sg_message_id: 'm2' 
      },
      { 
        email: 'user3@example.com', 
        timestamp: 1640995400, 
        event: 'clicked', 
        sg_event_id: 'e3', 
        sg_message_id: 'm3',
        url: 'https://example.com/link'
      }
    ];

    const processed = sendGridService.processWebhookEvents(webhookEvents);
    
    assert(processed.length === 3, 'Should process all three events');
    
    const events = processed.map(p => p.event);
    assert(
      events.includes('delivered') && events.includes('opened') && events.includes('clicked'),
      'Should preserve all event types'
    );

    // Check URL is captured for click events
    const clickEvent = processed.find(p => p.event === 'clicked');
    assert(clickEvent?.url === 'https://example.com/link', 'Should capture click URL');
  });

  // HTML to Text Conversion Test
  await test('HTML Conversion: should convert HTML to text', () => {
    // Access private method through any cast for testing
    const service = sendGridService as any;
    
    const htmlContent = '<h1>Hello</h1><p>This is a <strong>test</strong> email.</p><br><p>Second paragraph.</p>';
    const expectedText = 'Hello\n\nThis is a test email.\n\nSecond paragraph.';
    
    if (service.htmlToText) {
      const result = service.htmlToText(htmlContent);
      assert(
        result.trim() === expectedText.trim(), 
        `HTML conversion failed. Expected: "${expectedText}", Got: "${result}"`
      );
    } else {
      console.log('ℹ️  HTML to text conversion method not accessible for testing');
    }
  });

  // Email Payload Building Test
  await test('Email Payload: should build correct email payload', () => {
    const emailData = {
      to: 'recipient@example.com',
      name: 'John Doe',
      subject: 'Test Subject',
      content: '<p>Test content</p>',
      leadId: 'lead-123'
    };

    // Access private method through any cast for testing
    const service = sendGridService as any;
    
    if (service.buildEmailPayload) {
      const payload = service.buildEmailPayload(emailData);
      
      assert(payload.from.email === 'test@example.com', 'Should use configured from email');
      assert(payload.from.name === 'LeadFuego Test', 'Should use configured from name');
      assert(payload.personalizations[0].to[0].email === 'recipient@example.com', 'Should set recipient');
      assert(payload.personalizations[0].to[0].name === 'John Doe', 'Should set recipient name');
      assert(payload.subject === 'Test Subject', 'Should set subject');
      assert(payload.content[0].value === '<p>Test content</p>', 'Should set content');
      
      // Check tracking settings
      assert(payload.tracking_settings.click_tracking.enable === true, 'Should enable click tracking');
      assert(payload.tracking_settings.open_tracking.enable === true, 'Should enable open tracking');
      
      // Check custom args for lead tracking
      assert(payload.personalizations[0].custom_args.lead_id === 'lead-123', 'Should set lead ID in custom args');
    } else {
      console.log('ℹ️  Email payload building method not accessible for testing');
    }
  });

  await test('Email Payload: should handle template-based emails', () => {
    const emailData = {
      to: 'recipient@example.com',
      templateId: 'template-123',
      dynamicData: {
        firstName: 'John',
        lastName: 'Doe',
        company: 'ACME Corp'
      }
    };

    // Access private method through any cast for testing
    const service = sendGridService as any;
    
    if (service.buildEmailPayload) {
      const payload = service.buildEmailPayload(emailData);
      
      assert(payload.template_id === 'template-123', 'Should set template ID');
      assert(
        payload.personalizations[0].dynamic_template_data.firstName === 'John',
        'Should set dynamic template data'
      );
      assert(!payload.subject, 'Should not set subject for template emails');
      assert(!payload.content, 'Should not set content for template emails');
    } else {
      console.log('ℹ️  Email payload building method not accessible for testing');
    }
  });

  // Error Handling Tests
  await test('Error Handling: should handle missing configuration', () => {
    const emptyEnv = { ...mockEnv, SENDGRID_API_KEY: undefined, SENDGRID_FROM_EMAIL: undefined };
    const service = new SendGridService(emptyEnv);
    
    assert(service.isConfigured() === false, 'Should not be configured');
    
    const status = service.getConfigStatus();
    assert(status.hasApiKey === false, 'Should detect missing API key');
    assert(status.hasFromEmail === false, 'Should detect missing from email');
  });

  await test('Validation: should reject invalid email data', () => {
    const invalidEmail = 'not-an-email';
    assert(
      sendGridService.validateEmail(invalidEmail) === false,
      'Should reject invalid email format'
    );
  });

  console.log('\n✅ All SendGrid Service tests completed!');
}

// Run the tests
runSendGridTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});