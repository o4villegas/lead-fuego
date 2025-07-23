// LeadFuego Test API Clients
// Configured API clients for integration testing

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
config({ path: join(__dirname, '../config/test.env') });

export interface TestConfig {
  meta: {
    accessToken: string;
    adAccountId: string;
    appId: string;
    appSecret: string;
  };
  openai: {
    apiKey: string;
    orgId?: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  sendgrid: {
    apiKey: string;
  };
  test: {
    maxCostLimit: number;
    webhookUrl?: string;
    debugMode: boolean;
  };
}

export const testConfig: TestConfig = {
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN!,
    adAccountId: process.env.META_AD_ACCOUNT_ID!,
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    orgId: process.env.OPENAI_ORG_ID,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY!,
  },
  test: {
    maxCostLimit: parseFloat(process.env.MAX_COST_LIMIT_USD || '25.00'),
    webhookUrl: process.env.WEBHOOK_TEST_URL,
    debugMode: process.env.DEBUG_API_CALLS === 'true',
  },
};

// Meta Marketing API Client
export class MetaAPIClient {
  private baseUrl = 'https://graph.facebook.com/v23.0';
  private accessToken: string;
  private adAccountId: string;

  constructor(accessToken: string, adAccountId: string) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
  }

  async makeRequest(endpoint: string, method = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method === 'POST' || method === 'PUT') {
      const formData = new FormData();
      formData.append('access_token', this.accessToken);
      
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }
      options.body = formData;
    } else {
      const params = new URLSearchParams({ access_token: this.accessToken });
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          params.append(key, String(value));
        });
      }
      const fullUrl = `${url}?${params}`;
      return fetch(fullUrl, options);
    }

    return fetch(url, options);
  }

  // Test account access
  async testConnection() {
    return this.makeRequest(`/${this.adAccountId}`);
  }

  // Create test campaign
  async createTestCampaign(name: string) {
    return this.makeRequest(`/${this.adAccountId}/campaigns`, 'POST', {
      name,
      objective: 'LEAD_GENERATION',
      status: 'PAUSED',
      special_ad_categories: '[]',
    });
  }

  // Upload image creative
  async uploadCreative(campaignId: string, imageUrl: string, message: string) {
    // First create ad image
    const imageResponse = await this.makeRequest(`/${this.adAccountId}/adimages`, 'POST', {
      url: imageUrl,
    });

    if (!imageResponse.ok) {
      throw new Error(`Failed to upload image: ${await imageResponse.text()}`);
    }

    const imageResult = await imageResponse.json();
    const imageHash = Object.keys(imageResult.images)[0];

    // Create ad creative
    return this.makeRequest(`/${this.adAccountId}/adcreatives`, 'POST', {
      name: `Test Creative - ${Date.now()}`,
      object_story_spec: JSON.stringify({
        page_id: this.adAccountId.replace('act_', ''),
        link_data: {
          image_hash: imageHash,
          message: message,
          link: 'https://example.com',
          call_to_action: {
            type: 'LEARN_MORE',
          },
        },
      }),
    });
  }

  // Cleanup test resources
  async cleanupTestCampaign(campaignId: string) {
    return this.makeRequest(`/${campaignId}`, 'DELETE');
  }
}

// OpenAI API Client
export class OpenAIClient {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    return response.json();
  }

  // Generate test ad copy
  async generateAdCopy(industry: string, objective: string) {
    return this.makeRequest('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional ad copywriter. Create compelling ad copy for Meta advertising campaigns.',
        },
        {
          role: 'user',
          content: `Create ad copy for a ${industry} business with the objective: ${objective}. Keep it under 125 characters for the primary text.`,
        },
      ],
      max_tokens: 150,
    });
  }

  // Generate test creative image
  async generateCreativeImage(prompt: string) {
    return this.makeRequest('/images/generations', {
      model: 'dall-e-3',
      prompt: `Professional advertising creative: ${prompt}. Clean, modern design suitable for Facebook ads. 1024x1024 resolution.`,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    });
  }
}

// Initialize API clients for testing
export const metaClient = new MetaAPIClient(
  testConfig.meta.accessToken,
  testConfig.meta.adAccountId
);

export const openaiClient = new OpenAIClient(testConfig.openai.apiKey);

// Cost tracking utility
export class CostTracker {
  private costs: Array<{ service: string; operation: string; cost: number; timestamp: Date }> = [];

  addCost(service: string, operation: string, cost: number) {
    this.costs.push({ service, operation, cost, timestamp: new Date() });
    
    const total = this.getTotalCost();
    if (total > testConfig.test.maxCostLimit) {
      throw new Error(`Cost limit exceeded: $${total.toFixed(2)} > $${testConfig.test.maxCostLimit}`);
    }
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, item) => sum + item.cost, 0);
  }

  getCostsByService(): Record<string, number> {
    return this.costs.reduce((acc, item) => {
      acc[item.service] = (acc[item.service] || 0) + item.cost;
      return acc;
    }, {} as Record<string, number>);
  }

  getReport() {
    return {
      totalCost: this.getTotalCost(),
      costsByService: this.getCostsByService(),
      itemCount: this.costs.length,
      costs: this.costs,
    };
  }
}

export const costTracker = new CostTracker();