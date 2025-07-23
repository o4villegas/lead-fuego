// Meta API Integration Tests
// Tests Meta Marketing API v20.0 integration and validation

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
config({ path: join(__dirname, '../config/test.env') });

interface MetaTestResult {
  operation: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
  metaObjectId?: string;
}

class MetaAPITest {
  private results: MetaTestResult[] = [];
  private readonly BASE_URL = 'https://graph.facebook.com/v20.0';
  private readonly accessToken = process.env.META_ACCESS_TOKEN || '';
  private readonly adAccountId = process.env.META_AD_ACCOUNT_ID || '';
  private readonly appSecret = process.env.META_APP_SECRET || '';
  
  private testCampaignId: string = '';
  private testAdSetId: string = '';
  private testCreativeId: string = '';
  private testImageHash: string = '';

  async runAllTests(): Promise<{ passed: number; failed: number; results: MetaTestResult[]; configured: boolean }> {
    console.log('📊 Starting Meta API Integration Tests...\n');

    const configured = this.isConfigured();
    if (!configured) {
      console.log('⚠️  Meta API not configured - skipping tests\n');
      console.log('   Missing: ACCESS_TOKEN, AD_ACCOUNT_ID, or APP_SECRET');
      return { passed: 0, failed: 0, results: [], configured: false };
    }

    console.log(`🎯 Testing against Ad Account: ${this.adAccountId}\n`);

    // Test sequence
    await this.testCredentialValidation();
    await this.testCampaignCreation();
    await this.testAdSetCreation();
    await this.testImageUpload();
    await this.testCreativeCreation();
    await this.testAdCreation();
    await this.testCampaignInsights();
    await this.testCleanup();

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    return { passed, failed, results: this.results, configured: true };
  }

  private isConfigured(): boolean {
    return !!(this.accessToken && this.adAccountId && this.appSecret);
  }

  private async makeMetaRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE',
    operation: string,
    body?: any
  ): Promise<MetaTestResult> {
    const startTime = Date.now();
    const result: MetaTestResult = {
      operation,
      success: false,
      duration: 0
    };

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      if (method === 'POST' && body) {
        // Add app secret proof for security
        const appsecret_proof = await this.generateAppSecretProof(this.accessToken);
        body.appsecret_proof = appsecret_proof;
        body.access_token = this.accessToken;
        
        options.body = new URLSearchParams(body).toString();
      } else if (method === 'GET') {
        const params = new URLSearchParams({ access_token: this.accessToken });
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}${params}`;
        const response = await fetch(finalUrl, options);
        
        result.duration = Date.now() - startTime;
        result.data = await response.json();
        result.success = response.ok;
        
        if (!response.ok) {
          result.error = result.data.error?.message || `HTTP ${response.status}`;
        }
        
        this.logResult(result);
        this.results.push(result);
        return result;
      }

      const response = await fetch(url, options);
      result.duration = Date.now() - startTime;
      result.data = await response.json();
      result.success = response.ok;

      if (!response.ok) {
        result.error = result.data.error?.message || `HTTP ${response.status}`;
      } else if (result.data.id) {
        result.metaObjectId = result.data.id;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.duration = Date.now() - startTime;
    }

    this.logResult(result);
    this.results.push(result);
    return result;
  }

  private async generateAppSecretProof(accessToken: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.appSecret);
    const messageData = encoder.encode(accessToken);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private logResult(result: MetaTestResult) {
    const emoji = result.success ? '✅' : '❌';
    console.log(`${emoji} ${result.operation} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.metaObjectId) {
      console.log(`   Created: ${result.metaObjectId}`);
    }
  }

  private async testCredentialValidation() {
    console.log('🔐 Testing credential validation...\n');
    
    await this.makeMetaRequest(
      `/${this.adAccountId}?fields=name,account_status`,
      'GET',
      'Validate Meta API credentials'
    );
  }

  private async testCampaignCreation() {
    console.log('\n📈 Testing campaign creation...\n');
    
    const campaignData = {
      name: `Test Campaign - ${Date.now()}`,
      objective: 'LEAD_GENERATION',
      status: 'PAUSED',
      special_ad_categories: JSON.stringify([])
    };

    const result = await this.makeMetaRequest(
      `/${this.adAccountId}/campaigns`,
      'POST',
      'Create test campaign',
      campaignData
    );

    if (result.success && result.metaObjectId) {
      this.testCampaignId = result.metaObjectId;
    }
  }

  private async testAdSetCreation() {
    if (!this.testCampaignId) {
      console.log('\n⚠️  Skipping ad set creation - no campaign ID\n');
      return;
    }

    console.log('\n🎯 Testing ad set creation...\n');
    
    const adSetData = {
      name: `Test AdSet - ${Date.now()}`,
      campaign_id: this.testCampaignId,
      daily_budget: 1000, // $10.00 in cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify({
        geo_locations: { countries: ['US'] },
        age_min: 18,
        age_max: 65
      }),
      status: 'PAUSED'
    };

    const result = await this.makeMetaRequest(
      `/${this.adAccountId}/adsets`,
      'POST',
      'Create test ad set',
      adSetData
    );

    if (result.success && result.metaObjectId) {
      this.testAdSetId = result.metaObjectId;
    }
  }

  private async testImageUpload() {
    console.log('\n🖼️  Testing image upload...\n');
    
    // Use a placeholder image URL for testing
    const imageData = {
      url: 'https://via.placeholder.com/1200x630/0066cc/ffffff?text=Test+Ad+Image'
    };

    const result = await this.makeMetaRequest(
      `/${this.adAccountId}/adimages`,
      'POST',
      'Upload test image',
      imageData
    );

    if (result.success && result.data.images) {
      this.testImageHash = Object.keys(result.data.images)[0];
      console.log(`   Image hash: ${this.testImageHash}`);
    }
  }

  private async testCreativeCreation() {
    if (!this.testImageHash) {
      console.log('\n⚠️  Skipping creative creation - no image hash\n');
      return;
    }

    console.log('\n🎨 Testing creative creation...\n');
    
    const pageId = this.adAccountId.replace('act_', ''); // Extract page ID from ad account
    
    const creativeData = {
      name: `Test Creative - ${Date.now()}`,
      object_story_spec: JSON.stringify({
        page_id: pageId,
        link_data: {
          image_hash: this.testImageHash,
          link: 'https://example.com',
          message: 'Test ad copy for Phase 2 integration testing',
          name: 'Test Headline',
          description: 'Test description for the ad creative'
        }
      })
    };

    const result = await this.makeMetaRequest(
      `/${this.adAccountId}/adcreatives`,
      'POST',
      'Create test creative',
      creativeData
    );

    if (result.success && result.metaObjectId) {
      this.testCreativeId = result.metaObjectId;
    }
  }

  private async testAdCreation() {
    if (!this.testAdSetId || !this.testCreativeId) {
      console.log('\n⚠️  Skipping ad creation - missing ad set or creative ID\n');
      return;
    }

    console.log('\n📢 Testing ad creation...\n');
    
    const adData = {
      name: `Test Ad - ${Date.now()}`,
      adset_id: this.testAdSetId,
      creative: JSON.stringify({ creative_id: this.testCreativeId }),
      status: 'PAUSED'
    };

    await this.makeMetaRequest(
      `/${this.adAccountId}/ads`,
      'POST',
      'Create test ad',
      adData
    );
  }

  private async testCampaignInsights() {
    if (!this.testCampaignId) {
      console.log('\n⚠️  Skipping insights test - no campaign ID\n');
      return;
    }

    console.log('\n📊 Testing campaign insights...\n');
    
    await this.makeMetaRequest(
      `/${this.testCampaignId}/insights?fields=impressions,clicks,spend`,
      'GET',
      'Get campaign insights'
    );
  }

  private async testCleanup() {
    console.log('\n🧹 Testing cleanup...\n');
    
    if (this.testCampaignId) {
      await this.makeMetaRequest(
        `/${this.testCampaignId}`,
        'DELETE',
        'Delete test campaign'
      );
    }
  }
}

// Export for use in test suite
export { MetaAPITest, MetaTestResult };

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const test = new MetaAPITest();
  test.runAllTests()
    .then(results => {
      console.log('\n📊 META API TEST RESULTS');
      console.log('========================');
      
      if (!results.configured) {
        console.log('⚠️  Tests skipped - Meta API not configured');
        process.exit(0);
      }
      
      console.log(`✅ Passed: ${results.passed}`);
      console.log(`❌ Failed: ${results.failed}`);
      
      // Show critical failures
      const criticalFailures = results.results.filter(r => 
        !r.success && ['Validate Meta API credentials', 'Create test campaign'].includes(r.operation)
      );
      
      if (criticalFailures.length > 0) {
        console.log('\n🚨 CRITICAL FAILURES:');
        criticalFailures.forEach(failure => {
          console.log(`   • ${failure.operation}: ${failure.error}`);
        });
      }

      const success = results.failed === 0;
      console.log(`\n${success ? '✅ ALL META API TESTS PASSED' : '❌ META API TESTS FAILED'}`);
      
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Meta API test execution failed:', error);
      process.exit(1);
    });
}