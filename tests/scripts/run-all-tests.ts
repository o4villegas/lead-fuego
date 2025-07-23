#!/usr/bin/env tsx
// Test Runner Script - Executes all integration tests and generates comprehensive report

import { runMetaCreativeUploadTest } from '../integration/meta-creative-upload.test';
import { runWebhookPerformanceTest } from '../integration/webhook-performance.test';
import { runD1ConcurrentWriteTest } from '../integration/d1-concurrent-writes.test';
import { runAPIFormatCompatibilityTest } from '../integration/api-format-compatibility.test';
import { runCostValidationTest } from '../integration/cost-validation.test';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestSuiteReport {
  executionTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallSuccess: boolean;
  confidence: number; // Percentage confidence in the development plan
  results: {
    metaCreativeUpload: any;
    webhookPerformance: any;
    d1ConcurrentWrites: any;
    apiFormatCompatibility: any;
    costValidation: any;
  };
  summary: {
    criticalIssuesFound: string[];
    performanceMetrics: {
      webhookProcessingTime: number;
      databaseConcurrency: number;
      apiCompatibility: boolean;
    };
    costAnalysis: {
      totalCost: number;
      withinBudget: boolean;
      variance: number;
    };
    recommendations: string[];
  };
  readmeUpdates: string[];
}

class TestSuiteRunner {
  private report: TestSuiteReport = {
    executionTime: 0,
    totalTests: 5,
    passedTests: 0,
    failedTests: 0,
    overallSuccess: false,
    confidence: 0,
    results: {
      metaCreativeUpload: null,
      webhookPerformance: null,
      d1ConcurrentWrites: null,
      apiFormatCompatibility: null,
      costValidation: null,
    },
    summary: {
      criticalIssuesFound: [],
      performanceMetrics: {
        webhookProcessingTime: 0,
        databaseConcurrency: 0,
        apiCompatibility: false,
      },
      costAnalysis: {
        totalCost: 0,
        withinBudget: false,
        variance: 0,
      },
      recommendations: [],
    },
    readmeUpdates: [],
  };

  async runAllTests(): Promise<TestSuiteReport> {
    console.log('🧪 ===============================================');
    console.log('🧪 LEADFUEGO INTEGRATION TEST SUITE');
    console.log('🧪 Testing critical API integrations');
    console.log('🧪 ===============================================\n');

    const startTime = performance.now();

    try {
      // Test 1: Meta Creative Upload
      console.log('🔶 TEST 1/5: Meta Creative Upload Integration');
      console.log('📝 Purpose: Validate DALL-E → Meta Creative API workflow\n');
      
      try {
        this.report.results.metaCreativeUpload = await runMetaCreativeUploadTest();
        if (this.report.results.metaCreativeUpload.success) {
          this.report.passedTests++;
          console.log('✅ PASSED: Meta Creative Upload Test\n');
        } else {
          this.report.failedTests++;
          console.log('❌ FAILED: Meta Creative Upload Test\n');
          this.report.summary.criticalIssuesFound.push('OpenAI DALL-E to Meta Creative upload incompatibility');
        }
      } catch (error) {
        this.report.failedTests++;
        console.log('💥 ERROR: Meta Creative Upload Test crashed:', error, '\n');
        this.report.summary.criticalIssuesFound.push('Meta Creative Upload test execution failure');
      }

      // Test 2: Webhook Performance
      console.log('🔶 TEST 2/5: Webhook Performance Timing');
      console.log('📝 Purpose: Ensure webhook → D1 → Twilio completes in <5 seconds\n');
      
      try {
        this.report.results.webhookPerformance = await runWebhookPerformanceTest();
        if (this.report.results.webhookPerformance.success) {
          this.report.passedTests++;
          console.log('✅ PASSED: Webhook Performance Test\n');
          this.report.summary.performanceMetrics.webhookProcessingTime = 
            this.report.results.webhookPerformance.totalProcessingTime;
        } else {
          this.report.failedTests++;
          console.log('❌ FAILED: Webhook Performance Test\n');
          this.report.summary.criticalIssuesFound.push('Webhook processing exceeds 5-second Meta requirement');
        }
      } catch (error) {
        this.report.failedTests++;
        console.log('💥 ERROR: Webhook Performance Test crashed:', error, '\n');
        this.report.summary.criticalIssuesFound.push('Webhook performance test execution failure');
      }

      // Test 3: D1 Concurrent Writes
      console.log('🔶 TEST 3/5: D1 Database Concurrent Writes');
      console.log('📝 Purpose: Test D1 performance under concurrent webhook load\n');
      
      try {
        this.report.results.d1ConcurrentWrites = await runD1ConcurrentWriteTest();
        if (this.report.results.d1ConcurrentWrites.success) {
          this.report.passedTests++;
          console.log('✅ PASSED: D1 Concurrent Writes Test\n');
          this.report.summary.performanceMetrics.databaseConcurrency = 
            this.report.results.d1ConcurrentWrites.concurrencyLevel;
        } else {
          this.report.failedTests++;
          console.log('❌ FAILED: D1 Concurrent Writes Test\n');
          this.report.summary.criticalIssuesFound.push('D1 database cannot handle concurrent webhook writes');
        }
      } catch (error) {
        this.report.failedTests++;
        console.log('💥 ERROR: D1 Concurrent Writes Test crashed:', error, '\n');
        this.report.summary.criticalIssuesFound.push('D1 concurrent writes test execution failure');
      }

      // Test 4: API Format Compatibility
      console.log('🔶 TEST 4/5: API Format Compatibility');
      console.log('📝 Purpose: Validate data format compatibility across all APIs\n');
      
      try {
        this.report.results.apiFormatCompatibility = await runAPIFormatCompatibilityTest();
        if (this.report.results.apiFormatCompatibility.success) {
          this.report.passedTests++;
          console.log('✅ PASSED: API Format Compatibility Test\n');
          this.report.summary.performanceMetrics.apiCompatibility = true;
        } else {
          this.report.failedTests++;
          console.log('❌ FAILED: API Format Compatibility Test\n');
          this.report.summary.criticalIssuesFound.push('API data format incompatibilities detected');
        }
      } catch (error) {
        this.report.failedTests++;
        console.log('💥 ERROR: API Format Compatibility Test crashed:', error, '\n');
        this.report.summary.criticalIssuesFound.push('API compatibility test execution failure');
      }

      // Test 5: Cost Validation
      console.log('🔶 TEST 5/5: Cost Validation');
      console.log('📝 Purpose: Validate actual API costs vs projections\n');
      
      try {
        this.report.results.costValidation = await runCostValidationTest();
        if (this.report.results.costValidation.success) {
          this.report.passedTests++;
          console.log('✅ PASSED: Cost Validation Test\n');
          this.report.summary.costAnalysis = {
            totalCost: this.report.results.costValidation.actualCosts.total,
            withinBudget: this.report.results.costValidation.withinBudget,
            variance: this.report.results.costValidation.variance.total,
          };
        } else {
          this.report.failedTests++;
          console.log('❌ FAILED: Cost Validation Test\n');
          this.report.summary.criticalIssuesFound.push('API costs exceed projections or budget');
        }
      } catch (error) {
        this.report.failedTests++;
        console.log('💥 ERROR: Cost Validation Test crashed:', error, '\n');
        this.report.summary.criticalIssuesFound.push('Cost validation test execution failure');
      }

      // Calculate final results
      this.report.executionTime = performance.now() - startTime;
      this.report.overallSuccess = this.report.passedTests === this.report.totalTests;
      this.calculateConfidenceLevel();
      this.generateRecommendations();
      this.generateReadmeUpdates();

      // Generate final report
      this.printFinalReport();
      this.saveReport();

    } catch (error) {
      console.error('💥 Test suite execution failed:', error);
      this.report.overallSuccess = false;
    }

    return this.report;
  }

  private calculateConfidenceLevel() {
    // Start with base confidence from passed tests
    let baseConfidence = (this.report.passedTests / this.report.totalTests) * 100;

    // Adjust based on critical findings
    if (this.report.summary.criticalIssuesFound.length === 0) {
      baseConfidence += 10; // Bonus for no critical issues
    }

    // Performance adjustments
    if (this.report.results.webhookPerformance?.meetsSLARequirement) {
      baseConfidence += 5; // Bonus for meeting webhook SLA
    }

    if (this.report.results.d1ConcurrentWrites?.lockContentionDetected) {
      baseConfidence -= 10; // Penalty for database contention
    }

    if (this.report.results.costValidation?.withinBudget) {
      baseConfidence += 5; // Bonus for cost control
    }

    // Cap at reasonable limits
    this.report.confidence = Math.min(Math.max(baseConfidence, 0), 100);
  }

  private generateRecommendations() {
    const recs = this.report.summary.recommendations;

    // Critical issues
    if (this.report.summary.criticalIssuesFound.length > 0) {
      recs.push('🚨 CRITICAL: Address all identified integration issues before development');
    }

    // Performance recommendations
    if (this.report.results.webhookPerformance?.totalProcessingTime > 3000) {
      recs.push('⚡ Optimize webhook processing for better response times');
    }

    if (this.report.results.d1ConcurrentWrites?.lockContentionDetected) {
      recs.push('🔒 Implement database write batching to reduce lock contention');
    }

    // Cost recommendations
    if (this.report.results.costValidation?.variance.total > 25) {
      recs.push('💰 Revise cost projections based on actual test results');
    }

    // Format compatibility
    const compatibilityResults = this.report.results.apiFormatCompatibility;
    if (compatibilityResults && !compatibilityResults.success) {
      recs.push('🔧 Implement data transformation layers for API compatibility');
    }

    // Positive recommendations
    if (this.report.confidence > 85) {
      recs.push('✅ Integration tests successful - proceed with development plan');
    } else if (this.report.confidence > 70) {
      recs.push('⚠️ Address identified issues then proceed with caution');
    } else {
      recs.push('❌ Major issues found - revise development plan before proceeding');
    }
  }

  private generateReadmeUpdates() {
    const updates = this.report.readmeUpdates;

    // Update confidence level in README
    updates.push(`Update "API Integration Risks" section confidence from 75% to ${this.report.confidence.toFixed(0)}%`);

    // Add specific findings
    if (this.report.results.webhookPerformance?.success) {
      updates.push(`Confirmed webhook processing time: ${this.report.summary.performanceMetrics.webhookProcessingTime.toFixed(0)}ms`);
    }

    if (this.report.results.costValidation?.success) {
      updates.push(`Actual cost validation: ${this.report.summary.costAnalysis.variance.toFixed(1)}% variance from projections`);
    }

    // Add new constraints discovered
    this.report.summary.criticalIssuesFound.forEach(issue => {
      updates.push(`Add constraint to README: ${issue}`);
    });

    // Update success metrics
    if (this.report.overallSuccess) {
      updates.push('Update README success criteria with validated metrics');
    }
  }

  private printFinalReport() {
    console.log('🧪 ===============================================');
    console.log('📊 FINAL TEST SUITE REPORT');
    console.log('🧪 ===============================================\n');

    console.log('📈 RESULTS SUMMARY:');
    console.log(`   Total Tests: ${this.report.totalTests}`);
    console.log(`   Passed: ${this.report.passedTests}`);
    console.log(`   Failed: ${this.report.failedTests}`);
    console.log(`   Overall Success: ${this.report.overallSuccess ? '✅ YES' : '❌ NO'}`);
    console.log(`   Execution Time: ${(this.report.executionTime / 1000).toFixed(1)}s`);
    console.log(`   Confidence Level: ${this.report.confidence.toFixed(0)}%\n`);

    if (this.report.summary.criticalIssuesFound.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      this.report.summary.criticalIssuesFound.forEach(issue => {
        console.log(`   - ${issue}`);
      });
      console.log('');
    }

    console.log('📊 PERFORMANCE METRICS:');
    console.log(`   Webhook Processing: ${this.report.summary.performanceMetrics.webhookProcessingTime.toFixed(0)}ms`);
    console.log(`   Database Concurrency: ${this.report.summary.performanceMetrics.databaseConcurrency} operations`);
    console.log(`   API Compatibility: ${this.report.summary.performanceMetrics.apiCompatibility ? '✅' : '❌'}\n`);

    console.log('💰 COST ANALYSIS:');
    console.log(`   Total Cost: $${this.report.summary.costAnalysis.totalCost.toFixed(4)}`);
    console.log(`   Within Budget: ${this.report.summary.costAnalysis.withinBudget ? '✅' : '❌'}`);
    console.log(`   Variance: ${this.report.summary.costAnalysis.variance.toFixed(1)}%\n`);

    if (this.report.summary.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      this.report.summary.recommendations.forEach(rec => {
        console.log(`   ${rec}`);
      });
      console.log('');
    }

    console.log('📝 README UPDATES NEEDED:');
    this.report.readmeUpdates.forEach(update => {
      console.log(`   - ${update}`);
    });

    console.log('\n🧪 ===============================================');
    console.log(`🎯 DEVELOPMENT PLAN CONFIDENCE: ${this.report.confidence.toFixed(0)}%`);
    console.log('🧪 ===============================================');
  }

  private saveReport() {
    try {
      const resultsDir = join(__dirname, '../results');
      mkdirSync(resultsDir, { recursive: true });

      // Save comprehensive JSON report
      writeFileSync(
        join(resultsDir, 'integration-test-suite-report.json'),
        JSON.stringify(this.report, null, 2)
      );

      // Save human-readable summary
      const summaryText = this.generateTextSummary();
      writeFileSync(
        join(resultsDir, 'integration-test-summary.md'),
        summaryText
      );

      console.log('\n💾 Reports saved to tests/results/');
      console.log('   - integration-test-suite-report.json');
      console.log('   - integration-test-summary.md');

    } catch (error) {
      console.log('⚠️ Failed to save reports:', error);
    }
  }

  private generateTextSummary(): string {
    const date = new Date().toISOString().split('T')[0];
    
    return `# LeadFuego Integration Test Results

**Date:** ${date}
**Execution Time:** ${(this.report.executionTime / 1000).toFixed(1)}s
**Overall Success:** ${this.report.overallSuccess ? '✅ PASSED' : '❌ FAILED'}
**Confidence Level:** ${this.report.confidence.toFixed(0)}%

## Test Results Summary

- **Total Tests:** ${this.report.totalTests}
- **Passed:** ${this.report.passedTests}
- **Failed:** ${this.report.failedTests}

${this.report.summary.criticalIssuesFound.length > 0 ? 
`## 🚨 Critical Issues Found

${this.report.summary.criticalIssuesFound.map(issue => `- ${issue}`).join('\n')}
` : ''}

## Performance Metrics

- **Webhook Processing Time:** ${this.report.summary.performanceMetrics.webhookProcessingTime.toFixed(0)}ms
- **Database Concurrency Level:** ${this.report.summary.performanceMetrics.databaseConcurrency} operations
- **API Compatibility:** ${this.report.summary.performanceMetrics.apiCompatibility ? '✅ Compatible' : '❌ Issues found'}

## Cost Analysis

- **Total Test Cost:** $${this.report.summary.costAnalysis.totalCost.toFixed(4)}
- **Within Budget:** ${this.report.summary.costAnalysis.withinBudget ? '✅ Yes' : '❌ No'}
- **Cost Variance:** ${this.report.summary.costAnalysis.variance.toFixed(1)}% from projections

## Recommendations

${this.report.summary.recommendations.map(rec => `- ${rec}`).join('\n')}

## README Updates Needed

${this.report.readmeUpdates.map(update => `- ${update}`).join('\n')}

---

**Next Steps:** ${this.report.confidence > 85 ? 'Proceed with development plan' : 
  this.report.confidence > 70 ? 'Address issues then proceed with caution' : 
  'Revise development plan before proceeding'}
`;
  }
}

// Main execution
async function main() {
  const runner = new TestSuiteRunner();
  const report = await runner.runAllTests();
  
  // Exit with appropriate code
  process.exit(report.overallSuccess ? 0 : 1);
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(error => {
    console.error('💥 Test suite execution failed:', error);
    process.exit(1);
  });
}

export { TestSuiteRunner };