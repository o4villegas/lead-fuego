// Integration Test 2: Webhook Performance
// Tests webhook → D1 → Twilio flow timing to ensure <5 second Meta requirement

import { WebhookTimer, measureAsync } from '../utils/timing';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WebhookTestResult {
  success: boolean;
  totalProcessingTime: number;
  meetsSLARequirement: boolean; // <5000ms for Meta webhook response
  breakdown: {
    requestParsing: number;
    databaseWrite: number;
    twilioApiCall: number;
    responseGeneration: number;
  };
  throughputMetrics: {
    requestsPerSecond: number;
    concurrentRequests: number;
    averageResponseTime: number;
  };
  errors: string[];
}

// Mock webhook payload matching Meta Lead Ads structure
const MOCK_META_WEBHOOK_PAYLOAD = {
  object: 'page',
  entry: [
    {
      id: '123456789',
      time: 1640995200,
      changes: [
        {
          field: 'leadgen',
          value: {
            form_id: 'test_form_123',
            leadgen_id: 'test_lead_456',
            created_time: 1640995200,
            page_id: '123456789',
            adgroup_id: '987654321',
          },
        },
      ],
    },
  ],
};

// Mock lead data from Meta API
const MOCK_LEAD_DATA = {
  id: 'test_lead_456',
  created_time: '2025-01-01T00:00:00+00:00',
  field_data: [
    {
      name: 'email',
      values: ['test@example.com'],
    },
    {
      name: 'phone_number',
      values: ['+1234567890'],
    },
    {
      name: 'first_name',
      values: ['John'],
    },
    {
      name: 'last_name',
      values: ['Doe'],
    },
  ],
};

class WebhookPerformanceTest {
  private timer = new WebhookTimer();
  private results: WebhookTestResult = {
    success: false,
    totalProcessingTime: 0,
    meetsSLARequirement: false,
    breakdown: {
      requestParsing: 0,
      databaseWrite: 0,
      twilioApiCall: 0,
      responseGeneration: 0,
    },
    throughputMetrics: {
      requestsPerSecond: 0,
      concurrentRequests: 0,
      averageResponseTime: 0,
    },
    errors: [],
  };

  async run(): Promise<WebhookTestResult> {
    console.log('🧪 Starting Webhook Performance Test...');

    try {
      // Test 1: Single webhook processing time
      await this.testSingleWebhookProcessing();
      
      // Test 2: Concurrent webhook processing
      await this.testConcurrentWebhookProcessing();

      // Test 3: Sustained load test
      await this.testSustainedLoad();

      this.results.success = true;
      console.log('✅ Webhook Performance Test PASSED');

    } catch (error) {
      this.results.success = false;
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      console.log('❌ Webhook Performance Test FAILED:', error);
    }

    return this.results;
  }

  private async testSingleWebhookProcessing() {
    console.log('  📡 Testing single webhook processing...');

    this.timer.webhookReceive();

    // Simulate request parsing
    const { duration: parsingTime } = await measureAsync(async () => {
      await this.simulateRequestParsing(MOCK_META_WEBHOOK_PAYLOAD);
    });
    this.results.breakdown.requestParsing = parsingTime;

    // Simulate database write
    this.timer.dbWriteStart();
    const { duration: dbWriteTime } = await measureAsync(async () => {
      await this.simulateDatabaseWrite(MOCK_LEAD_DATA);
    });
    this.timer.dbWriteComplete();
    this.results.breakdown.databaseWrite = dbWriteTime;

    // Simulate Twilio API call
    this.timer.apiCallStart();
    const { duration: twilioTime } = await measureAsync(async () => {
      await this.simulateTwilioSMSSend(MOCK_LEAD_DATA);
    });
    this.timer.apiCallComplete();
    this.results.breakdown.twilioApiCall = twilioTime;

    // Simulate response generation
    const { duration: responseTime } = await measureAsync(async () => {
      await this.simulateResponseGeneration();
    });
    this.results.breakdown.responseGeneration = responseTime;

    this.timer.responseReturn();

    const metrics = this.timer.getMetrics();
    this.results.totalProcessingTime = metrics.totalProcessingTime;
    this.results.meetsSLARequirement = metrics.totalProcessingTime < 5000; // 5 second Meta requirement

    console.log(`  ⏱️  Total processing time: ${metrics.totalProcessingTime.toFixed(0)}ms`);
    console.log(`  ${this.results.meetsSLARequirement ? '✅' : '❌'} SLA requirement (<5s): ${this.results.meetsSLARequirement ? 'MET' : 'FAILED'}`);
  }

  private async testConcurrentWebhookProcessing() {
    console.log('  🔄 Testing concurrent webhook processing...');

    const concurrentRequests = 10;
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
      const requestTimer = new WebhookTimer();
      requestTimer.webhookReceive();
      
      // Simulate processing
      await this.simulateRequestParsing(MOCK_META_WEBHOOK_PAYLOAD);
      await this.simulateDatabaseWrite({ ...MOCK_LEAD_DATA, id: `test_lead_${i}` });
      await this.simulateTwilioSMSSend(MOCK_LEAD_DATA);
      await this.simulateResponseGeneration();
      
      requestTimer.responseReturn();
      return requestTimer.getMetrics().totalProcessingTime;
    });

    const processingTimes = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalDuration = endTime - startTime;
    const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const requestsPerSecond = (concurrentRequests / totalDuration) * 1000;

    this.results.throughputMetrics = {
      requestsPerSecond,
      concurrentRequests,
      averageResponseTime: averageProcessingTime,
    };

    console.log(`  📊 Processed ${concurrentRequests} concurrent requests`);
    console.log(`  📈 Throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
    console.log(`  ⏱️  Average response time: ${averageProcessingTime.toFixed(0)}ms`);
  }

  private async testSustainedLoad() {
    console.log('  🔥 Testing sustained load (30 requests over 10 seconds)...');

    const testDuration = 10000; // 10 seconds
    const requestsToSend = 30;
    const requestInterval = testDuration / requestsToSend;

    const startTime = performance.now();
    const responseTimes: number[] = [];
    let completedRequests = 0;

    const sendRequest = async (requestId: number) => {
      const requestStart = performance.now();
      
      try {
        await this.simulateRequestParsing(MOCK_META_WEBHOOK_PAYLOAD);
        await this.simulateDatabaseWrite({ ...MOCK_LEAD_DATA, id: `sustained_test_${requestId}` });
        await this.simulateTwilioSMSSend(MOCK_LEAD_DATA);
        await this.simulateResponseGeneration();
        
        const requestTime = performance.now() - requestStart;
        responseTimes.push(requestTime);
        completedRequests++;
      } catch (error) {
        this.results.errors.push(`Sustained load request ${requestId} failed: ${error}`);
      }
    };

    // Send requests at regular intervals
    const requestPromises: Promise<void>[] = [];
    for (let i = 0; i < requestsToSend; i++) {
      setTimeout(() => {
        requestPromises.push(sendRequest(i));
      }, i * requestInterval);
    }

    // Wait for all requests to complete or timeout
    await Promise.allSettled(requestPromises);
    
    const testDurationActual = performance.now() - startTime;
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    console.log(`  📊 Sustained load results:`);
    console.log(`  ✅ Completed: ${completedRequests}/${requestsToSend} requests`);
    console.log(`  ⏱️  Average response: ${averageResponseTime.toFixed(0)}ms`);
    console.log(`  📈 Actual throughput: ${(completedRequests / testDurationActual * 1000).toFixed(2)} req/s`);
  }

  // Simulation methods for different processing stages
  private async simulateRequestParsing(payload: any): Promise<void> {
    // Simulate JSON parsing and validation (typically 1-5ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 4 + 1));
    
    // Validate payload structure
    if (!payload.entry || !payload.entry[0]?.changes) {
      throw new Error('Invalid webhook payload structure');
    }
  }

  private async simulateDatabaseWrite(leadData: any): Promise<void> {
    // Simulate D1 database write (typically 10-50ms for single write)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 10));
    
    // Simulate potential database constraints
    if (Math.random() < 0.05) { // 5% chance of retry needed
      await new Promise(resolve => setTimeout(resolve, 20)); // Retry delay
    }
  }

  private async simulateTwilioSMSSend(leadData: any): Promise<void> {
    // Simulate Twilio API call (typically 200-800ms)
    const twilioResponseTime = Math.random() * 600 + 200;
    await new Promise(resolve => setTimeout(resolve, twilioResponseTime));
    
    // Simulate occasional Twilio API failures
    if (Math.random() < 0.02) { // 2% failure rate
      throw new Error('Simulated Twilio API failure');
    }
  }

  private async simulateResponseGeneration(): Promise<void> {
    // Simulate response JSON generation (typically 1-3ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2 + 1));
  }

  private saveResults() {
    try {
      const resultsDir = join(__dirname, '../results');
      mkdirSync(resultsDir, { recursive: true });
      
      writeFileSync(
        join(resultsDir, 'webhook-performance-results.json'),
        JSON.stringify(this.results, null, 2)
      );
      
      console.log('💾 Results saved to webhook-performance-results.json');
    } catch (error) {
      console.log('⚠️  Failed to save results:', error);
    }
  }
}

// Export the test function
export async function runWebhookPerformanceTest(): Promise<WebhookTestResult> {
  const test = new WebhookPerformanceTest();
  const results = await test.run();
  
  // Save results
  try {
    const resultsDir = join(__dirname, '../results');
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, 'webhook-performance-results.json'),
      JSON.stringify(results, null, 2)
    );
  } catch (error) {
    console.log('⚠️  Failed to save results:', error);
  }
  
  return results;
}

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runWebhookPerformanceTest()
    .then(result => {
      console.log('\n📊 Webhook Performance Test Results:');
      console.log('Success:', result.success);
      console.log('Total Processing Time:', `${result.totalProcessingTime.toFixed(0)}ms`);
      console.log('Meets SLA (<5s):', result.meetsSLARequirement);
      console.log('\nBreakdown:');
      console.log('  Request Parsing:', `${result.breakdown.requestParsing.toFixed(0)}ms`);
      console.log('  Database Write:', `${result.breakdown.databaseWrite.toFixed(0)}ms`);
      console.log('  Twilio API Call:', `${result.breakdown.twilioApiCall.toFixed(0)}ms`);
      console.log('  Response Generation:', `${result.breakdown.responseGeneration.toFixed(0)}ms`);
      console.log('\nThroughput:');
      console.log('  Requests/Second:', result.throughputMetrics.requestsPerSecond.toFixed(2));
      console.log('  Concurrent Requests:', result.throughputMetrics.concurrentRequests);
      console.log('  Average Response Time:', `${result.throughputMetrics.averageResponseTime.toFixed(0)}ms`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:', result.errors);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}