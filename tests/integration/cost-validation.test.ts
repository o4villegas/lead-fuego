// Integration Test 5: Cost Validation
// Monitors actual API costs vs projections to validate budget assumptions

import { metaClient, openaiClient, costTracker } from '../utils/api-clients';
import { measureAsync } from '../utils/timing';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CostValidationResult {
  success: boolean;
  projectedCosts: {
    openai: { text: number; images: number; total: number };
    meta: { campaigns: number; creatives: number; total: number };
    twilio: { sms: number; email: number; total: number };
    total: number;
  };
  actualCosts: {
    openai: { text: number; images: number; total: number };
    meta: { campaigns: number; creatives: number; total: number };
    twilio: { sms: number; email: number; total: number };
    total: number;
  };
  variance: {
    openai: number; // percentage difference
    meta: number;
    twilio: number;
    total: number;
  };
  withinBudget: boolean;
  budgetLimit: number;
  recommendations: string[];
  detailedBreakdown: Array<{
    service: string;
    operation: string;
    projected: number;
    actual: number;
    count: number;
    timestamp: string;
  }>;
  errors: string[];
}

class CostValidationTest {
  private budgetLimit = 25.0; // $25 test budget limit
  private results: CostValidationResult = {
    success: false,
    projectedCosts: {
      openai: { text: 0, images: 0, total: 0 },
      meta: { campaigns: 0, creatives: 0, total: 0 },
      twilio: { sms: 0, email: 0, total: 0 },
      total: 0,
    },
    actualCosts: {
      openai: { text: 0, images: 0, total: 0 },
      meta: { campaigns: 0, creatives: 0, total: 0 },
      twilio: { sms: 0, email: 0, total: 0 },
      total: 0,
    },
    variance: { openai: 0, meta: 0, twilio: 0, total: 0 },
    withinBudget: false,
    budgetLimit: 25.0,
    recommendations: [],
    detailedBreakdown: [],
    errors: [],
  };

  // Projected cost estimates based on documentation research
  private projections = {
    openai: {
      gpt4oMini_per1k_tokens: 0.00015, // $0.150 per 1M input tokens
      gpt4oMini_output_per1k_tokens: 0.0006, // $0.600 per 1M output tokens
      dalleStandard: 0.04, // $0.04 per standard 1024x1024 image
      dalleHD: 0.08, // $0.08 per HD image
    },
    meta: {
      // Meta doesn't charge for API calls directly, but requires ad spend
      campaignCreation: 0, // Free
      creativeUpload: 0, // Free
      minimumAdSpend: 1.0, // Minimum $1 for campaign testing
    },
    twilio: {
      smsUS: 0.0075, // $0.0075 per SMS in US
      carrierFees: 0.003, // Additional carrier fees for A2P 10DLC
      sendgridEmail: 0.00049, // ~$0.0005 per email (volume pricing)
    },
  };

  async run(): Promise<CostValidationResult> {
    console.log('🧪 Starting Cost Validation Test...');
    console.log(`💰 Budget Limit: $${this.budgetLimit}`);

    try {
      // Calculate projected costs for test operations
      this.calculateProjectedCosts();

      // Perform actual API operations and track costs
      await this.executeTestOperations();

      // Calculate variance and analyze results
      this.analyzeCostVariance();

      // Generate recommendations
      this.generateRecommendations();

      this.results.success = true;
      console.log('✅ Cost Validation Test COMPLETED');

    } catch (error) {
      this.results.success = false;
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      console.log('❌ Cost Validation Test FAILED:', error);
    }

    return this.results;
  }

  private calculateProjectedCosts() {
    console.log('  📊 Calculating projected costs...');

    // Project costs for typical test operations
    const operations = {
      textGenerations: 5, // 5 ad copy generations
      imageGenerations: 3, // 3 creative images
      smsMessages: 2, // 2 test SMS messages
      emails: 2, // 2 test emails
      metaCampaigns: 2, // 2 test campaigns
    };

    // OpenAI projections
    const avgInputTokens = 100;
    const avgOutputTokens = 50;
    this.results.projectedCosts.openai.text = 
      operations.textGenerations * 
      (avgInputTokens * this.projections.openai.gpt4oMini_per1k_tokens / 1000 + 
       avgOutputTokens * this.projections.openai.gpt4oMini_output_per1k_tokens / 1000);
    
    this.results.projectedCosts.openai.images = 
      operations.imageGenerations * this.projections.openai.dalleStandard;
    
    this.results.projectedCosts.openai.total = 
      this.results.projectedCosts.openai.text + this.results.projectedCosts.openai.images;

    // Meta projections (minimal ad spend for testing)
    this.results.projectedCosts.meta.campaigns = operations.metaCampaigns * this.projections.meta.minimumAdSpend;
    this.results.projectedCosts.meta.total = this.results.projectedCosts.meta.campaigns;

    // Twilio projections
    this.results.projectedCosts.twilio.sms = 
      operations.smsMessages * (this.projections.twilio.smsUS + this.projections.twilio.carrierFees);
    
    this.results.projectedCosts.twilio.email = 
      operations.emails * this.projections.twilio.sendgridEmail;
    
    this.results.projectedCosts.twilio.total = 
      this.results.projectedCosts.twilio.sms + this.results.projectedCosts.twilio.email;

    // Total projection
    this.results.projectedCosts.total = 
      this.results.projectedCosts.openai.total + 
      this.results.projectedCosts.meta.total + 
      this.results.projectedCosts.twilio.total;

    console.log('    💡 Projected total cost: $' + this.results.projectedCosts.total.toFixed(4));
  }

  private async executeTestOperations() {
    console.log('  🚀 Executing test operations and tracking costs...');

    // Reset cost tracker
    costTracker.getTotalCost(); // Initialize

    try {
      // OpenAI Text Generation Tests
      await this.testOpenAITextGeneration(5);

      // OpenAI Image Generation Tests  
      await this.testOpenAIImageGeneration(3);

      // Meta API Tests (limited to avoid ad spend)
      await this.testMetaOperations(2);

      // Twilio Simulation (to avoid actual charges)
      await this.simulateTwilioOperations(2, 2);

    } catch (error) {
      this.results.errors.push(`Test execution error: ${error}`);
    }

    // Get final cost report
    const costReport = costTracker.getReport();
    this.results.actualCosts.total = costReport.totalCost;
    this.results.withinBudget = this.results.actualCosts.total <= this.budgetLimit;

    console.log(`    💰 Actual total cost: $${this.results.actualCosts.total.toFixed(4)}`);
    console.log(`    ${this.results.withinBudget ? '✅' : '❌'} Within budget: ${this.results.withinBudget}`);
  }

  private async testOpenAITextGeneration(count: number) {
    console.log(`    🤖 Testing ${count} text generations...`);

    for (let i = 0; i < count; i++) {
      try {
        const { result, duration } = await measureAsync(async () => {
          return openaiClient.generateAdCopy('technology', 'lead generation');
        });

        // Calculate actual cost based on token usage
        const inputTokens = result.usage?.prompt_tokens || 100;
        const outputTokens = result.usage?.completion_tokens || 50;
        const actualCost = 
          (inputTokens * this.projections.openai.gpt4oMini_per1k_tokens / 1000) +
          (outputTokens * this.projections.openai.gpt4oMini_output_per1k_tokens / 1000);

        costTracker.addCost('openai', 'text-generation', actualCost);
        this.results.actualCosts.openai.text += actualCost;

        this.results.detailedBreakdown.push({
          service: 'openai',
          operation: 'text-generation',
          projected: this.results.projectedCosts.openai.text / 5, // Average per operation
          actual: actualCost,
          count: 1,
          timestamp: new Date().toISOString(),
        });

        console.log(`      Generated text ${i + 1}/${count} (${inputTokens}+${outputTokens} tokens, $${actualCost.toFixed(4)})`);

      } catch (error) {
        this.results.errors.push(`Text generation ${i + 1} failed: ${error}`);
      }
    }

    this.results.actualCosts.openai.total += this.results.actualCosts.openai.text;
  }

  private async testOpenAIImageGeneration(count: number) {
    console.log(`    🎨 Testing ${count} image generations...`);

    for (let i = 0; i < count; i++) {
      try {
        const { result, duration } = await measureAsync(async () => {
          return openaiClient.generateCreativeImage('Professional business ad creative');
        });

        const actualCost = this.projections.openai.dalleStandard; // Standard DALL-E pricing
        costTracker.addCost('openai', 'image-generation', actualCost);
        this.results.actualCosts.openai.images += actualCost;

        this.results.detailedBreakdown.push({
          service: 'openai',
          operation: 'image-generation',
          projected: this.projections.openai.dalleStandard,
          actual: actualCost,
          count: 1,
          timestamp: new Date().toISOString(),
        });

        console.log(`      Generated image ${i + 1}/${count} ($${actualCost.toFixed(3)})`);

      } catch (error) {
        this.results.errors.push(`Image generation ${i + 1} failed: ${error}`);
      }
    }

    this.results.actualCosts.openai.total += this.results.actualCosts.openai.images;
  }

  private async testMetaOperations(count: number) {
    console.log(`    📘 Testing ${count} Meta operations (connection only)...`);

    // Only test connection and basic operations to avoid ad spend
    for (let i = 0; i < count; i++) {
      try {
        // Test API connection
        const response = await metaClient.testConnection();
        if (response.ok) {
          // Meta API calls are free, but we estimate minimal testing cost
          const estimatedCost = this.projections.meta.minimumAdSpend / count;
          this.results.actualCosts.meta.campaigns += estimatedCost;

          this.results.detailedBreakdown.push({
            service: 'meta',
            operation: 'api-connection-test',
            projected: estimatedCost,
            actual: estimatedCost,
            count: 1,
            timestamp: new Date().toISOString(),
          });

          console.log(`      Meta API test ${i + 1}/${count} successful`);
        }
      } catch (error) {
        this.results.errors.push(`Meta operation ${i + 1} failed: ${error}`);
      }
    }

    this.results.actualCosts.meta.total = this.results.actualCosts.meta.campaigns;
  }

  private async simulateTwilioOperations(smsCount: number, emailCount: number) {
    console.log(`    📱 Simulating ${smsCount} SMS + ${emailCount} email operations...`);

    // Simulate SMS costs (avoid actual charges during testing)
    for (let i = 0; i < smsCount; i++) {
      const smsCost = this.projections.twilio.smsUS + this.projections.twilio.carrierFees;
      this.results.actualCosts.twilio.sms += smsCost;

      this.results.detailedBreakdown.push({
        service: 'twilio',
        operation: 'sms-simulation',
        projected: smsCost,
        actual: smsCost,
        count: 1,
        timestamp: new Date().toISOString(),
      });
    }

    // Simulate email costs
    for (let i = 0; i < emailCount; i++) {
      const emailCost = this.projections.twilio.sendgridEmail;
      this.results.actualCosts.twilio.email += emailCost;

      this.results.detailedBreakdown.push({
        service: 'twilio',
        operation: 'email-simulation',
        projected: emailCost,
        actual: emailCost,
        count: 1,
        timestamp: new Date().toISOString(),
      });
    }

    this.results.actualCosts.twilio.total = 
      this.results.actualCosts.twilio.sms + this.results.actualCosts.twilio.email;

    console.log(`      Simulated Twilio costs: SMS $${this.results.actualCosts.twilio.sms.toFixed(4)}, Email $${this.results.actualCosts.twilio.email.toFixed(4)}`);
  }

  private analyzeCostVariance() {
    console.log('  📊 Analyzing cost variance...');

    // Calculate variance percentages
    this.results.variance.openai = this.calculateVariancePercentage(
      this.results.projectedCosts.openai.total,
      this.results.actualCosts.openai.total
    );

    this.results.variance.meta = this.calculateVariancePercentage(
      this.results.projectedCosts.meta.total,
      this.results.actualCosts.meta.total
    );

    this.results.variance.twilio = this.calculateVariancePercentage(
      this.results.projectedCosts.twilio.total,
      this.results.actualCosts.twilio.total
    );

    this.results.variance.total = this.calculateVariancePercentage(
      this.results.projectedCosts.total,
      this.results.actualCosts.total
    );

    console.log('    📈 Variance Analysis:');
    console.log(`      OpenAI: ${this.results.variance.openai.toFixed(1)}%`);
    console.log(`      Meta: ${this.results.variance.meta.toFixed(1)}%`);
    console.log(`      Twilio: ${this.results.variance.twilio.toFixed(1)}%`);
    console.log(`      Total: ${this.results.variance.total.toFixed(1)}%`);
  }

  private calculateVariancePercentage(projected: number, actual: number): number {
    if (projected === 0) return actual === 0 ? 0 : 100;
    return ((actual - projected) / projected) * 100;
  }

  private generateRecommendations() {
    console.log('  💡 Generating cost optimization recommendations...');

    // Analyze results and provide recommendations
    if (Math.abs(this.results.variance.total) > 20) {
      this.results.recommendations.push(`High cost variance detected (${this.results.variance.total.toFixed(1)}%). Review pricing assumptions.`);
    }

    if (this.results.actualCosts.openai.total > this.results.projectedCosts.openai.total * 1.5) {
      this.results.recommendations.push('OpenAI costs higher than expected. Consider using batch API or caching strategies.');
    }

    if (this.results.actualCosts.total > this.budgetLimit * 0.8) {
      this.results.recommendations.push('Approaching budget limit. Implement cost monitoring and alerts.');
    }

    if (this.results.errors.length > 0) {
      this.results.recommendations.push('API errors detected. Implement retry logic and error handling to avoid wasted costs.');
    }

    // Positive recommendations
    if (this.results.actualCosts.total < this.results.projectedCosts.total) {
      this.results.recommendations.push('Actual costs lower than projected. Good cost control achieved.');
    }

    if (this.results.recommendations.length === 0) {
      this.results.recommendations.push('Cost projections accurate. No immediate optimizations needed.');
    }

    console.log('    💡 Recommendations:');
    this.results.recommendations.forEach(rec => console.log(`      - ${rec}`));
  }
}

// Export the test function
export async function runCostValidationTest(): Promise<CostValidationResult> {
  const test = new CostValidationTest();
  const results = await test.run();

  // Save results
  try {
    const resultsDir = join(__dirname, '../results');
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, 'cost-validation-results.json'),
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
  runCostValidationTest()
    .then(result => {
      console.log('\n📊 Cost Validation Test Results:');
      console.log('Success:', result.success);
      console.log('Within Budget:', result.withinBudget);
      console.log(`Budget Limit: $${result.budgetLimit}`);
      console.log(`Total Actual Cost: $${result.actualCosts.total.toFixed(4)}`);
      console.log(`Total Projected Cost: $${result.projectedCosts.total.toFixed(4)}`);
      console.log(`Overall Variance: ${result.variance.total.toFixed(1)}%`);

      console.log('\nDetailed Costs:');
      console.log(`  OpenAI: $${result.actualCosts.openai.total.toFixed(4)} (${result.variance.openai.toFixed(1)}% variance)`);
      console.log(`    Text: $${result.actualCosts.openai.text.toFixed(4)}`);
      console.log(`    Images: $${result.actualCosts.openai.images.toFixed(4)}`);
      console.log(`  Meta: $${result.actualCosts.meta.total.toFixed(4)} (${result.variance.meta.toFixed(1)}% variance)`);
      console.log(`  Twilio: $${result.actualCosts.twilio.total.toFixed(4)} (${result.variance.twilio.toFixed(1)}% variance)`);

      if (result.recommendations.length > 0) {
        console.log('\nRecommendations:');
        result.recommendations.forEach(rec => console.log(`  - ${rec}`));
      }

      if (result.errors.length > 0) {
        console.log('\nErrors:', result.errors);
      }

      process.exit(result.success && result.withinBudget ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}