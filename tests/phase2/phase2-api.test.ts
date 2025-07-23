// Phase 2 API Integration Tests
// Comprehensive testing of all Phase 2 endpoints and functionality

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
config({ path: join(__dirname, '../config/test.env') });

const API_URL = process.env.TEST_API_URL || 'http://localhost:8787';

interface TestResult {
  endpoint: string;
  method: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  data?: any;
  duration: number;
  testName: string;
}

interface Phase2TestResults {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
  criticalIssues: string[];
}

class Phase2APITest {
  private results: TestResult[] = [];
  private criticalIssues: string[] = [];
  private authToken: string = '';
  private testUser = {
    email: `phase2test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Phase2',
    lastName: 'Tester',
    company: 'Test Corp'
  };
  private testCampaignId: string = '';
  private testCreativeIds: string[] = [];

  async runAllTests(): Promise<Phase2TestResults> {
    console.log('🧪 Starting Phase 2 API Integration Tests...\n');
    const startTime = Date.now();

    // Phase 1 dependency - need auth token
    await this.setupAuthentication();
    
    // Phase 2 Core Tests
    await this.testCampaignEndpoints();
    await this.testCreativeGeneration();
    await this.testWebhookEndpoints();
    await this.testDatabaseMethods();
    await this.testAuthenticationProtection();
    
    // Cleanup
    await this.cleanup();

    const duration = Date.now() - startTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    return {
      total: this.results.length,
      passed,
      failed,
      duration,
      results: this.results,
      criticalIssues: this.criticalIssues
    };
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    testName: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      endpoint,
      method,
      testName,
      success: false,
      duration: 0
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });

      result.statusCode = response.status;
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result.data = await response.json();
      } else {
        result.data = await response.text();
      }
      
      result.success = response.ok;
      result.duration = Date.now() - startTime;

      if (!response.ok) {
        result.error = typeof result.data === 'object' ? result.data.error : result.data || `HTTP ${response.status}`;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.duration = Date.now() - startTime;
    }

    // Log result
    const emoji = result.success ? '✅' : '❌';
    console.log(`${emoji} ${testName}: ${method} ${endpoint} - ${result.statusCode || 'ERROR'} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    this.results.push(result);
    return result;
  }

  private async setupAuthentication() {
    console.log('🔐 Setting up authentication...\n');
    
    // Register test user
    const registerResult = await this.makeRequest(
      '/api/auth/register', 
      'POST', 
      'Register Phase 2 test user',
      this.testUser
    );
    
    if (registerResult.success && registerResult.data?.token) {
      this.authToken = registerResult.data.token;
      console.log('   ✅ Authentication setup complete\n');
    } else {
      this.criticalIssues.push('Failed to setup authentication - all subsequent tests will fail');
      console.log('   ❌ Authentication setup failed\n');
    }
  }

  private async testCampaignEndpoints() {
    console.log('📊 Testing Campaign API Endpoints...\n');

    // Test: Create Campaign
    const createCampaignData = {
      name: `Phase 2 Test Campaign ${Date.now()}`,
      objective: 'LEAD_GENERATION',
      budget: 50.00,
      targetAudience: {
        ageMin: 25,
        ageMax: 45,
        genders: ['all'],
        locations: ['US'],
        interests: ['technology', 'business']
      },
      creativeGuidance: {
        brandVoice: 'Professional',
        keyMessage: 'Transform your business',
        visualStyle: 'Modern and clean'
      }
    };

    const createResult = await this.makeRequest(
      '/api/campaigns',
      'POST',
      'Create new campaign',
      createCampaignData,
      { 'Authorization': `Bearer ${this.authToken}` }
    );

    if (createResult.success && createResult.data?.data?.id) {
      this.testCampaignId = createResult.data.data.id;
      console.log(`   📝 Campaign created: ${this.testCampaignId}`);
    } else {
      this.criticalIssues.push('Campaign creation failed - creative generation tests will fail');
    }

    // Test: Get Campaigns
    await this.makeRequest(
      '/api/campaigns',
      'GET',
      'Get user campaigns',
      undefined,
      { 'Authorization': `Bearer ${this.authToken}` }
    );

    // Test: Get Campaign by ID
    if (this.testCampaignId) {
      await this.makeRequest(
        `/api/campaigns/${this.testCampaignId}`,
        'GET',
        'Get campaign by ID',
        undefined,
        { 'Authorization': `Bearer ${this.authToken}` }
      );

      // Test: Update Campaign
      const updateData = {
        name: `Updated Campaign ${Date.now()}`,
        budget: 75.00
      };

      await this.makeRequest(
        `/api/campaigns/${this.testCampaignId}`,
        'PUT',
        'Update campaign',
        updateData,
        { 'Authorization': `Bearer ${this.authToken}` }
      );
    }

    console.log('');
  }

  private async testCreativeGeneration() {
    console.log('🎨 Testing Creative Generation...\n');

    if (!this.testCampaignId) {
      console.log('   ⚠️  Skipping creative tests - no campaign ID available');
      return;
    }

    // Test: Generate Creatives with Workers AI
    const generateData = {
      campaignId: this.testCampaignId,
      variations: 2,
      includeImages: false, // Start without images to test Workers AI only
      regenerate: false
    };

    const generateResult = await this.makeRequest(
      '/api/creatives/generate',
      'POST',
      'Generate creatives with Workers AI',
      generateData,
      { 'Authorization': `Bearer ${this.authToken}` }
    );

    if (generateResult.success && generateResult.data?.data) {
      const creatives = generateResult.data.data;
      this.testCreativeIds = creatives.map((c: any) => c.id);
      console.log(`   🎯 Generated ${creatives.length} creatives`);
      
      // Validate ad copy length (Meta requirement)
      for (const creative of creatives) {
        if (creative.primary_text && creative.primary_text.length > 125) {
          this.criticalIssues.push(`Ad copy exceeds 125 characters: "${creative.primary_text}"`);
        }
      }
    }

    // Test: Generate with Images (OpenAI)
    if (process.env.OPENAI_API_KEY) {
      const generateWithImagesData = {
        campaignId: this.testCampaignId,
        variations: 1,
        includeImages: true
      };

      await this.makeRequest(
        '/api/creatives/generate',
        'POST',
        'Generate creatives with OpenAI images',
        generateWithImagesData,
        { 'Authorization': `Bearer ${this.authToken}` }
      );
    } else {
      console.log('   ⚠️  Skipping OpenAI image test - no API key configured');
    }

    // Test: Preview Creatives
    if (this.testCreativeIds.length > 0) {
      await this.makeRequest(
        `/api/creatives/${this.testCreativeIds[0]}/preview`,
        'POST',
        'Generate creative preview',
        {},
        { 'Authorization': `Bearer ${this.authToken}` }
      );

      // Test: Approve Creative
      const approveData = { creativeId: this.testCreativeIds[0], approved: true };
      await this.makeRequest(
        `/api/creatives/${this.testCreativeIds[0]}/approve`,
        'POST',
        'Approve creative',
        approveData,
        { 'Authorization': `Bearer ${this.authToken}` }
      );
    }

    // Test: Cost Estimation
    await this.makeRequest(
      '/api/creatives/costs?variations=3&includeImages=true',
      'GET',
      'Get cost estimation',
      undefined,
      { 'Authorization': `Bearer ${this.authToken}` }
    );

    console.log('');
  }

  private async testWebhookEndpoints() {
    console.log('🔗 Testing Webhook Endpoints...\n');

    // Test: Webhook Health Check
    await this.makeRequest(
      '/api/webhooks/health',
      'GET',
      'Webhook health check'
    );

    // Test: Meta Webhook Verification (GET)
    const verifyParams = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': process.env.WEBHOOK_SECRET || 'test-secret',
      'hub.challenge': 'test-challenge-123'
    });

    await this.makeRequest(
      `/api/webhooks/meta?${verifyParams}`,
      'GET',
      'Meta webhook verification'
    );

    // Test: Test Webhook (Development)
    if (process.env.ENVIRONMENT === 'development') {
      const testWebhookData = {
        campaignId: this.testCampaignId || 'test-campaign',
        firstName: 'Test',
        lastName: 'Lead',
        email: 'testlead@example.com',
        phone: '+1234567890',
        company: 'Test Company'
      };

      await this.makeRequest(
        '/api/webhooks/test',
        'POST',
        'Test webhook (development)',
        testWebhookData
      );
    }

    console.log('');
  }

  private async testDatabaseMethods() {
    console.log('🗄️  Testing Database Methods...\n');

    // These tests verify the new database methods work with real D1
    // We'll test them indirectly through the API endpoints
    
    if (this.testCreativeIds.length > 0) {
      // Test getCreativeById (via preview endpoint)
      const getResult = await this.makeRequest(
        `/api/creatives/${this.testCreativeIds[0]}/preview`,
        'POST',
        'Test getCreativeById (via preview)',
        {},
        { 'Authorization': `Bearer ${this.authToken}` }
      );

      // Test updateCreative (via approve endpoint)
      const updateResult = await this.makeRequest(
        `/api/creatives/${this.testCreativeIds[0]}/approve`,
        'POST',
        'Test updateCreative (via approve)',
        { creativeId: this.testCreativeIds[0], approved: true },
        { 'Authorization': `Bearer ${this.authToken}` }
      );

      if (!getResult.success) {
        this.criticalIssues.push('getCreativeById method may not be working correctly');
      }
      if (!updateResult.success) {
        this.criticalIssues.push('updateCreative method may not be working correctly');
      }
    } else {
      console.log('   ⚠️  Skipping database method tests - no creative IDs available');
    }

    console.log('');
  }

  private async testAuthenticationProtection() {
    console.log('🔒 Testing Authentication Protection...\n');

    // Test: Protected endpoints without token
    const protectedEndpoints = [
      { path: '/api/campaigns', method: 'GET' },
      { path: '/api/campaigns', method: 'POST' },
      { path: '/api/creatives/generate', method: 'POST' },
      { path: '/api/creatives/costs', method: 'GET' }
    ];

    for (const endpoint of protectedEndpoints) {
      const result = await this.makeRequest(
        endpoint.path,
        endpoint.method,
        `Test ${endpoint.method} ${endpoint.path} without auth`,
        endpoint.method === 'POST' ? {} : undefined
      );

      if (result.success || result.statusCode !== 401) {
        this.criticalIssues.push(`Endpoint ${endpoint.method} ${endpoint.path} not properly protected`);
      }
    }

    // Test: Invalid token
    await this.makeRequest(
      '/api/campaigns',
      'GET',
      'Test with invalid token',
      undefined,
      { 'Authorization': 'Bearer invalid-token-123' }
    );

    console.log('');
  }

  private async cleanup() {
    console.log('🧹 Cleaning up test data...\n');

    // Delete test campaign (if it was created)
    if (this.testCampaignId) {
      await this.makeRequest(
        `/api/campaigns/${this.testCampaignId}`,
        'DELETE',
        'Cleanup: Delete test campaign',
        undefined,
        { 'Authorization': `Bearer ${this.authToken}` }
      );
    }

    console.log('   ✅ Cleanup complete\n');
  }
}

// Export for use in test suite
export { Phase2APITest, Phase2TestResults };

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const test = new Phase2APITest();
  test.runAllTests()
    .then(results => {
      console.log('📊 PHASE 2 TEST RESULTS');
      console.log('======================');
      console.log(`Total: ${results.total}`);
      console.log(`✅ Passed: ${results.passed}`);
      console.log(`❌ Failed: ${results.failed}`);
      console.log(`⏱️  Duration: ${results.duration}ms`);
      
      if (results.criticalIssues.length > 0) {
        console.log('\n🚨 CRITICAL ISSUES:');
        results.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
      }

      const success = results.failed === 0 && results.criticalIssues.length === 0;
      console.log(`\n${success ? '✅ ALL PHASE 2 TESTS PASSED' : '❌ PHASE 2 TESTS FAILED'}`);
      
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Phase 2 test execution failed:', error);
      process.exit(1);
    });
}