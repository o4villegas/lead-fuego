-- LeadFuego Test Database Schema
-- Minimal schema for integration testing only

-- Test clients table
CREATE TABLE IF NOT EXISTS test_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Test Client',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Test campaigns table  
CREATE TABLE IF NOT EXISTS test_campaigns (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    meta_campaign_id TEXT,
    status TEXT DEFAULT 'draft',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (client_id) REFERENCES test_clients(id)
);

-- Test creatives table
CREATE TABLE IF NOT EXISTS test_creatives (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content_text TEXT,
    image_url TEXT,
    meta_creative_id TEXT,
    openai_cost REAL DEFAULT 0.0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (campaign_id) REFERENCES test_campaigns(id)
);

-- Test leads table (for webhook testing)
CREATE TABLE IF NOT EXISTS test_leads (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    meta_lead_id TEXT,
    webhook_received_at INTEGER DEFAULT (strftime('%s', 'now')),
    processed_at INTEGER,
    processing_time_ms INTEGER,
    FOREIGN KEY (campaign_id) REFERENCES test_campaigns(id)
);

-- Test API usage tracking
CREATE TABLE IF NOT EXISTS test_api_usage (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    endpoint TEXT,
    cost_usd REAL DEFAULT 0.0,
    response_time_ms INTEGER,
    status_code INTEGER,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Performance testing table for concurrent writes
CREATE TABLE IF NOT EXISTS test_concurrent_writes (
    id TEXT PRIMARY KEY,
    test_run_id TEXT NOT NULL,
    thread_id INTEGER NOT NULL,
    write_order INTEGER NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    processing_time_ms INTEGER
);

-- Create indexes for test performance
CREATE INDEX IF NOT EXISTS idx_test_leads_webhook ON test_leads(webhook_received_at);
CREATE INDEX IF NOT EXISTS idx_test_api_usage_service ON test_api_usage(service, timestamp);
CREATE INDEX IF NOT EXISTS idx_test_concurrent_run ON test_concurrent_writes(test_run_id);

-- Insert default test client
INSERT OR IGNORE INTO test_clients (id, name) VALUES ('test-client-1', 'Integration Test Client');