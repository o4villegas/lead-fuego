// Environment type definitions
export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  IMAGES?: Fetcher;
  
  // Environment Variables
  ENVIRONMENT: string;
  JWT_SECRET: string;
  WEBHOOK_SECRET: string;
  ENCRYPTION_KEY: string;
  
  // Meta API Credentials (will be stored encrypted per user)
  META_ACCESS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_PAGE_ID?: string;
  
  // OpenAI Credentials (will be stored encrypted per user)
  OPENAI_API_KEY?: string;
  
  // Twilio Credentials (Phase 3)
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  
  // SendGrid Credentials (Phase 3)
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  SENDGRID_FROM_NAME?: string;
  SENDGRID_UNSUBSCRIBE_GROUP_ID?: string;
  
  // Webhook Base URL for callbacks
  WEBHOOK_BASE_URL?: string;
}