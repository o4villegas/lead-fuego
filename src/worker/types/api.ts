// API request/response types

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  firstName?: string;
  lastName?: string;
  company?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    subscriptionTier: string;
    onboardingCompleted: boolean;
  };
  error?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    workersAICost?: number;
    openAICost?: number;
  };
}

export interface CreateCampaignRequest {
  name: string;
  objective: string;
  dailyBudget: number; // in dollars, will convert to cents
  targetAudience: {
    ageMin?: number;
    ageMax?: number;
    genders?: ('male' | 'female' | 'all')[];
    locations?: string[];
    interests?: string[];
    behaviors?: string[];
  };
  creativeGuidance?: {
    brandVoice?: string;
    keyMessage?: string;
    visualStyle?: string;
  };
}

export interface GenerateCreativeRequest {
  campaignId: string;
  prompt?: string;
  variations?: number; // Default 3
  regenerate?: boolean;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}