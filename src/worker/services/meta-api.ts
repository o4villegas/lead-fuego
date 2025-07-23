// Meta Marketing API service for campaign and creative management

export interface MetaCampaignData {
  name: string;
  objective: string;
  daily_budget: number;
  targeting: any;
  status: 'PAUSED' | 'ACTIVE';
  special_ad_categories?: string[];
}

export interface MetaCreativeData {
  name: string;
  object_story_spec: any;
  image_hash?: string;
  image_url?: string;
}

export interface MetaAdData {
  name: string;
  adset_id: string;
  creative: any;
  status: 'PAUSED' | 'ACTIVE';
}

export interface MetaPreview {
  body: string;
  link_url?: string;
  link_title?: string;
  link_description?: string;
}

export class MetaAPIService {
  private readonly BASE_URL = 'https://graph.facebook.com/v20.0';
  
  constructor(
    private accessToken: string,
    private adAccountId: string,
    private appSecret: string
  ) {}

  /**
   * Create Meta campaign
   */
  async createCampaign(campaignData: MetaCampaignData): Promise<{ id: string; name: string }> {
    const endpoint = `${this.BASE_URL}/${this.adAccountId}/campaigns`;
    
    const body = {
      name: campaignData.name,
      objective: campaignData.objective,
      status: campaignData.status,
      special_ad_categories: JSON.stringify(campaignData.special_ad_categories || []),
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta Campaign creation failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return { id: result.id, name: campaignData.name };
  }

  /**
   * Create ad set with targeting and budget
   */
  async createAdSet(
    campaignId: string,
    name: string,
    dailyBudget: number,
    targeting: any
  ): Promise<{ id: string; name: string }> {
    const endpoint = `${this.BASE_URL}/${this.adAccountId}/adsets`;
    
    const body = {
      name,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(targeting),
      status: 'PAUSED',
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta AdSet creation failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return { id: result.id, name };
  }

  /**
   * Upload image to Meta
   */
  async uploadImage(imageUrl: string): Promise<{ hash: string; url: string }> {
    const endpoint = `${this.BASE_URL}/${this.adAccountId}/adimages`;
    
    const body = {
      url: imageUrl,
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta image upload failed: ${error}`);
    }
    
    const result = await response.json() as any;
    const imageHash = Object.keys(result.images)[0];
    
    return {
      hash: imageHash,
      url: result.images[imageHash].url
    };
  }

  /**
   * Create ad creative
   */
  async createCreative(
    creativeData: MetaCreativeData,
    pageId?: string
  ): Promise<{ id: string; name: string }> {
    const endpoint = `${this.BASE_URL}/${this.adAccountId}/adcreatives`;
    
    const body = {
      name: creativeData.name,
      object_story_spec: JSON.stringify({
        page_id: pageId || this.adAccountId.replace('act_', ''),
        link_data: creativeData.object_story_spec
      }),
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta Creative creation failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return { id: result.id, name: creativeData.name };
  }

  /**
   * Create ad
   */
  async createAd(adData: MetaAdData): Promise<{ id: string; name: string }> {
    const endpoint = `${this.BASE_URL}/${this.adAccountId}/ads`;
    
    const body = {
      name: adData.name,
      adset_id: adData.adset_id,
      creative: JSON.stringify(adData.creative),
      status: adData.status,
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta Ad creation failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return { id: result.id, name: adData.name };
  }

  /**
   * Generate ad previews
   */
  async generatePreviews(
    creativeId: string,
    adFormat: string = 'DESKTOP_FEED_STANDARD'
  ): Promise<MetaPreview[]> {
    const endpoint = `${this.BASE_URL}/${creativeId}/generatepreviews`;
    
    const params = new URLSearchParams({
      ad_format: adFormat,
      access_token: this.accessToken
    });

    const response = await this.makeRequest(`${endpoint}?${params}`, 'GET');
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta Preview generation failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return result.data || [];
  }

  /**
   * Get campaign performance
   */
  async getCampaignInsights(
    campaignId: string,
    fields: string[] = ['impressions', 'clicks', 'spend', 'ctr', 'cpm']
  ): Promise<any> {
    const fieldsParam = fields.join(',');
    const endpoint = `${this.BASE_URL}/${campaignId}/insights`;
    
    const params = new URLSearchParams({
      fields: fieldsParam,
      access_token: this.accessToken
    });

    const response = await this.makeRequest(`${endpoint}?${params}`, 'GET');
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta Insights fetch failed: ${error}`);
    }
    
    const result = await response.json() as any;
    return result.data || [];
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(campaignId: string, status: 'PAUSED' | 'ACTIVE'): Promise<boolean> {
    const endpoint = `${this.BASE_URL}/${campaignId}`;
    
    const body = {
      status,
      access_token: this.accessToken
    };

    const response = await this.makeRequest(endpoint, 'POST', body);
    return response.ok;
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string): Promise<boolean> {
    const endpoint = `${this.BASE_URL}/${campaignId}`;
    
    const params = new URLSearchParams({
      access_token: this.accessToken
    });

    const response = await this.makeRequest(`${endpoint}?${params}`, 'DELETE');
    return response.ok;
  }

  /**
   * Build Meta targeting object
   */
  buildTargeting(audienceData: any): any {
    const targeting: any = {
      geo_locations: {
        countries: audienceData.locations || ['US']
      }
    };

    if (audienceData.ageMin || audienceData.ageMax) {
      targeting.age_min = audienceData.ageMin || 18;
      targeting.age_max = audienceData.ageMax || 65;
    }

    if (audienceData.genders && !audienceData.genders.includes('all')) {
      targeting.genders = audienceData.genders.map((g: string) => g === 'male' ? 1 : 2);
    }

    if (audienceData.interests && audienceData.interests.length > 0) {
      targeting.interests = audienceData.interests.map((interest: string) => ({
        id: interest,
        name: interest
      }));
    }

    if (audienceData.behaviors && audienceData.behaviors.length > 0) {
      targeting.behaviors = audienceData.behaviors.map((behavior: string) => ({
        id: behavior,
        name: behavior
      }));
    }

    return targeting;
  }

  /**
   * Validate Meta API credentials
   */
  async validateCredentials(): Promise<{ valid: boolean; accountName?: string; error?: string }> {
    try {
      const endpoint = `${this.BASE_URL}/${this.adAccountId}`;
      const params = new URLSearchParams({
        fields: 'name,account_status',
        access_token: this.accessToken
      });

      const response = await this.makeRequest(`${endpoint}?${params}`, 'GET');
      
      if (!response.ok) {
        const error = await response.text();
        return { valid: false, error };
      }
      
      const result = await response.json() as any;
      return { 
        valid: true, 
        accountName: result.name 
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Make authenticated request to Meta API
   */
  private async makeRequest(
    url: string, 
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
  ): Promise<Response> {
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
      
      options.body = new URLSearchParams(body).toString();
    }

    return fetch(url, options);
  }

  /**
   * Generate app secret proof for enhanced security
   */
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

  /**
   * Check if Meta API is configured
   */
  isConfigured(): boolean {
    return !!(this.accessToken && this.adAccountId && this.appSecret);
  }
}