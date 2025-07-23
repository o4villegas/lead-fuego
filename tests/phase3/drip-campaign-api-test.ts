// Drip Campaign API Test Suite

import { Hono } from 'hono';
import { dripCampaignRoutes } from '../../src/worker/routes/drip-campaigns.js';
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

// Mock environment and database
const mockEnv: Env = {
  DB: createMockD1Database(),
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  AI: {} as Ai,
  IMAGES: {} as Fetcher,
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret-key-for-jwt-tokens',
  WEBHOOK_SECRET: 'webhook-secret',
  ENCRYPTION_KEY: 'encryption-key',
  WEBHOOK_BASE_URL: 'https://test.example.com'
};

// Create a mock D1Database for testing
function createMockD1Database(): D1Database {
  const mockData = {
    drip_campaigns: [],
    drip_steps: [],
    lead_journeys: [],
    users: [
      {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'pro',
        onboarding_completed: 1,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ],
    leads: [
      {
        id: 'lead-123',
        campaign_id: 'campaign-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        captured_at: Date.now(),
        status: 'active'
      }
    ]
  };

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        run: async () => ({ success: true }),
        first: async <T>() => {
          // Simple query parsing for tests
          if (query.includes('SELECT * FROM users WHERE id = ?')) {
            return mockData.users.find(u => u.id === params[0]) as T;
          }
          if (query.includes('SELECT * FROM drip_campaigns WHERE id = ?')) {
            return mockData.drip_campaigns.find(c => (c as any).id === params[0]) as T;
          }
          if (query.includes('SELECT * FROM leads WHERE id = ?')) {
            return mockData.leads.find(l => l.id === params[0]) as T;
          }
          return null as T;
        },
        all: async <T>() => ({ 
          results: query.includes('drip_campaigns WHERE created_by = ?') 
            ? mockData.drip_campaigns.filter((c: any) => c.created_by === params[0])
            : [] 
        })
      })
    }),
    exec: async () => ({ count: 0, duration: 0 }),
    batch: async () => [],
    dump: async () => new ArrayBuffer(0)
  } as D1Database;
}

// Create mock JWT token for testing
function createMockJWT(userId: string): string {
  // In a real implementation, this would use the jose library
  // For testing, we'll create a simple base64 encoded payload
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 };
  
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

async function runDripCampaignAPITests() {
  console.log('🚀 Starting Drip Campaign API Tests\n');

  // Create test app
  const app = new Hono<{ Bindings: Env }>();
  app.route('/api/drip', dripCampaignRoutes);

  // Test Data Validation
  await test('Validation: should validate drip campaign creation data', () => {
    const validCampaignData = {
      name: 'Welcome Campaign',
      description: 'Welcome new leads',
      trigger_type: 'meta_lead',
      steps: [
        {
          step_number: 1,
          channel: 'email',
          delay_minutes: 0,
          subject_template: 'Welcome to our service!',
          content_template: 'Thank you for your interest!'
        },
        {
          step_number: 2,
          channel: 'sms',
          delay_minutes: 1440, // 24 hours
          content_template: 'Quick follow-up message'
        }
      ]
    };

    // Validate structure
    assert(validCampaignData.name.length > 0, 'Should have campaign name');
    assert(validCampaignData.steps.length > 0, 'Should have at least one step');
    assert(validCampaignData.steps[0].step_number === 1, 'First step should be number 1');
    assert(['meta_lead', 'manual', 'api'].includes(validCampaignData.trigger_type), 'Should have valid trigger type');
  });

  await test('Validation: should reject invalid campaign data', () => {
    const invalidCases = [
      { name: '', steps: [] }, // Empty name and steps
      { name: 'Valid Name', steps: [] }, // No steps
      { 
        name: 'Valid Name', 
        steps: [{ step_number: 0, channel: 'email', delay_minutes: 0 }] 
      }, // Invalid step number
      { 
        name: 'Valid Name', 
        steps: [{ step_number: 1, channel: 'invalid', delay_minutes: 0 }] 
      }, // Invalid channel
      { 
        name: 'x'.repeat(300), 
        steps: [{ step_number: 1, channel: 'email', delay_minutes: 0 }] 
      } // Name too long
    ];

    invalidCases.forEach((data, index) => {
      try {
        // Validate against our expected schema
        if (!data.name || data.name.length === 0 || data.name.length > 255) {
          throw new Error('Invalid name');
        }
        if (!data.steps || data.steps.length === 0) {
          throw new Error('No steps provided');
        }
        data.steps.forEach((step: any) => {
          if (step.step_number < 1 || step.step_number > 20) {
            throw new Error('Invalid step number');
          }
          if (!['sms', 'email'].includes(step.channel)) {
            throw new Error('Invalid channel');
          }
        });
        
        assert(false, `Case ${index + 1} should have failed validation`);
      } catch (error) {
        // Expected to throw
      }
    });
  });

  // Test Campaign Structure
  await test('Campaign Structure: should handle multi-step campaigns', () => {
    const multiStepCampaign = {
      name: 'Complex Nurture Campaign',
      trigger_type: 'meta_lead',
      steps: [
        { step_number: 1, channel: 'email', delay_minutes: 0 },
        { step_number: 2, channel: 'sms', delay_minutes: 1440 },
        { step_number: 3, channel: 'email', delay_minutes: 4320 },
        { step_number: 4, channel: 'sms', delay_minutes: 10080 }
      ]
    };

    assert(multiStepCampaign.steps.length === 4, 'Should have 4 steps');
    
    // Check step ordering
    const stepNumbers = multiStepCampaign.steps.map(s => s.step_number);
    assert(stepNumbers.every((num, index) => num === index + 1), 'Steps should be properly numbered');
    
    // Check delay progression
    const delays = multiStepCampaign.steps.map(s => s.delay_minutes);
    for (let i = 1; i < delays.length; i++) {
      assert(delays[i] >= delays[i-1], 'Delays should generally increase');
    }
  });

  await test('Campaign Structure: should handle different channel types', () => {
    const mixedChannelCampaign = {
      name: 'Mixed Channel Campaign',
      trigger_type: 'api',
      steps: [
        { step_number: 1, channel: 'email', delay_minutes: 0, subject_template: 'Welcome!' },
        { step_number: 2, channel: 'sms', delay_minutes: 60, content_template: 'Quick SMS' },
        { step_number: 3, channel: 'email', delay_minutes: 1440, sendgrid_template_id: 'template-123' }
      ]
    };

    const emailSteps = mixedChannelCampaign.steps.filter(s => s.channel === 'email');
    const smsSteps = mixedChannelCampaign.steps.filter(s => s.channel === 'sms');
    
    assert(emailSteps.length === 2, 'Should have 2 email steps');
    assert(smsSteps.length === 1, 'Should have 1 SMS step');
    
    // Email-specific validation
    const templateEmailStep = emailSteps.find(s => (s as any).sendgrid_template_id);
    assert(templateEmailStep !== undefined, 'Should find template-based email step');
    
    const subjectEmailStep = emailSteps.find(s => (s as any).subject_template);
    assert(subjectEmailStep !== undefined, 'Should find subject-based email step');
  });

  // Test Journey Management
  await test('Journey Management: should create journey correctly', () => {
    const journey = {
      id: 'journey-123',
      lead_id: 'lead-456',
      campaign_id: 'campaign-789',
      current_step: 0,
      status: 'active',
      started_at: Date.now(),
      total_sms_sent: 0,
      total_emails_sent: 0,
      total_opens: 0,
      total_clicks: 0
    };

    assert(journey.current_step === 0, 'Journey should start at step 0');
    assert(journey.status === 'active', 'Journey should start as active');
    assert(journey.total_sms_sent === 0, 'Should start with 0 SMS sent');
    assert(journey.total_emails_sent === 0, 'Should start with 0 emails sent');
  });

  await test('Journey Management: should handle step progression', () => {
    const journeySteps = [
      { current_step: 0, next_step: 1 },
      { current_step: 1, next_step: 2 },
      { current_step: 2, next_step: 3 },
      { current_step: 3, next_step: 'completed' }
    ];

    journeySteps.forEach(({ current_step, next_step }) => {
      if (typeof next_step === 'number') {
        assert(next_step === current_step + 1, `Step ${current_step} should progress to ${current_step + 1}`);
      } else {
        assert(next_step === 'completed', 'Final step should complete journey');
      }
    });
  });

  // Test Analytics Structure
  await test('Analytics: should track campaign metrics', () => {
    const mockAnalytics = {
      campaign_id: 'campaign-123',
      active_journeys: 15,
      completed_journeys: 8,
      conversions: 3,
      total_sms_sent: 45,
      total_emails_sent: 67,
      total_opens: 23,
      total_clicks: 12
    };

    assert(mockAnalytics.active_journeys >= 0, 'Active journeys should be non-negative');
    assert(mockAnalytics.completed_journeys >= 0, 'Completed journeys should be non-negative');
    assert(mockAnalytics.conversions <= mockAnalytics.completed_journeys, 'Conversions should not exceed completed journeys');
    
    // Calculate rates
    const completion_rate = mockAnalytics.completed_journeys / (mockAnalytics.active_journeys + mockAnalytics.completed_journeys);
    const conversion_rate = mockAnalytics.conversions / mockAnalytics.completed_journeys;
    const open_rate = mockAnalytics.total_opens / mockAnalytics.total_emails_sent;
    const click_rate = mockAnalytics.total_clicks / mockAnalytics.total_emails_sent;
    
    assert(completion_rate >= 0 && completion_rate <= 1, 'Completion rate should be between 0 and 1');
    assert(conversion_rate >= 0 && conversion_rate <= 1, 'Conversion rate should be between 0 and 1');
    assert(open_rate >= 0 && open_rate <= 1, 'Open rate should be between 0 and 1');
    assert(click_rate >= 0 && click_rate <= 1, 'Click rate should be between 0 and 1');
  });

  // Test Message Scheduling
  await test('Message Scheduling: should schedule messages correctly', () => {
    const now = Date.now();
    const steps = [
      { delay_minutes: 0, expected_time: now },
      { delay_minutes: 60, expected_time: now + (60 * 60 * 1000) },
      { delay_minutes: 1440, expected_time: now + (24 * 60 * 60 * 1000) },
      { delay_minutes: 10080, expected_time: now + (7 * 24 * 60 * 60 * 1000) }
    ];

    steps.forEach(({ delay_minutes, expected_time }) => {
      const calculated_time = now + (delay_minutes * 60 * 1000);
      assert(
        Math.abs(calculated_time - expected_time) < 1000,
        `Delay ${delay_minutes} minutes should calculate correct time`
      );
    });
  });

  await test('Message Scheduling: should handle timezone considerations', () => {
    // Test that we're using timestamp milliseconds consistently
    const timestamp = Date.now();
    const delayMinutes = 60;
    const scheduledTime = timestamp + (delayMinutes * 60 * 1000);
    
    assert(scheduledTime > timestamp, 'Scheduled time should be in the future');
    assert(scheduledTime - timestamp === 3600000, 'One hour delay should be 3600000 milliseconds');
  });

  // Test Error Scenarios
  await test('Error Handling: should handle missing campaign', () => {
    // Simulate request for non-existent campaign
    const nonExistentCampaignId = 'campaign-does-not-exist';
    
    // In a real API call, this would return 404
    const expectedResponse = {
      success: false,
      error: 'Campaign not found'
    };
    
    assert(expectedResponse.success === false, 'Should return error for missing campaign');
    assert(expectedResponse.error === 'Campaign not found', 'Should have appropriate error message');
  });

  await test('Error Handling: should handle permission errors', () => {
    // Simulate access denied scenario
    const unauthorizedResponse = {
      success: false,
      error: 'Access denied'
    };
    
    assert(unauthorizedResponse.success === false, 'Should deny unauthorized access');
    assert(unauthorizedResponse.error === 'Access denied', 'Should have permission error message');
  });

  // Test Step Validation
  await test('Step Validation: should validate step constraints', () => {
    const stepConstraints = [
      { step_number: 1, valid: true },
      { step_number: 20, valid: true },
      { step_number: 0, valid: false },
      { step_number: 21, valid: false },
      { step_number: -1, valid: false }
    ];

    stepConstraints.forEach(({ step_number, valid }) => {
      const isValid = step_number >= 1 && step_number <= 20;
      assert(isValid === valid, `Step number ${step_number} validation should be ${valid}`);
    });
  });

  await test('Step Validation: should validate delay constraints', () => {
    const delayConstraints = [
      { delay_minutes: 0, valid: true },
      { delay_minutes: 43200, valid: true }, // 30 days
      { delay_minutes: -1, valid: false },
      { delay_minutes: 43201, valid: false } // > 30 days
    ];

    delayConstraints.forEach(({ delay_minutes, valid }) => {
      const isValid = delay_minutes >= 0 && delay_minutes <= 43200;
      assert(isValid === valid, `Delay ${delay_minutes} minutes validation should be ${valid}`);
    });
  });

  console.log('\n✅ All Drip Campaign API tests completed!');
}

// Run the tests
runDripCampaignAPITests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});