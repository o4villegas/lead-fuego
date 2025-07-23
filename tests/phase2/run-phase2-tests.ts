// Phase 2 Test Suite Runner
// Orchestrates all Phase 2 integration tests

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

// Import test suites
import { Phase2APITest } from './phase2-api.test.js';
import { AIServicesTest } from './ai-services.test.js';
import { MetaAPITest } from './meta-api.test.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
config({ path: join(__dirname, '../config/test.env') });

interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
  criticalIssues: string[];
  configured: boolean;
  cost?: number;
}

interface Phase2Results {
  overall: {
    success: boolean;
    totalPassed: number;
    totalFailed: number;
    totalDuration: number;
    totalCost: number;
    criticalIssues: string[];
    timestamp: string;
  };
  suites: TestSuiteResult[];
  recommendations: string[];
}

class Phase2TestRunner {
  private results: Phase2Results = {
    overall: {
      success: false,
      totalPassed: 0,
      totalFailed: 0,
      totalDuration: 0,
      totalCost: 0,
      criticalIssues: [],
      timestamp: new Date().toISOString()
    },
    suites: [],
    recommendations: []
  };

  async runAllTests(): Promise<Phase2Results> {
    console.log('🚀 PHASE 2 COMPREHENSIVE TEST SUITE');
    console.log('====================================');
    console.log(`Started: ${this.results.overall.timestamp}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: ${process.env.TEST_API_URL || 'http://localhost:8787'}\n`);

    const overallStartTime = Date.now();

    // Run test suites in sequence
    await this.runAPITests();
    await this.runAITests();
    await this.runMetaAPITests();

    // Calculate overall results
    this.results.overall.totalDuration = Date.now() - overallStartTime;
    this.results.overall.totalPassed = this.results.suites.reduce((sum, suite) => sum + suite.passed, 0);
    this.results.overall.totalFailed = this.results.suites.reduce((sum, suite) => sum + suite.failed, 0);
    this.results.overall.totalCost = this.results.suites.reduce((sum, suite) => sum + (suite.cost || 0), 0);
    this.results.overall.success = this.results.overall.totalFailed === 0 && this.results.overall.criticalIssues.length === 0;

    // Generate recommendations
    this.generateRecommendations();

    // Display final results
    this.displayResults();

    // Save results
    this.saveResults();

    return this.results;
  }

  private async runAPITests() {
    console.log('🌐 Running API Integration Tests...\n');
    const startTime = Date.now();

    try {
      const apiTest = new Phase2APITest();
      const apiResults = await apiTest.runAllTests();

      this.results.suites.push({
        name: 'API Integration',
        passed: apiResults.passed,
        failed: apiResults.failed,
        duration: Date.now() - startTime,
        criticalIssues: apiResults.criticalIssues,
        configured: true
      });

      // Add critical issues to overall
      this.results.overall.criticalIssues.push(...apiResults.criticalIssues);

    } catch (error) {
      console.error('❌ API tests failed to execute:', error);
      this.results.suites.push({
        name: 'API Integration',
        passed: 0,
        failed: 1,
        duration: Date.now() - startTime,
        criticalIssues: ['API test suite execution failed'],
        configured: true
      });
      this.results.overall.criticalIssues.push('API test suite execution failed');
    }

    console.log('');
  }

  private async runAITests() {
    console.log('🤖 Running AI Services Tests...\n');
    const startTime = Date.now();

    try {
      const aiTest = new AIServicesTest();
      const aiResults = await aiTest.runAllTests();

      this.results.suites.push({
        name: 'AI Services',
        passed: aiResults.passed,
        failed: aiResults.failed,
        duration: Date.now() - startTime,
        criticalIssues: [],
        configured: true,
        cost: aiResults.totalCost
      });

      // Check for AI-specific issues
      const invalidResults = aiResults.results.filter(r => 
        !r.validationResults.lengthValid || !r.validationResults.contentValid
      );
      
      if (invalidResults.length > 0) {
        const issues = invalidResults.map(r => `${r.service} ${r.model}: validation failed`);
        this.results.overall.criticalIssues.push(...issues);
      }

    } catch (error) {
      console.error('❌ AI tests failed to execute:', error);
      this.results.suites.push({
        name: 'AI Services',
        passed: 0,
        failed: 1,
        duration: Date.now() - startTime,
        criticalIssues: ['AI test suite execution failed'],
        configured: false
      });
      this.results.overall.criticalIssues.push('AI test suite execution failed');
    }

    console.log('');
  }

  private async runMetaAPITests() {
    console.log('📊 Running Meta API Tests...\n');
    const startTime = Date.now();

    try {
      const metaTest = new MetaAPITest();
      const metaResults = await metaTest.runAllTests();

      this.results.suites.push({
        name: 'Meta API',
        passed: metaResults.passed,
        failed: metaResults.failed,
        duration: Date.now() - startTime,
        criticalIssues: [],
        configured: metaResults.configured
      });

      if (!metaResults.configured) {
        this.results.overall.criticalIssues.push('Meta API credentials not configured');
      }

      // Check for critical Meta API failures
      const criticalFailures = metaResults.results.filter(r => 
        !r.success && ['Validate Meta API credentials', 'Create test campaign'].includes(r.operation)
      );
      
      if (criticalFailures.length > 0) {
        const issues = criticalFailures.map(f => `Meta API: ${f.operation} failed - ${f.error}`);
        this.results.overall.criticalIssues.push(...issues);
      }

    } catch (error) {
      console.error('❌ Meta API tests failed to execute:', error);
      this.results.suites.push({
        name: 'Meta API',
        passed: 0,
        failed: 1,
        duration: Date.now() - startTime,
        criticalIssues: ['Meta API test suite execution failed'],
        configured: false
      });
      this.results.overall.criticalIssues.push('Meta API test suite execution failed');
    }

    console.log('');
  }

  private generateRecommendations() {
    const recommendations: string[] = [];

    // Success rate analysis
    const successRate = this.results.overall.totalPassed / (this.results.overall.totalPassed + this.results.overall.totalFailed);
    
    if (successRate >= 0.95) {
      recommendations.push('✅ Excellent test coverage - Phase 2 ready for production');
    } else if (successRate >= 0.80) {
      recommendations.push('⚠️  Good test coverage - address failing tests before production');
    } else {
      recommendations.push('🚨 Poor test coverage - significant issues need resolution');
    }

    // Cost analysis
    if (this.results.overall.totalCost > 0.50) {
      recommendations.push('💰 High test costs detected - consider optimizing AI usage in production');
    } else if (this.results.overall.totalCost > 0) {
      recommendations.push('💡 AI costs within acceptable range for testing');
    }

    // Configuration checks
    const unconfiguredSuites = this.results.suites.filter(s => !s.configured);
    if (unconfiguredSuites.length > 0) {
      recommendations.push(`🔧 Configure missing services: ${unconfiguredSuites.map(s => s.name).join(', ')}`);
    }

    // Performance analysis
    if (this.results.overall.totalDuration > 30000) {
      recommendations.push('⏱️  Tests taking longer than 30s - consider parallel execution');
    }

    // Critical issues
    if (this.results.overall.criticalIssues.length > 0) {
      recommendations.push('🚨 CRITICAL: Resolve all critical issues before proceeding to Phase 3');
    } else {
      recommendations.push('🎯 No critical issues detected - Phase 2 implementation solid');
    }

    this.results.recommendations = recommendations;
  }

  private displayResults() {
    console.log('📊 PHASE 2 TEST RESULTS SUMMARY');
    console.log('===============================\n');

    // Overall status
    const statusEmoji = this.results.overall.success ? '✅' : '❌';
    console.log(`${statusEmoji} Overall Status: ${this.results.overall.success ? 'PASSED' : 'FAILED'}`);
    console.log(`📈 Total Tests: ${this.results.overall.totalPassed + this.results.overall.totalFailed}`);
    console.log(`✅ Passed: ${this.results.overall.totalPassed}`);
    console.log(`❌ Failed: ${this.results.overall.totalFailed}`);
    console.log(`⏱️  Duration: ${(this.results.overall.totalDuration / 1000).toFixed(1)}s`);
    console.log(`💰 Total Cost: $${this.results.overall.totalCost.toFixed(5)}\n`);

    // Suite breakdown
    console.log('📋 Test Suite Breakdown:');
    console.log('-----------------------');
    this.results.suites.forEach(suite => {
      const status = suite.failed === 0 ? '✅' : '❌';
      const config = suite.configured ? '🔧' : '⚠️ ';
      console.log(`${status} ${config} ${suite.name}: ${suite.passed}/${suite.passed + suite.failed} passed (${(suite.duration / 1000).toFixed(1)}s)`);
      if (suite.cost && suite.cost > 0) {
        console.log(`   💰 Cost: $${suite.cost.toFixed(5)}`);
      }
    });

    // Critical issues
    if (this.results.overall.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      console.log('------------------');
      this.results.overall.criticalIssues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-------------------');
    this.results.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    console.log('\n');
  }

  private saveResults() {
    try {
      const resultsDir = join(__dirname, '../results');
      mkdirSync(resultsDir, { recursive: true });
      
      // Save detailed JSON results
      writeFileSync(
        join(resultsDir, 'phase2-test-results.json'),
        JSON.stringify(this.results, null, 2)
      );

      // Save markdown summary
      const markdownReport = this.generateMarkdownReport();
      writeFileSync(
        join(resultsDir, 'phase2-test-summary.md'),
        markdownReport
      );

      console.log(`📄 Results saved to: ${resultsDir}`);
    } catch (error) {
      console.error('⚠️  Failed to save results:', error);
    }
  }

  private generateMarkdownReport(): string {
    const timestamp = new Date().toISOString();
    const successRate = ((this.results.overall.totalPassed / (this.results.overall.totalPassed + this.results.overall.totalFailed)) * 100).toFixed(1);

    return `# Phase 2 Test Results

**Date:** ${timestamp.split('T')[0]}
**Execution Time:** ${(this.results.overall.totalDuration / 1000).toFixed(1)}s
**Overall Status:** ${this.results.overall.success ? '✅ PASSED' : '❌ FAILED'}
**Success Rate:** ${successRate}%

## Test Results Summary

- **Total Tests:** ${this.results.overall.totalPassed + this.results.overall.totalFailed}
- **Passed:** ${this.results.overall.totalPassed}
- **Failed:** ${this.results.overall.totalFailed}
- **Total Cost:** $${this.results.overall.totalCost.toFixed(5)}

## Suite Results

${this.results.suites.map(suite => {
  const status = suite.failed === 0 ? '✅' : '❌';
  const config = suite.configured ? 'Configured' : 'Not Configured';
  return `- **${suite.name}:** ${status} ${suite.passed}/${suite.passed + suite.failed} (${config})`;
}).join('\n')}

${this.results.overall.criticalIssues.length > 0 ? `## 🚨 Critical Issues

${this.results.overall.criticalIssues.map(issue => `- ${issue}`).join('\n')}
` : ''}

## Recommendations

${this.results.recommendations.map(rec => `- ${rec}`).join('\n')}

---

**Next Steps:** ${this.results.overall.success ? 'Proceed to Phase 3' : 'Address critical issues before continuing'}
`;
  }
}

// Self-executing when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const runner = new Phase2TestRunner();
  runner.runAllTests()
    .then(results => {
      process.exit(results.overall.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner execution failed:', error);
      process.exit(1);
    });
}

export { Phase2TestRunner, Phase2Results };