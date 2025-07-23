// Twilio Service Tests for Phase 3

import { TwilioService } from '../../src/worker/services/twilio';
import { Env } from '../../src/worker/types/env';

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
  
  // Twilio credentials - these would need to be real for actual testing
  TWILIO_ACCOUNT_SID: 'ACtest123456789',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+1234567890',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

describe('TwilioService', () => {
  let twilioService: TwilioService;

  beforeAll(() => {
    twilioService = new TwilioService(mockEnv);
  });

  describe('Configuration', () => {
    test('should detect if Twilio is properly configured', () => {
      const isConfigured = twilioService.isConfigured();
      expect(isConfigured).toBe(true);
    });

    test('should return configuration status', () => {
      const status = twilioService.getConfigStatus();
      expect(status).toEqual({
        hasAccountSid: true,
        hasAuthToken: true,
        hasPhoneNumber: true,
        hasWebhookUrl: true,
        isFullyConfigured: true
      });
    });

    test('should detect incomplete configuration', () => {
      const incompleteEnv = { ...mockEnv, TWILIO_ACCOUNT_SID: undefined };
      const service = new TwilioService(incompleteEnv);
      
      expect(service.isConfigured()).toBe(false);
      expect(service.getConfigStatus().hasAccountSid).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    test('should validate E.164 phone numbers', () => {
      const validNumbers = [
        '+1234567890',
        '+12125551234',
        '+442071234567',
        '+81312345678'
      ];

      validNumbers.forEach(number => {
        expect(twilioService.validatePhoneNumber(number)).toBe(true);
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '1234567890',     // Missing +
        '+1',             // Too short
        'abc123',         // Contains letters
        '+1-234-567-890', // Contains dashes
        '+1 234 567 890', // Contains spaces
        ''                // Empty string
      ];

      invalidNumbers.forEach(number => {
        expect(twilioService.validatePhoneNumber(number)).toBe(false);
      });
    });

    test('should format phone numbers to E.164', () => {
      const formatTests = [
        { input: '(555) 123-4567', country: 'US', expected: '+15551234567' },
        { input: '555-123-4567', country: 'US', expected: '+15551234567' },
        { input: '5551234567', country: 'US', expected: '+15551234567' },
        { input: '07700 900123', country: 'GB', expected: '+447700900123' }
      ];

      formatTests.forEach(({ input, country, expected }) => {
        const result = twilioService.formatToE164(input, country);
        expect(result).toBe(expected);
      });
    });
  });

  describe('SMS Data Validation', () => {
    test('should validate SMS data structure', () => {
      const validSMSData = {
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        leadId: 'lead-123'
      };

      expect(() => twilioService.validateSMSData(validSMSData)).not.toThrow();
    });

    test('should reject invalid SMS data', () => {
      const invalidCases = [
        { to: 'invalid-phone', from: '+1234567890', body: 'Test' },
        { to: '+1234567890', from: 'invalid-phone', body: 'Test' },
        { to: '+1234567890', from: '+0987654321', body: '' },
        { to: '+1234567890', from: '+0987654321', body: 'x'.repeat(1700) }
      ];

      invalidCases.forEach(smsData => {
        expect(() => twilioService.validateSMSData(smsData)).toThrow();
      });
    });
  });

  describe('Webhook Processing', () => {
    test('should process Twilio webhook events correctly', () => {
      const mockWebhookData = {
        MessageSid: 'SM123456789',
        MessageStatus: 'delivered',
        To: '+1234567890',
        From: '+0987654321',
        Body: 'Test message',
        SmsSid: 'SM123456789',
        SmsStatus: 'delivered'
      };

      const processed = twilioService.processWebhookEvents([mockWebhookData]);
      
      expect(processed).toHaveLength(1);
      expect(processed[0]).toEqual({
        messageSid: 'SM123456789',
        status: 'delivered',
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        timestamp: expect.any(Number)
      });
    });

    test('should handle multiple webhook events', () => {
      const webhookEvents = [
        { MessageSid: 'SM1', MessageStatus: 'sent', To: '+1111111111', From: '+0000000000' },
        { MessageSid: 'SM2', MessageStatus: 'delivered', To: '+2222222222', From: '+0000000000' },
        { MessageSid: 'SM3', MessageStatus: 'failed', To: '+3333333333', From: '+0000000000' }
      ];

      const processed = twilioService.processWebhookEvents(webhookEvents);
      
      expect(processed).toHaveLength(3);
      expect(processed.map(p => p.status)).toEqual(['sent', 'delivered', 'failed']);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing configuration gracefully', () => {
      const emptyEnv = { ...mockEnv, TWILIO_ACCOUNT_SID: undefined };
      const service = new TwilioService(emptyEnv);
      
      expect(() => service.validatePhoneNumber('+1234567890')).not.toThrow();
      expect(service.isConfigured()).toBe(false);
    });

    test('should provide helpful error messages', () => {
      expect(() => {
        twilioService.validateSMSData({
          to: 'invalid',
          from: '+1234567890',
          body: 'Test'
        });
      }).toThrow('Invalid phone number format');
    });
  });

  describe('Bulk SMS Validation', () => {
    test('should validate bulk SMS data', () => {
      const bulkData = [
        { to: '+1111111111', from: '+0000000000', body: 'Message 1' },
        { to: '+2222222222', from: '+0000000000', body: 'Message 2' },
        { to: '+3333333333', from: '+0000000000', body: 'Message 3' }
      ];

      expect(() => twilioService.validateBulkSMSData(bulkData)).not.toThrow();
    });

    test('should reject bulk SMS with invalid entries', () => {
      const invalidBulkData = [
        { to: '+1111111111', from: '+0000000000', body: 'Valid message' },
        { to: 'invalid-phone', from: '+0000000000', body: 'Invalid message' }
      ];

      expect(() => twilioService.validateBulkSMSData(invalidBulkData)).toThrow();
    });

    test('should enforce bulk SMS limits', () => {
      const largeBulkData = Array(1001).fill({
        to: '+1111111111',
        from: '+0000000000',
        body: 'Message'
      });

      expect(() => twilioService.validateBulkSMSData(largeBulkData)).toThrow('too many messages');
    });
  });
});

// Integration test (requires real Twilio credentials)
describe('TwilioService Integration', () => {
  // These tests would only run if real Twilio credentials are provided
  const hasRealCredentials = process.env.TWILIO_ACCOUNT_SID && 
                           process.env.TWILIO_AUTH_TOKEN && 
                           process.env.TWILIO_PHONE_NUMBER;

  if (!hasRealCredentials) {
    test.skip('Skipping integration tests - no real Twilio credentials provided', () => {});
    return;
  }

  const realEnv: Env = {
    ...mockEnv,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER!
  };

  let twilioService: TwilioService;

  beforeAll(() => {
    twilioService = new TwilioService(realEnv);
  });

  test('should verify Twilio account', async () => {
    const verification = await twilioService.verifyAccount();
    
    expect(verification.verified).toBe(true);
    expect(verification.accountSid).toBeTruthy();
  }, 10000);

  test('should get account information', async () => {
    const accountInfo = await twilioService.getAccountInfo();
    
    expect(accountInfo.friendlyName).toBeTruthy();
    expect(accountInfo.status).toBe('active');
  }, 10000);

  // Note: Actual SMS sending test would require a valid test phone number
  // and should be done carefully to avoid charges
});

console.log('Twilio Service tests loaded. Run with: npm test -- --testPathPattern=twilio-service.test.ts');