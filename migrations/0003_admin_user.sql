-- Create admin user for testing
-- Admin credentials: UN=admin, PW=admin123

INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    company,
    subscription_tier,
    onboarding_completed,
    is_active,
    created_at,
    updated_at
) VALUES (
    'admin-001',
    'admin',
    'JAvlGPq9JyTdtvBO6x2llnRI1+gxwIyPqCKAn3THIKk=', -- SHA-256 hash of 'admin123'
    'Admin',
    'User',
    'LeadFuego',
    'enterprise',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);