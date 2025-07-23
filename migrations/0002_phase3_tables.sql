-- Phase 3 Database Schema: Drip Campaign Automation Tables
-- This migration adds the missing tables required for Phase 3 functionality

-- First, update the existing drip_campaigns table to match our TypeScript interface
-- We need to modify the structure to align with the Phase 3 implementation

-- Add missing columns to drip_campaigns table
ALTER TABLE drip_campaigns ADD COLUMN created_by TEXT;
ALTER TABLE drip_campaigns ADD COLUMN total_steps INTEGER DEFAULT 0;
ALTER TABLE drip_campaigns ADD COLUMN updated_at INTEGER DEFAULT (strftime('%s', 'now'));

-- Update trigger_event to trigger_type for consistency
-- Note: SQLite doesn't support column rename, so we'll add new column and migrate data
ALTER TABLE drip_campaigns ADD COLUMN trigger_type TEXT DEFAULT 'meta_lead';

-- Create drip_steps table (replaces the drip_messages approach)
CREATE TABLE drip_steps (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    delay_minutes INTEGER DEFAULT 0 CHECK (delay_minutes >= 0),
    content_template TEXT,
    subject_template TEXT,
    sendgrid_template_id TEXT,
    active BOOLEAN DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    UNIQUE(campaign_id, step_number)
);

-- Create lead_journeys table for tracking lead progress through drip campaigns
CREATE TABLE lead_journeys (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    last_interaction_at INTEGER,
    total_sms_sent INTEGER DEFAULT 0,
    total_emails_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    conversion_event TEXT,
    converted_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    UNIQUE(lead_id, campaign_id)
);

-- Create sms_messages table for SMS message queue and tracking
CREATE TABLE sms_messages (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    drip_step_id TEXT,
    twilio_sid TEXT UNIQUE,
    to_number TEXT NOT NULL,
    from_number TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed')),
    scheduled_at INTEGER NOT NULL,
    sent_at INTEGER,
    delivered_at INTEGER,
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (drip_step_id) REFERENCES drip_steps(id) ON DELETE SET NULL
);

-- Create email_messages table for email message queue and tracking
CREATE TABLE email_messages (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    drip_step_id TEXT,
    sendgrid_message_id TEXT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_id TEXT,
    dynamic_data TEXT, -- JSON string
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced')),
    scheduled_at INTEGER NOT NULL,
    sent_at INTEGER,
    delivered_at INTEGER,
    opened_at INTEGER,
    clicked_at INTEGER,
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (drip_step_id) REFERENCES drip_steps(id) ON DELETE SET NULL
);

-- Create drip_analytics table for campaign performance tracking
CREATE TABLE drip_analytics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD format
    leads_entered INTEGER DEFAULT 0,
    leads_completed INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    total_sms_sent INTEGER DEFAULT 0,
    total_emails_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    conversion_rate REAL DEFAULT 0.0,
    engagement_rate REAL DEFAULT 0.0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    UNIQUE(campaign_id, date)
);

-- Create indexes for better query performance
CREATE INDEX idx_drip_steps_campaign ON drip_steps(campaign_id);
CREATE INDEX idx_drip_steps_number ON drip_steps(campaign_id, step_number);
CREATE INDEX idx_lead_journeys_lead ON lead_journeys(lead_id);
CREATE INDEX idx_lead_journeys_campaign ON lead_journeys(campaign_id);
CREATE INDEX idx_lead_journeys_status ON lead_journeys(status);
CREATE INDEX idx_sms_messages_lead ON sms_messages(lead_id);
CREATE INDEX idx_sms_messages_status ON sms_messages(status);
CREATE INDEX idx_sms_messages_scheduled ON sms_messages(scheduled_at);
CREATE INDEX idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);
CREATE INDEX idx_email_messages_lead ON email_messages(lead_id);
CREATE INDEX idx_email_messages_status ON email_messages(status);
CREATE INDEX idx_email_messages_scheduled ON email_messages(scheduled_at);
CREATE INDEX idx_email_messages_sendgrid_id ON email_messages(sendgrid_message_id);
CREATE INDEX idx_drip_analytics_campaign ON drip_analytics(campaign_id);
CREATE INDEX idx_drip_analytics_date ON drip_analytics(date);

-- Update existing drip_campaigns with default values where needed
-- Set created_by to 'system' for existing campaigns that don't have this field
UPDATE drip_campaigns SET created_by = 'system' WHERE created_by IS NULL;
UPDATE drip_campaigns SET trigger_type = 'meta_lead' WHERE trigger_type IS NULL;

-- Make created_by NOT NULL after setting default values
-- Note: In a production environment, you'd want to set actual user IDs
-- ALTER TABLE drip_campaigns ADD CONSTRAINT drip_campaigns_created_by_not_null CHECK (created_by IS NOT NULL);