// Database entity types matching our D1 schema

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  meta_ad_account_id?: string;
  onboarding_completed: boolean;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Campaign {
  id: string;
  user_id: string;
  meta_campaign_id?: string;
  name: string;
  objective: string;
  daily_budget: number; // in cents
  target_audience: string; // JSON string
  creative_guidance?: string; // JSON string
  status: 'draft' | 'review' | 'active' | 'paused' | 'completed' | 'deleted';
  launch_date?: number;
  end_date?: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  meta_creative_id?: string;
  type: 'image' | 'carousel' | 'video';
  primary_text: string; // ≤125 chars
  headline?: string;
  description?: string;
  image_url?: string;
  image_hash?: string;
  call_to_action: string;
  generation_prompt?: string;
  ai_model_used?: string;
  performance_score?: number;
  status: 'generated' | 'uploaded' | 'active' | 'paused';
  created_at: number;
}

export interface Lead {
  id: string;
  campaign_id: string;
  meta_lead_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  custom_fields?: string; // JSON string
  captured_at: number;
  status: 'active' | 'converted' | 'unsubscribed';
}

export interface DripCampaign {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'meta_lead' | 'manual' | 'api';
  total_steps: number;
  active: boolean;
  created_by: string; // user_id
  created_at: number;
  updated_at: number;
}

export interface DripStep {
  id: string;
  campaign_id: string;
  step_number: number;
  channel: 'sms' | 'email';
  delay_minutes: number;
  content_template?: string;
  subject_template?: string;
  sendgrid_template_id?: string;
  active: boolean;
  created_at: number;
}

export interface SMSMessage {
  id: string;
  lead_id: string;
  drip_step_id?: string;
  twilio_sid?: string;
  to_number: string;
  from_number: string;
  content: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed';
  scheduled_at: number;
  sent_at?: number;
  delivered_at?: number;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

export interface EmailMessage {
  id: string;
  lead_id: string;
  drip_step_id?: string;
  sendgrid_message_id?: string;
  to_email: string;
  subject: string;
  template_id?: string;
  dynamic_data?: string; // JSON
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced';
  scheduled_at: number;
  sent_at?: number;
  delivered_at?: number;
  opened_at?: number;
  clicked_at?: number;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

export interface LeadJourney {
  id: string;
  lead_id: string;
  campaign_id: string;
  current_step: number;
  status: 'active' | 'completed' | 'paused' | 'failed';
  started_at: number;
  completed_at?: number;
  last_interaction_at?: number;
  total_sms_sent: number;
  total_emails_sent: number;
  total_opens: number;
  total_clicks: number;
  conversion_event?: string;
  converted_at?: number;
  created_at: number;
  updated_at: number;
}

export interface DripAnalytics {
  id: string;
  campaign_id: string;
  date: string; // YYYY-MM-DD
  leads_entered: number;
  leads_completed: number;
  leads_converted: number;
  total_sms_sent: number;
  total_emails_sent: number;
  total_opens: number;
  total_clicks: number;
  conversion_rate: number;
  engagement_rate: number;
  created_at: number;
}

export interface CreativeGuidance {
  brandVoice?: string;
  keyMessage?: string;
  visualStyle?: string;
}