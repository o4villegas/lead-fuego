-- LeadFuego Initial Database Schema
-- Production-ready schema for Meta lead generation campaigns

-- Users table (authentication and account management)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    subscription_tier TEXT DEFAULT 'free', -- free, pro, enterprise
    meta_ad_account_id TEXT, -- Connected Meta ad account
    onboarding_completed BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Meta campaigns (core campaign data)
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    meta_campaign_id TEXT UNIQUE, -- Meta's campaign ID
    name TEXT NOT NULL,
    objective TEXT NOT NULL, -- LEAD_GENERATION, CONVERSIONS, etc.
    daily_budget INTEGER NOT NULL, -- in cents
    target_audience TEXT NOT NULL, -- JSON blob with targeting
    creative_guidance TEXT, -- JSON: brandVoice, keyMessage, visualStyle
    status TEXT DEFAULT 'draft', -- draft, review, active, paused, completed
    launch_date INTEGER,
    end_date INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ad creatives (generated content for campaigns)
CREATE TABLE ad_creatives (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    meta_creative_id TEXT, -- Meta's creative ID
    type TEXT NOT NULL, -- image, carousel, video
    primary_text TEXT, -- Main ad copy (≤125 chars for Meta)
    headline TEXT,
    description TEXT,
    image_url TEXT, -- Generated or uploaded image
    image_hash TEXT, -- Meta's image hash
    call_to_action TEXT DEFAULT 'LEARN_MORE',
    generation_prompt TEXT, -- Original AI prompt
    ai_model_used TEXT, -- Which AI model generated this
    performance_score REAL, -- Click-through rate, cost per lead
    status TEXT DEFAULT 'generated', -- generated, uploaded, active, paused
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Lead capture (from Meta lead gen forms)
CREATE TABLE leads (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    meta_lead_id TEXT UNIQUE, -- Meta's lead ID
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    custom_fields TEXT, -- JSON blob
    captured_at INTEGER DEFAULT (strftime('%s', 'now')),
    status TEXT DEFAULT 'active', -- active, converted, unsubscribed
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Drip campaigns (linked 1:1 with Meta campaigns)
CREATE TABLE drip_campaigns (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL UNIQUE, -- One drip campaign per Meta campaign
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL, -- lead_capture, time_delay, action_based
    template_id TEXT, -- Reference to pre-built templates
    channels TEXT NOT NULL, -- JSON array: ["sms", "email"] 
    sync_status TEXT DEFAULT 'draft', -- draft, active, paused, synchronized
    launch_date INTEGER, -- When both Meta and Twilio campaigns go live
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Individual drip messages
CREATE TABLE drip_messages (
    id TEXT PRIMARY KEY,
    drip_campaign_id TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    channel TEXT NOT NULL, -- sms, email
    delay_hours INTEGER DEFAULT 0,
    subject TEXT, -- for emails
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (drip_campaign_id) REFERENCES drip_campaigns(id)
);

-- Lead interaction tracking
CREATE TABLE lead_interactions (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    drip_message_id TEXT NOT NULL,
    sent_at INTEGER,
    delivered_at INTEGER,
    opened_at INTEGER, -- email opens
    clicked_at INTEGER, -- link clicks
    response_at INTEGER, -- SMS replies
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
    external_id TEXT, -- Twilio SID or SendGrid ID
    error_message TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (drip_message_id) REFERENCES drip_messages(id)
);

-- Webhook events (Meta webhooks and delivery tracking)
CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL, -- meta, twilio, sendgrid
    event_type TEXT NOT NULL, -- lead_captured, campaign_updated, message_delivered
    payload TEXT NOT NULL, -- JSON payload
    processed BOOLEAN DEFAULT false,
    processed_at INTEGER,
    error_message TEXT,
    received_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Performance analytics
CREATE TABLE campaign_analytics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads_captured INTEGER DEFAULT 0,
    cost_spent INTEGER DEFAULT 0, -- in cents
    ctr REAL DEFAULT 0.0, -- click-through rate
    cpl REAL DEFAULT 0.0, -- cost per lead
    roas REAL DEFAULT 0.0, -- return on ad spend (if tracking conversions)
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    UNIQUE(campaign_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_campaigns_user_status ON campaigns(user_id, status);
CREATE INDEX idx_campaigns_meta_id ON campaigns(meta_campaign_id);
CREATE INDEX idx_leads_campaign_status ON leads(campaign_id, status);
CREATE INDEX idx_leads_captured_at ON leads(captured_at);
CREATE INDEX idx_creatives_campaign ON ad_creatives(campaign_id);
CREATE INDEX idx_drip_messages_campaign ON drip_messages(drip_campaign_id, sequence_order);
CREATE INDEX idx_interactions_lead ON lead_interactions(lead_id);
CREATE INDEX idx_analytics_campaign_date ON campaign_analytics(campaign_id, date);
CREATE INDEX idx_webhook_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_source_type ON webhook_events(source, event_type);