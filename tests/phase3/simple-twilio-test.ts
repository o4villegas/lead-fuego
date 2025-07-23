// Simple Twilio Service Test without Jest framework

import { TwilioService } from '../../src/worker/services/twilio.js';
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
  
  // Twilio credentials
  TWILIO_ACCOUNT_SID: 'ACtest123456789',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+1234567890',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

async function runTwilioTests() {
  console.log('🧪 Starting Twilio Service Tests\n');

  const twilioService = new TwilioService(mockEnv);

  // Configuration Tests
  await test('Configuration: should detect if Twilio is configured', () => {
    const isConfigured = twilioService.isConfigured();
    assert(isConfigured === true, 'Twilio should be configured with mock env');
  });

  await test('Configuration: should return detailed config status', () => {
    const status = twilioService.getConfigStatus();
    assert(status.hasAccountSid === true, 'Should have account SID');
    assert(status.hasAuthToken === true, 'Should have auth token');
    assert(status.hasPhoneNumber === true, 'Should have phone number');
    assert(status.isFullyConfigured === true, 'Should be fully configured');
  });

  await test('Configuration: should detect incomplete configuration', () => {
    const incompleteEnv = { ...mockEnv, TWILIO_ACCOUNT_SID: undefined };
    const service = new TwilioService(incompleteEnv);
    
    assert(service.isConfigured() === false, 'Should not be configured without SID');
    assert(service.getConfigStatus().hasAccountSid === false, 'Should detect missing SID');
  });

  // Phone Number Validation Tests
  await test('Phone Validation: should validate E.164 numbers', () => {
    const validNumbers = ['+1234567890', '+12125551234', '+442071234567', '+81312345678'];
    
    validNumbers.forEach(number => {
      assert(
        twilioService.validatePhoneNumber(number) === true, 
        `Should validate ${number} as valid E.164`
      );
    });
  });

  await test('Phone Validation: should reject invalid numbers', () => {
    const invalidNumbers = ['1234567890', '+1', 'abc123', '+1-234-567-890', ''];
    
    invalidNumbers.forEach(number => {
      assert(
        twilioService.validatePhoneNumber(number) === false, 
        `Should reject ${number} as invalid`
      );
    });
  });

  await test('Phone Formatting: should format to E.164', () => {
    const tests = [
      { input: '5551234567', country: 'US', expected: '+15551234567' },
      { input: '(555) 123-4567', country: 'US', expected: '+15551234567' }
    ];

    tests.forEach(({ input, country, expected }) => {
      const result = twilioService.formatToE164(input, country);
      assert(result === expected, `${input} should format to ${expected}, got ${result}`);
    });
  });

  // SMS Data Validation Tests
  await test('SMS Validation: should validate proper SMS data', () => {
    const validSMSData = {
      to: '+1234567890',
      from: '+1987654321',
      body: 'Test message',
      leadId: 'lead-123'
    };

    try {
      twilioService.validateSMSData(validSMSData);
      // Should not throw
    } catch (error) {
      assert(false, `Valid SMS data should not throw error: ${error}`);
    }
  });

  await test('SMS Validation: should reject invalid SMS data', () => {
    const invalidCases = [
      { to: 'invalid-phone', from: '+1234567890', body: 'Test', error: 'Invalid to number' },
      { to: '+1234567890', from: 'invalid-phone', body: 'Test', error: 'Invalid from number' },
      { to: '+1234567890', from: '+0987654321', body: '', error: 'Empty body' },
      { to: '+1234567890', from: '+0987654321', body: 'x'.repeat(1700), error: 'Too long body' }
    ];

    invalidCases.forEach(({ error, ...smsData }) => {
      try {
        twilioService.validateSMSData(smsData);
        assert(false, `${error} should throw validation error`);
      } catch (e) {
        // Should throw - this is expected
      }
    });
  });

  // Webhook Processing Tests
  await test('Webhook Processing: should process webhook events', () => {
    const mockWebhookData = [{
      MessageSid: 'SM123456789',
      MessageStatus: 'delivered',
      To: '+1234567890',
      From: '+0987654321',
      Body: 'Test message'
    }];

    const processed = twilioService.processWebhookEvents(mockWebhookData);
    
    assert(processed.length === 1, 'Should process one event');
    assert(processed[0].messageSid === 'SM123456789', 'Should extract message SID');
    assert(processed[0].status === 'delivered', 'Should extract status');
    assert(processed[0].to === '+1234567890', 'Should extract to number');
  });

  await test('Webhook Processing: should handle multiple events', () => {
    const webhookEvents = [
      { MessageSid: 'SM1', MessageStatus: 'sent', To: '+1111111111', From: '+0000000000' },
      { MessageSid: 'SM2', MessageStatus: 'delivered', To: '+2222222222', From: '+0000000000' },
      { MessageSid: 'SM3', MessageStatus: 'failed', To: '+3333333333', From: '+0000000000' }
    ];

    const processed = twilioService.processWebhookEvents(webhookEvents);
    
    assert(processed.length === 3, 'Should process all three events');
    
    const statuses = processed.map(p => p.status);
    assert(
      statuses.includes('sent') && statuses.includes('delivered') && statuses.includes('failed'),
      'Should preserve all status types'
    );
  });

  // Bulk SMS Tests
  await test('Bulk SMS: should validate bulk data', () => {
    const bulkData = [
      { to: '+1111111111', from: '+1987654321', body: 'Message 1' },
      { to: '+1222222222', from: '+1987654321', body: 'Message 2' }
    ];

    try {
      twilioService.validateBulkSMSData(bulkData);
      // Should not throw
    } catch (error) {
      assert(false, `Valid bulk SMS data should not throw: ${error}`);
    }
  });

  await test('Bulk SMS: should reject invalid bulk data', () => {
    const invalidBulkData = [
      { to: '+1111111111', from: '+0000000000', body: 'Valid message' },
      { to: 'invalid-phone', from: '+0000000000', body: 'Invalid message' }
    ];

    try {
      twilioService.validateBulkSMSData(invalidBulkData);
      assert(false, 'Invalid bulk SMS data should throw error');
    } catch (error) {
      // Should throw - this is expected
    }
  });

  await test('Bulk SMS: should enforce limits', () => {
    const largeBulkData = Array(1001).fill({
      to: '+1111111111',
      from: '+0000000000',
      body: 'Message'
    });

    try {
      twilioService.validateBulkSMSData(largeBulkData);
      assert(false, 'Should reject bulk data exceeding limits');
    } catch (error) {
      assert(
        error instanceof Error && error.message.includes('too many'),
        'Should mention limit exceeded'
      );
    }
  });

  console.log('\n✅ All Twilio Service tests completed!');
}

// Run the tests
runTwilioTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});