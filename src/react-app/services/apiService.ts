import type {
  User,
  Campaign,
  Lead,
  DripCampaign,
  DripStep,
  LeadJourney,
  DashboardStats,
  AuthResponse,
  PaginatedResponse,
  CreateCampaignData,
  CreateDripCampaignData
} from '../types';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('auth_token');

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Authentication endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    company?: string;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ success: boolean; user: User }>('/auth/profile');
    return response.user;
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats');
  }

  // Campaign endpoints
  async getCampaigns(page = 1, limit = 20): Promise<PaginatedResponse<Campaign>> {
    return this.request<PaginatedResponse<Campaign>>(`/campaigns?page=${page}&limit=${limit}`);
  }

  async getCampaign(id: string): Promise<Campaign> {
    return this.request<Campaign>(`/campaigns/${id}`);
  }

  async createCampaign(data: CreateCampaignData): Promise<Campaign> {
    return this.request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id: string, data: Partial<CreateCampaignData>): Promise<Campaign> {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.request<void>(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  // Lead endpoints
  async getLeads(page = 1, limit = 20, campaignId?: string): Promise<PaginatedResponse<Lead>> {
    const params = new URLSearchParams({ 
      page: page.toString(), 
      limit: limit.toString() 
    });
    if (campaignId) params.set('campaignId', campaignId);
    
    return this.request<PaginatedResponse<Lead>>(`/leads?${params}`);
  }

  async getLead(id: string): Promise<Lead> {
    return this.request<Lead>(`/leads/${id}`);
  }

  // Drip campaign endpoints
  async getDripCampaigns(page = 1, limit = 20): Promise<PaginatedResponse<DripCampaign>> {
    return this.request<PaginatedResponse<DripCampaign>>(`/drip/campaigns?page=${page}&limit=${limit}`);
  }

  async getDripCampaign(id: string): Promise<DripCampaign> {
    return this.request<DripCampaign>(`/drip/campaigns/${id}`);
  }

  async createDripCampaign(data: CreateDripCampaignData): Promise<DripCampaign> {
    return this.request<DripCampaign>('/drip/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDripCampaign(id: string, data: Partial<CreateDripCampaignData>): Promise<DripCampaign> {
    return this.request<DripCampaign>(`/drip/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDripCampaign(id: string): Promise<void> {
    await this.request<void>(`/drip/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  // Drip steps endpoints
  async getDripSteps(campaignId: string): Promise<DripStep[]> {
    return this.request<DripStep[]>(`/drip/campaigns/${campaignId}/steps`);
  }

  async createDripStep(campaignId: string, data: Omit<DripStep, 'id' | 'campaignId' | 'createdAt'>): Promise<DripStep> {
    return this.request<DripStep>(`/drip/campaigns/${campaignId}/steps`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDripStep(campaignId: string, stepId: string, data: Partial<DripStep>): Promise<DripStep> {
    return this.request<DripStep>(`/drip/campaigns/${campaignId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDripStep(campaignId: string, stepId: string): Promise<void> {
    await this.request<void>(`/drip/campaigns/${campaignId}/steps/${stepId}`, {
      method: 'DELETE',
    });
  }

  // Lead journey endpoints
  async getLeadJourneys(leadId?: string, campaignId?: string): Promise<LeadJourney[]> {
    const params = new URLSearchParams();
    if (leadId) params.set('leadId', leadId);
    if (campaignId) params.set('campaignId', campaignId);
    
    return this.request<LeadJourney[]>(`/lead-journeys?${params}`);
  }

  async getLeadJourney(id: string): Promise<LeadJourney> {
    return this.request<LeadJourney>(`/lead-journeys/${id}`);
  }

  // Creative generation endpoints
  async generateAdContent(prompt: string, campaignId: string): Promise<{ content: string }> {
    return this.request<{ content: string }>('/creatives/generate-content', {
      method: 'POST',
      body: JSON.stringify({ prompt, campaignId }),
    });
  }

  async generateAdImage(prompt: string, campaignId: string): Promise<{ imageUrl: string }> {
    return this.request<{ imageUrl: string }>('/creatives/generate-image', {
      method: 'POST',
      body: JSON.stringify({ prompt, campaignId }),
    });
  }

  // Analytics endpoints
  async getCampaignAnalytics(campaignId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    return this.request(`/analytics/campaigns/${campaignId}?${params}`);
  }

  async getDripCampaignAnalytics(campaignId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    return this.request(`/analytics/drip-campaigns/${campaignId}?${params}`);
  }
}

export const apiService = new ApiService();