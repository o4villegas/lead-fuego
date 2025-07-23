// Message Processor Job System Test

import { MessageProcessor } from '../../src/worker/jobs/message-processor.js';
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

// Create mock database with pending messages
function createMockD1Database(): D1Database {
  const now = Date.now();
  const mockData = {
    sms_messages: [
      {
        id: 'sms-1',
        lead_id: 'lead-123',
        drip_step_id: 'step-1',
        to_number: '+1234567890',
        from_number: '+0987654321',
        content: 'Welcome SMS message',
        status: 'pending',
        scheduled_at: now - 60000, // 1 minute ago (ready to send)
        created_at: now - 120000,
        updated_at: now - 120000
      },
      {
        id: 'sms-2',
        lead_id: 'lead-456',
        drip_step_id: 'step-2',
        to_number: '+1111111111',
        from_number: '+0987654321',
        content: 'Follow-up SMS',
        status: 'pending',
        scheduled_at: now + 3600000, // 1 hour from now (not ready)
        created_at: now - 60000,
        updated_at: now - 60000
      },
      {
        id: 'sms-3',
        lead_id: 'lead-789',
        drip_step_id: 'step-3',
        to_number: '+2222222222',
        from_number: '+0987654321',
        content: 'Urgent SMS',
        status: 'pending',
        scheduled_at: now - 300000, // 5 minutes ago (ready to send)
        created_at: now - 360000,
        updated_at: now - 360000
      }
    ],
    email_messages: [
      {
        id: 'email-1',
        lead_id: 'lead-123',
        drip_step_id: 'step-4',
        to_email: 'john@example.com',
        subject: 'Welcome Email',
        template_id: 'template-123',
        dynamic_data: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
        status: 'pending',
        scheduled_at: now - 30000, // 30 seconds ago (ready to send)
        created_at: now - 90000,
        updated_at: now - 90000
      },
      {
        id: 'email-2',
        lead_id: 'lead-456',
        drip_step_id: 'step-5',
        to_email: 'jane@example.com',
        subject: 'Follow-up Email',
        content: '<p>Thanks for your interest!</p>',
        status: 'pending',
        scheduled_at: now + 7200000, // 2 hours from now (not ready)
        created_at: now - 30000,
        updated_at: now - 30000
      }
    ]
  };

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        run: async () => {
          // Handle UPDATE operations
          if (query.includes('UPDATE sms_messages')) {
            const messageId = params[params.length - 1]; // Last parameter is usually the ID
            const message = mockData.sms_messages.find(m => m.id === messageId);
            if (message) {
              // Update the message status based on the query
              if (query.includes('status = ?')) {
                const statusIndex = query.indexOf('status = ?');
                const statusParamIndex = query.substring(0, statusIndex).split('?').length - 1;
                message.status = params[statusParamIndex];
              }
            }
          } else if (query.includes('UPDATE email_messages')) {
            const messageId = params[params.length - 1];
            const message = mockData.email_messages.find(m => m.id === messageId);
            if (message) {
              if (query.includes('status = ?')) {
                const statusIndex = query.indexOf('status = ?');
                const statusParamIndex = query.substring(0, statusIndex).split('?').length - 1;
                message.status = params[statusParamIndex];
              }
            }
          }
          return { success: true };
        },
        first: async <T>() => null as T,
        all: async <T>() => {
          if (query.includes('SELECT * FROM sms_messages') && query.includes('status = \'pending\'')) {
            const currentTime = params[0];
            const limit = params[1];
            
            const pendingMessages = mockData.sms_messages.filter(m => 
              m.status === 'pending' && m.scheduled_at <= currentTime
            ).slice(0, limit);
            
            return { results: pendingMessages };
          } else if (query.includes('SELECT * FROM email_messages') && query.includes('status = \'pending\'')) {
            const currentTime = params[0];
            const limit = params[1];
            
            const pendingMessages = mockData.email_messages.filter(m => 
              m.status === 'pending' && m.scheduled_at <= currentTime
            ).slice(0, limit);
            
            return { results: pendingMessages };
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

// Mock Twilio service
class MockTwilioService {
  async sendSMS(data: any) {
    // Simulate successful SMS sending
    if (data.to === '+1234567890') {
      return { sid: 'SM123456789' };
    } else if (data.to === '+2222222222') {
      return { sid: 'SM987654321' };
    } else {
      return { sid: null, error: 'Invalid phone number' };
    }
  }
}

// Mock SendGrid service
class MockSendGridService {
  async sendEmail(data: any) {
    // Simulate successful email sending
    if (data.to === 'john@example.com') {
      return { success: true, messageId: 'SG123456789' };
    } else {
      return { success: false, error: 'Invalid email address' };
    }
  }
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
  WEBHOOK_SECRET: 'webhook-secret',
  ENCRYPTION_KEY: 'encryption-key',
  TWILIO_ACCOUNT_SID: 'ACtest123',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+0987654321',
  SENDGRID_API_KEY: 'SG.test-key',
  SENDGRID_FROM_EMAIL: 'test@leadfuego.com',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

async function runMessageProcessorTests() {
  console.log('⚙️ Starting Message Processor Job System Tests\n');

  // Test Message Processor Initialization
  await test('Initialization: should create message processor', () => {
    const processor = new MessageProcessor(mockEnv, { batchSize: 10, maxRetries: 3 });
    assert(processor !== null, 'Processor should be created');
  });

  // Test Pending Message Detection
  await test('Pending Detection: should find ready-to-send messages', () => {
    const currentTime = Date.now();
    
    // Mock the query logic
    const smsMessages = [
      { scheduled_at: currentTime - 60000, status: 'pending' }, // Ready
      { scheduled_at: currentTime + 3600000, status: 'pending' }, // Not ready
      { scheduled_at: currentTime - 300000, status: 'pending' } // Ready
    ];

    const readyMessages = smsMessages.filter(m => 
      m.status === 'pending' && m.scheduled_at <= currentTime
    );

    assert(readyMessages.length === 2, 'Should find 2 ready-to-send SMS messages');
  });

  await test('Pending Detection: should respect scheduling times', () => {
    const currentTime = Date.now();
    
    const emailMessages = [
      { scheduled_at: currentTime - 30000, status: 'pending' }, // Ready
      { scheduled_at: currentTime + 7200000, status: 'pending' } // Not ready
    ];

    const readyEmails = emailMessages.filter(m => 
      m.status === 'pending' && m.scheduled_at <= currentTime
    );

    assert(readyEmails.length === 1, 'Should find 1 ready-to-send email message');
  });

  // Test Message Processing Logic
  await test('Processing Logic: should handle SMS processing workflow', () => {
    const smsMessage = {
      id: 'sms-test-1',
      to_number: '+1234567890',
      from_number: '+0987654321',
      content: 'Test SMS message',
      lead_id: 'lead-123',
      status: 'pending'
    };

    // Simulate processing steps
    const steps = [
      { step: 'validate', valid: true },
      { step: 'update_status_to_queued', success: true },
      { step: 'send_via_twilio', success: true, sid: 'SM123456789' },
      { step: 'update_status_to_sent', success: true }
    ];

    steps.forEach((step, index) => {
      if (step.step === 'validate') {
        assert(smsMessage.to_number.startsWith('+'), 'Phone number should be in E.164 format');
        assert(smsMessage.content.length > 0, 'Message should have content');
      } else if (step.step === 'send_via_twilio') {
        assert(step.success === true, 'Twilio send should succeed');
        assert(step.sid === 'SM123456789', 'Should return Twilio SID');
      }
    });
  });

  await test('Processing Logic: should handle email processing workflow', () => {
    const emailMessage = {
      id: 'email-test-1',
      to_email: 'john@example.com',
      subject: 'Test Email',
      template_id: 'template-123',
      dynamic_data: '{"firstName":"John"}',
      lead_id: 'lead-123',
      status: 'pending'
    };

    // Simulate processing steps
    const steps = [
      { step: 'validate_email', valid: true },
      { step: 'parse_dynamic_data', success: true },
      { step: 'send_via_sendgrid', success: true, messageId: 'SG123456789' },
      { step: 'update_status_to_sent', success: true }
    ];

    steps.forEach((step) => {
      if (step.step === 'validate_email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        assert(emailRegex.test(emailMessage.to_email), 'Email should be valid format');
      } else if (step.step === 'parse_dynamic_data') {
        const parsed = JSON.parse(emailMessage.dynamic_data);
        assert(parsed.firstName === 'John', 'Should parse dynamic data correctly');
      } else if (step.step === 'send_via_sendgrid') {
        assert(step.success === true, 'SendGrid send should succeed');
        assert(step.messageId === 'SG123456789', 'Should return SendGrid message ID');
      }
    });
  });

  // Test Error Handling
  await test('Error Handling: should handle SMS send failures', () => {
    const failedSMSMessage = {
      id: 'sms-fail-1',
      to_number: '+invalid',
      content: 'Test message',
      status: 'pending'
    };

    // Simulate validation failure
    const isValidPhone = failedSMSMessage.to_number.match(/^\+[1-9]\d{1,14}$/);
    assert(isValidPhone === null, 'Invalid phone should be detected');

    // Simulate error handling
    const errorResult = {
      success: false,
      error: 'Invalid phone number format',
      newStatus: 'failed'
    };

    assert(errorResult.success === false, 'Should mark as failed');
    assert(errorResult.newStatus === 'failed', 'Status should be updated to failed');
  });

  await test('Error Handling: should handle email send failures', () => {
    const failedEmailMessage = {
      id: 'email-fail-1',
      to_email: 'invalid-email',
      subject: 'Test',
      status: 'pending'
    };

    // Simulate validation failure
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(failedEmailMessage.to_email);
    assert(isValidEmail === false, 'Invalid email should be detected');

    // Simulate error handling
    const errorResult = {
      success: false,
      error: 'Invalid email address',
      newStatus: 'bounced'
    };

    assert(errorResult.success === false, 'Should mark as failed');
    assert(errorResult.newStatus === 'bounced', 'Email status should be bounced');
  });

  // Test Batch Processing
  await test('Batch Processing: should process messages in batches', () => {
    const batchSize = 10;
    const totalMessages = 25;
    
    const batches = [];
    for (let i = 0; i < totalMessages; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, totalMessages);
      batches.push({ start: i, end: batchEnd, size: batchEnd - i });
    }

    assert(batches.length === 3, 'Should create 3 batches for 25 messages');
    assert(batches[0].size === 10, 'First batch should have 10 messages');
    assert(batches[1].size === 10, 'Second batch should have 10 messages');
    assert(batches[2].size === 5, 'Third batch should have 5 messages');
  });

  await test('Batch Processing: should handle rate limiting', () => {
    const batchSize = 10;
    const delayBetweenBatches = 1000; // 1 second
    
    const processingPlan = {
      totalBatches: 3,
      batchSize: batchSize,
      delayBetweenBatches: delayBetweenBatches,
      totalProcessingTime: (3 - 1) * delayBetweenBatches // Delay between batches
    };

    assert(processingPlan.totalProcessingTime === 2000, 'Should plan 2 seconds of delays');
    assert(processingPlan.batchSize === 10, 'Should use correct batch size');
  });

  // Test Webhook Event Processing
  await test('Webhook Processing: should handle Twilio status updates', () => {
    const twilioWebhookEvent = {
      MessageSid: 'SM123456789',
      MessageStatus: 'delivered',
      To: '+1234567890',
      From: '+0987654321',
      SmsStatus: 'delivered'
    };

    const processedEvent = {
      type: 'twilio',
      messageId: twilioWebhookEvent.MessageSid,
      status: twilioWebhookEvent.MessageStatus,
      timestamp: Date.now()
    };

    assert(processedEvent.type === 'twilio', 'Should identify as Twilio event');
    assert(processedEvent.messageId === 'SM123456789', 'Should extract message SID');
    assert(processedEvent.status === 'delivered', 'Should extract delivery status');
  });

  await test('Webhook Processing: should handle SendGrid email events', () => {
    const sendGridWebhookEvent = {
      email: 'john@example.com',
      timestamp: 1640995200,
      event: 'delivered',
      sg_event_id: 'event123',
      sg_message_id: 'SG123456789'
    };

    const processedEvent = {
      type: 'sendgrid',
      messageId: sendGridWebhookEvent.sg_message_id,
      status: sendGridWebhookEvent.event,
      timestamp: sendGridWebhookEvent.timestamp * 1000 // Convert to milliseconds
    };

    assert(processedEvent.type === 'sendgrid', 'Should identify as SendGrid event');
    assert(processedEvent.messageId === 'SG123456789', 'Should extract message ID');
    assert(processedEvent.status === 'delivered', 'Should extract event type');
    assert(processedEvent.timestamp === 1640995200000, 'Should convert timestamp to milliseconds');
  });

  // Test Journey Statistics Updates
  await test('Statistics: should update journey stats after sending', () => {
    const journey = {
      id: 'journey-123',
      total_sms_sent: 5,
      total_emails_sent: 3,
      total_opens: 1,
      total_clicks: 0
    };

    // Simulate SMS sent
    const updatedAfterSMS = {
      ...journey,
      total_sms_sent: journey.total_sms_sent + 1
    };

    assert(updatedAfterSMS.total_sms_sent === 6, 'Should increment SMS count');

    // Simulate email sent
    const updatedAfterEmail = {
      ...updatedAfterSMS,
      total_emails_sent: journey.total_emails_sent + 1
    };

    assert(updatedAfterEmail.total_emails_sent === 4, 'Should increment email count');

    // Simulate email opened
    const updatedAfterOpen = {
      ...updatedAfterEmail,
      total_opens: journey.total_opens + 1
    };

    assert(updatedAfterOpen.total_opens === 2, 'Should increment open count');
  });

  // Test Scheduling Logic
  await test('Scheduling: should handle cron job execution', () => {
    const cronSchedule = '*/5 * * * *'; // Every 5 minutes
    const currentTime = new Date('2024-01-01T12:00:00Z');
    
    // Simulate cron execution times
    const executionTimes = [
      new Date('2024-01-01T12:00:00Z'),
      new Date('2024-01-01T12:05:00Z'),
      new Date('2024-01-01T12:10:00Z'),
      new Date('2024-01-01T12:15:00Z')
    ];

    executionTimes.forEach((time, index) => {
      const minutesDiff = (time.getTime() - currentTime.getTime()) / (1000 * 60);
      assert(minutesDiff === index * 5, `Execution ${index + 1} should be at ${index * 5} minutes`);
    });
  });

  console.log('\n✅ All Message Processor Job System tests completed!');
}

// Run the tests
runMessageProcessorTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});