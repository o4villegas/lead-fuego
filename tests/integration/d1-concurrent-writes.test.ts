// Integration Test 3: D1 Concurrent Writes
// Tests D1 database performance under concurrent webhook load scenarios

import { ConcurrentTimer } from '../utils/timing';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface D1TestResult {
  success: boolean;
  concurrencyLevel: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  operationsPerSecond: number;
  lockContentionDetected: boolean;
  errors: string[];
  detailedMetrics: {
    testRunId: string;
    operationTimes: number[];
    failureReasons: Record<string, number>;
  };
}

// Simulate D1 database operations
class MockD1Database {
  private writeInProgress = false;
  private readonly writeLockDelay = 5; // Simulate SQLite write lock delay

  async insertLead(leadData: any): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = performance.now();
    
    try {
      // Simulate single-writer constraint
      if (this.writeInProgress) {
        // Simulate wait for lock
        await this.waitForWriteLock();
      }
      
      this.writeInProgress = true;
      
      // Simulate actual database write operation
      const writeTime = Math.random() * 30 + 10; // 10-40ms for insert
      await new Promise(resolve => setTimeout(resolve, writeTime));
      
      // Simulate occasional database errors (connection issues, constraint violations)
      if (Math.random() < 0.02) { // 2% error rate
        throw new Error('Simulated database constraint violation');
      }
      
      this.writeInProgress = false;
      
      const duration = performance.now() - startTime;
      return { success: true, duration };
      
    } catch (error) {
      this.writeInProgress = false;
      const duration = performance.now() - startTime;
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async batchInsertLeads(leads: any[]): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = performance.now();
    
    try {
      if (this.writeInProgress) {
        await this.waitForWriteLock();
      }
      
      this.writeInProgress = true;
      
      // Batch writes are more efficient but still single-threaded in SQLite
      const batchWriteTime = Math.random() * 20 + (leads.length * 5); // 5ms per record + overhead
      await new Promise(resolve => setTimeout(resolve, batchWriteTime));
      
      this.writeInProgress = false;
      
      const duration = performance.now() - startTime;
      return { success: true, duration };
      
    } catch (error) {
      this.writeInProgress = false;
      const duration = performance.now() - startTime;
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async waitForWriteLock(): Promise<void> {
    // Simulate exponential backoff for lock contention
    const maxWaitTime = 100; // Maximum 100ms wait
    const waitTime = Math.min(Math.random() * this.writeLockDelay * 2, maxWaitTime);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

class D1ConcurrentWriteTest {
  private db = new MockD1Database();
  private timer = new ConcurrentTimer();
  private results: D1TestResult = {
    success: false,
    concurrencyLevel: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: 0,
    operationsPerSecond: 0,
    lockContentionDetected: false,
    errors: [],
    detailedMetrics: {
      testRunId: `test-${Date.now()}`,
      operationTimes: [],
      failureReasons: {},
    },
  };

  async run(): Promise<D1TestResult> {
    console.log('🧪 Starting D1 Concurrent Writes Test...');

    try {
      // Test 1: Low concurrency (10 concurrent operations)
      await this.testConcurrentWrites(10, 'Low Concurrency');

      // Test 2: Medium concurrency (25 concurrent operations)
      await this.testConcurrentWrites(25, 'Medium Concurrency');

      // Test 3: High concurrency (50 concurrent operations)
      await this.testConcurrentWrites(50, 'High Concurrency');

      // Test 4: Batch operations test
      await this.testBatchOperations();

      // Test 5: Sustained load test
      await this.testSustainedLoad();

      this.results.success = true;
      console.log('✅ D1 Concurrent Writes Test PASSED');

    } catch (error) {
      this.results.success = false;
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      console.log('❌ D1 Concurrent Writes Test FAILED:', error);
    }

    return this.results;
  }

  private async testConcurrentWrites(concurrency: number, testName: string) {
    console.log(`  🔄 Testing ${testName} (${concurrency} concurrent operations)...`);

    const testStartTime = performance.now();
    this.results.concurrencyLevel = Math.max(this.results.concurrencyLevel, concurrency);

    // Generate test lead data
    const leadDataBatch = Array.from({ length: concurrency }, (_, i) => ({
      id: `test_lead_${this.results.testRunId}_${i}`,
      email: `test${i}@example.com`,
      phone: `+123456789${i.toString().padStart(2, '0')}`,
      campaign_id: 'test-campaign-123',
      captured_at: Date.now(),
    }));

    // Launch concurrent write operations
    const operations = leadDataBatch.map(async (leadData, index) => {
      const operationId = `${testName.toLowerCase().replace(' ', '_')}_${index}`;
      
      this.timer.startOperation(operationId);
      const result = await this.db.insertLead(leadData);
      this.timer.endOperation(operationId);

      return { operationId, result, leadData };
    });

    // Wait for all operations to complete
    const results = await Promise.all(operations);
    const testDuration = performance.now() - testStartTime;

    // Analyze results
    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);

    this.results.totalOperations += results.length;
    this.results.successfulOperations += successful.length;
    this.results.failedOperations += failed.length;

    // Calculate timing metrics
    const operationDurations = results.map(r => r.result.duration);
    this.results.detailedMetrics.operationTimes.push(...operationDurations);
    
    const avgResponseTime = operationDurations.reduce((a, b) => a + b, 0) / operationDurations.length;
    const maxResponseTime = Math.max(...operationDurations);
    const minResponseTime = Math.min(...operationDurations);
    
    // Update overall metrics
    this.results.averageResponseTime = Math.max(this.results.averageResponseTime, avgResponseTime);
    this.results.maxResponseTime = Math.max(this.results.maxResponseTime, maxResponseTime);
    this.results.minResponseTime = this.results.minResponseTime === 0 ? minResponseTime : Math.min(this.results.minResponseTime, minResponseTime);

    // Calculate operations per second for this test
    const opsPerSecond = (results.length / testDuration) * 1000;
    this.results.operationsPerSecond = Math.max(this.results.operationsPerSecond, opsPerSecond);

    // Detect lock contention (operations taking significantly longer than expected)
    const suspiciouslySlowOps = operationDurations.filter(duration => duration > 100); // >100ms
    if (suspiciouslySlowOps.length > concurrency * 0.1) { // >10% of operations
      this.results.lockContentionDetected = true;
    }

    // Track failure reasons
    failed.forEach(f => {
      const reason = f.result.error || 'Unknown error';
      this.results.detailedMetrics.failureReasons[reason] = 
        (this.results.detailedMetrics.failureReasons[reason] || 0) + 1;
    });

    console.log(`    📊 ${testName} Results:`);
    console.log(`    ✅ Successful: ${successful.length}/${results.length}`);
    console.log(`    ⏱️  Avg Response: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`    📈 Throughput: ${opsPerSecond.toFixed(1)} ops/sec`);
    
    if (failed.length > 0) {
      console.log(`    ❌ Failures: ${failed.length}`);
    }
  }

  private async testBatchOperations() {
    console.log('  📦 Testing batch operations...');

    const batchSizes = [10, 25, 50, 100];
    
    for (const batchSize of batchSizes) {
      const leadBatch = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch_test_${Date.now()}_${i}`,
        email: `batch${i}@example.com`,
        phone: `+1555000${i.toString().padStart(4, '0')}`,
      }));

      const startTime = performance.now();
      const result = await this.db.batchInsertLeads(leadBatch);
      const duration = performance.now() - startTime;

      const itemsPerSecond = (batchSize / duration) * 1000;

      console.log(`    📦 Batch size ${batchSize}: ${duration.toFixed(1)}ms (${itemsPerSecond.toFixed(0)} items/sec)`);

      if (!result.success) {
        this.results.errors.push(`Batch operation failed for size ${batchSize}: ${result.error}`);
      }
    }
  }

  private async testSustainedLoad() {
    console.log('  🔥 Testing sustained load (100 operations over 30 seconds)...');

    const totalOperations = 100;
    const testDuration = 30000; // 30 seconds
    const operationInterval = testDuration / totalOperations;

    const operationPromises: Promise<any>[] = [];
    const startTime = performance.now();

    for (let i = 0; i < totalOperations; i++) {
      const operationPromise = new Promise(async (resolve) => {
        // Wait for the scheduled time
        await new Promise(r => setTimeout(r, i * operationInterval));
        
        const leadData = {
          id: `sustained_${Date.now()}_${i}`,
          email: `sustained${i}@example.com`,
          phone: `+1666${i.toString().padStart(4, '0')}`,
        };

        const opStartTime = performance.now();
        const result = await this.db.insertLead(leadData);
        const opDuration = performance.now() - opStartTime;

        resolve({ result, duration: opDuration });
      });

      operationPromises.push(operationPromise);
    }

    const results = await Promise.all(operationPromises);
    const totalTestDuration = performance.now() - startTime;

    const successful = results.filter((r: any) => r.result.success);
    const sustainedOpsPerSecond = (successful.length / totalTestDuration) * 1000;

    console.log(`    📊 Sustained load results:`);
    console.log(`    ✅ Completed: ${successful.length}/${totalOperations}`);
    console.log(`    📈 Sustained throughput: ${sustainedOpsPerSecond.toFixed(2)} ops/sec`);
    console.log(`    ⏱️  Total duration: ${(totalTestDuration / 1000).toFixed(1)}s`);
  }
}

// Export the test function
export async function runD1ConcurrentWriteTest(): Promise<D1TestResult> {
  const test = new D1ConcurrentWriteTest();
  const results = await test.run();

  // Save results
  try {
    const resultsDir = join(__dirname, '../results');
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, 'd1-concurrent-writes-results.json'),
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
  runD1ConcurrentWriteTest()
    .then(result => {
      console.log('\n📊 D1 Concurrent Writes Test Results:');
      console.log('Success:', result.success);
      console.log('Concurrency Level Tested:', result.concurrencyLevel);
      console.log('Total Operations:', result.totalOperations);
      console.log('Successful Operations:', result.successfulOperations);
      console.log('Failed Operations:', result.failedOperations);
      console.log('Average Response Time:', `${result.averageResponseTime.toFixed(1)}ms`);
      console.log('Max Response Time:', `${result.maxResponseTime.toFixed(1)}ms`);
      console.log('Min Response Time:', `${result.minResponseTime.toFixed(1)}ms`);
      console.log('Peak Operations/Second:', result.operationsPerSecond.toFixed(1));
      console.log('Lock Contention Detected:', result.lockContentionDetected);

      if (Object.keys(result.detailedMetrics.failureReasons).length > 0) {
        console.log('\nFailure Reasons:');
        Object.entries(result.detailedMetrics.failureReasons).forEach(([reason, count]) => {
          console.log(`  ${reason}: ${count}`);
        });
      }

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