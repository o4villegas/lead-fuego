// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  onboardingCompleted: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Campaign types
export interface Campaign {
  id: string;
  userId: string;
  metaCampaignId?: string;
  name: string;
  objective: string;
  dailyBudget: number; // in cents
  targetAudience: any; // JSON object
  creativeGuidance?: any; // JSON object
  status: 'draft' | 'review' | 'active' | 'paused' | 'completed';
  launchDate?: number;
  endDate?: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Ad Creative types
export interface AdCreative {
  id: string;
  campaignId: string;
  metaCreativeId?: string;
  type: 'image' | 'carousel' | 'video';
  primaryText?: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  imageHash?: string;
  callToAction: string;
  generationPrompt?: string;
  aiModelUsed?: string;
  performanceScore?: number;
  status: 'generated' | 'uploaded' | 'active' | 'paused';
  createdAt: number;
}

// Lead types
export interface Lead {
  id: string;
  campaignId: string;
  metaLeadId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
  customFields?: any; // JSON object
  capturedAt: number;
  status: 'active' | 'converted' | 'unsubscribed';
}

// Drip Campaign types
export interface DripCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  triggerType: 'meta_lead' | 'manual' | 'time_based';
  triggerEvent: string;
  totalSteps: number;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface DripStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  channel: 'sms' | 'email';
  delayMinutes: number;
  contentTemplate?: string;
  subjectTemplate?: string;
  sendgridTemplateId?: string;
  active: boolean;
  createdAt: number;
}

export interface LeadJourney {
  id: string;
  leadId: string;
  campaignId: string;
  currentStep: number;
  status: 'active' | 'completed' | 'paused' | 'failed';
  startedAt: number;
  completedAt?: number;
  lastInteractionAt?: number;
  totalSmsSent: number;
  totalEmailsSent: number;
  totalOpens: number;
  totalClicks: number;
  conversionEvent?: string;
  convertedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Message types
export interface SmsMessage {
  id: string;
  leadId: string;
  dripStepId?: string;
  twilioSid?: string;
  toNumber: string;
  fromNumber: string;
  content: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed';
  scheduledAt: number;
  sentAt?: number;
  deliveredAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EmailMessage {
  id: string;
  leadId: string;
  dripStepId?: string;
  sendgridMessageId?: string;
  toEmail: string;
  subject: string;
  templateId?: string;
  dynamicData?: any; // JSON object
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced';
  scheduledAt: number;
  sentAt?: number;
  deliveredAt?: number;
  openedAt?: number;
  clickedAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// Analytics types
export interface DripAnalytics {
  id: string;
  campaignId: string;
  date: string; // YYYY-MM-DD
  leadsEntered: number;
  leadsCompleted: number;
  leadsConverted: number;
  totalSmsSent: number;
  totalEmailsSent: number;
  totalOpens: number;
  totalClicks: number;
  conversionRate: number;
  engagementRate: number;
  createdAt: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Form types
export interface CreateCampaignData {
  name: string;
  objective: string;
  dailyBudget: number;
  targetAudience: {
    ageMin?: number;
    ageMax?: number;
    interests?: string[];
    locations?: string[];
    gender?: 'male' | 'female' | 'all';
  };
  creativeGuidance?: {
    brandVoice?: string;
    keyMessage?: string;
    visualStyle?: string;
  };
}

export interface CreateDripCampaignData {
  name: string;
  description?: string;
  triggerType: 'meta_lead' | 'manual' | 'time_based';
  steps: CreateDripStepData[];
}

export interface CreateDripStepData {
  stepNumber: number;
  channel: 'sms' | 'email';
  delayMinutes: number;
  contentTemplate?: string;
  subjectTemplate?: string;
  sendgridTemplateId?: string;
}

// Dashboard stats types
export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  newLeads: number;
  emailsSent: number;
  conversionRate: number;
  revenue: number;
  growth: number;
}