// Integration Test 1: Meta Creative Upload
// Tests if OpenAI DALL-E generated images can be uploaded to Meta Creative API

import { metaClient, openaiClient, costTracker } from '../utils/api-clients';
import { PerformanceTimer, measureAsync } from '../utils/timing';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  success: boolean;
  duration: number;
  costs: {
    openai: number;
    meta: number;
  };
  details: {
    imageGenerated: boolean;
    imageUploaded: boolean;
    creativeCreated: boolean;
    errors?: string[];
  };
  metadata: {
    imageUrl?: string;
    imageHash?: string;
    creativeId?: string;
    campaignId?: string;
  };
}

class MetaCreativeUploadTest {
  private timer = new PerformanceTimer();
  private results: TestResult = {
    success: false,
    duration: 0,
    costs: { openai: 0, meta: 0 },
    details: {
      imageGenerated: false,
      imageUploaded: false,
      creativeCreated: false,
      errors: [],
    },
    metadata: {},
  };

  async run(): Promise<TestResult> {
    console.log('🧪 Starting Meta Creative Upload Test...');
    
    try {
      this.timer.start();

      // Step 1: Test Meta API connection
      await this.testMetaConnection();
      this.timer.mark('meta-connection');

      // Step 2: Create test campaign
      const campaignId = await this.createTestCampaign();
      this.timer.mark('campaign-created');

      // Step 3: Generate image with OpenAI DALL-E
      const imageUrl = await this.generateTestImage();
      this.timer.mark('image-generated');

      // Step 4: Generate ad copy
      const adCopy = await this.generateAdCopy();
      this.timer.mark('copy-generated');

      // Step 5: Upload image to Meta and create creative
      const creativeId = await this.uploadCreativeToMeta(campaignId, imageUrl, adCopy);
      this.timer.mark('creative-uploaded');

      // Step 6: Cleanup
      await this.cleanup(campaignId);
      this.timer.mark('cleanup-complete');

      this.timer.end();
      this.results.success = true;
      this.results.duration = this.timer.getDuration();

      console.log('✅ Meta Creative Upload Test PASSED');
      return this.results;

    } catch (error) {
      this.timer.end();
      this.results.success = false;
      this.results.duration = this.timer.getDuration();
      this.results.details.errors?.push(error instanceof Error ? error.message : String(error));

      console.log('❌ Meta Creative Upload Test FAILED:', error);
      return this.results;
    }
  }

  private async testMetaConnection() {
    console.log('  📡 Testing Meta API connection...');
    
    const response = await metaClient.testConnection();
    if (!response.ok) {
      throw new Error(`Meta API connection failed: ${await response.text()}`);
    }

    const accountData = await response.json();
    console.log(`  ✅ Connected to Meta Ad Account: ${accountData.name || accountData.id}`);
  }

  private async createTestCampaign(): Promise<string> {
    console.log('  📝 Creating test campaign...');
    
    const campaignName = `Test Campaign - Creative Upload - ${Date.now()}`;
    const response = await metaClient.createTestCampaign(campaignName);

    if (!response.ok) {
      throw new Error(`Failed to create campaign: ${await response.text()}`);
    }

    const campaignData = await response.json();
    const campaignId = campaignData.id;
    
    this.results.metadata.campaignId = campaignId;
    console.log(`  ✅ Created campaign: ${campaignId}`);
    
    return campaignId;
  }

  private async generateTestImage(): Promise<string> {
    console.log('  🎨 Generating test image with DALL-E...');
    
    const prompt = 'Professional business advertisement with modern clean design, corporate blue and white colors, minimalist style, suitable for Facebook advertising';
    
    const { result: imageData, duration } = await measureAsync(async () => {
      return openaiClient.generateCreativeImage(prompt);
    });

    // Track OpenAI costs (DALL-E 3 standard: ~$0.04)
    costTracker.addCost('openai', 'dall-e-3-generation', 0.04);
    this.results.costs.openai += 0.04;

    const imageUrl = imageData.data[0].url;
    this.results.metadata.imageUrl = imageUrl;
    this.results.details.imageGenerated = true;

    console.log(`  ✅ Generated image in ${duration.toFixed(0)}ms: ${imageUrl}`);
    
    // Save image URL for later inspection
    this.saveTestArtifact('generated-image-url.txt', imageUrl);

    return imageUrl;
  }

  private async generateAdCopy(): Promise<string> {
    console.log('  ✍️  Generating ad copy...');
    
    const { result: copyData } = await measureAsync(async () => {
      return openaiClient.generateAdCopy('technology', 'lead generation');
    });

    // Track OpenAI costs (GPT-4o-mini: ~$0.001)
    costTracker.addCost('openai', 'gpt-4o-mini-completion', 0.001);
    this.results.costs.openai += 0.001;

    const adCopy = copyData.choices[0].message.content;
    console.log(`  ✅ Generated ad copy: "${adCopy}"`);

    return adCopy;
  }

  private async uploadCreativeToMeta(campaignId: string, imageUrl: string, message: string): Promise<string> {
    console.log('  📤 Uploading creative to Meta...');
    
    const { result: creativeData, duration } = await measureAsync(async () => {
      return metaClient.uploadCreative(campaignId, imageUrl, message);
    });

    if (!creativeData.ok) {
      throw new Error(`Failed to upload creative: ${await creativeData.text()}`);
    }

    const creativeResult = await creativeData.json();
    const creativeId = creativeResult.id;
    
    this.results.metadata.creativeId = creativeId;
    this.results.details.imageUploaded = true;
    this.results.details.creativeCreated = true;

    console.log(`  ✅ Created creative in ${duration.toFixed(0)}ms: ${creativeId}`);

    return creativeId;
  }

  private async cleanup(campaignId: string) {
    console.log('  🧹 Cleaning up test resources...');
    
    try {
      // Delete test campaign (this will also clean up associated creatives)
      const response = await metaClient.cleanupTestCampaign(campaignId);
      if (response.ok) {
        console.log('  ✅ Cleanup completed');
      } else {
        console.log('  ⚠️  Cleanup may have failed (but test still succeeded)');
      }
    } catch (error) {
      console.log('  ⚠️  Cleanup error (but test still succeeded):', error);
    }
  }

  private saveTestArtifact(filename: string, content: string) {
    try {
      const resultsDir = join(__dirname, '../results');
      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(join(resultsDir, filename), content);
    } catch (error) {
      console.log('  ⚠️  Failed to save test artifact:', error);
    }
  }
}

// Run the test
export async function runMetaCreativeUploadTest(): Promise<TestResult> {
  const test = new MetaCreativeUploadTest();
  return test.run();
}

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMetaCreativeUploadTest()
    .then(result => {
      console.log('\n📊 Test Results:');
      console.log('Success:', result.success);
      console.log('Duration:', `${result.duration.toFixed(0)}ms`);
      console.log('OpenAI Cost:', `$${result.costs.openai.toFixed(3)}`);
      console.log('Meta Cost:', `$${result.costs.meta.toFixed(3)}`);
      console.log('Details:', result.details);
      
      if (result.details.errors?.length) {
        console.log('Errors:', result.details.errors);
      }

      // Save detailed results
      const resultsDir = join(__dirname, '../results');
      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(
        join(resultsDir, 'meta-creative-upload-results.json'),
        JSON.stringify(result, null, 2)
      );

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}