# LeadFuego Integration Test Suite

## Overview

This test suite validates the critical API integrations that have 25% uncertainty in our development plan. These tests will increase our confidence from 75% to 95% before full development begins.

## Test Categories

### 🎯 Critical Integration Tests (5 Tests)
1. **Meta Creative Upload**: Validate DALL-E → Meta Creative API workflow
2. **Webhook Performance**: Measure webhook → D1 → Twilio response times  
3. **D1 Concurrent Writes**: Test database performance under load
4. **API Format Compatibility**: Ensure data flows correctly between services
5. **Cost Validation**: Monitor actual API costs vs projections

### 📂 Test Structure

```
tests/
├── README.md                    # This file
├── config/                      # Test configurations
│   ├── test.env.example         # Environment variables template
│   ├── wrangler.test.toml       # Cloudflare Workers test config
│   └── d1-schema.test.sql       # Test database schema
├── integration/                 # Critical API integration tests
│   ├── meta-creative-upload.test.ts
│   ├── webhook-performance.test.ts
│   ├── d1-concurrent-writes.test.ts
│   ├── api-format-compatibility.test.ts
│   └── cost-validation.test.ts
├── fixtures/                    # Test data and mock responses
│   ├── generated-images/        # Sample DALL-E outputs
│   ├── meta-responses/          # Mock Meta API responses
│   ├── webhook-payloads/        # Sample webhook data
│   └── test-credentials.json    # Sanitized API credentials
├── utils/                       # Test utilities and helpers
│   ├── api-clients.ts           # Configured API clients
│   ├── timing.ts                # Performance measurement tools
│   ├── db-helpers.ts            # D1 database test utilities
│   └── cost-tracker.ts          # API cost monitoring
├── results/                     # Test results and reports
│   ├── performance-metrics.json
│   ├── cost-analysis.json
│   └── integration-report.md
└── scripts/                     # Test runner scripts
    ├── run-all-tests.ts
    ├── setup-test-env.ts
    └── cleanup-test-data.ts
```

## Test Environment Setup

### Prerequisites
- Meta Business Account with ad spend history
- OpenAI API key with credits
- Twilio account with A2P 10DLC registration
- Cloudflare account with Workers Paid plan

### Environment Variables
Copy `tests/config/test.env.example` to `tests/config/test.env` and fill in your API credentials.

### Database Setup
Test database is isolated from production using `wrangler.test.toml` configuration.

## Running Tests

### Individual Tests
```bash
npm run test:meta-upload          # Test 1: Meta creative upload
npm run test:webhook-timing       # Test 2: Webhook performance  
npm run test:d1-concurrent        # Test 3: D1 load testing
npm run test:api-compatibility    # Test 4: API format validation
npm run test:cost-validation      # Test 5: Cost monitoring
```

### Full Test Suite
```bash
npm run test:integration          # Run all integration tests
npm run test:integration:report   # Generate comprehensive report
```

## Success Criteria

Each test has specific pass/fail criteria that must be met:

1. **Meta Creative Upload**: 95% successful upload rate for DALL-E images
2. **Webhook Performance**: <3 second end-to-end processing time
3. **D1 Concurrent Writes**: Handle 50 concurrent writes without errors
4. **API Compatibility**: 100% data format compatibility across services
5. **Cost Validation**: Actual costs within 20% of projections

## Test Results

Results are automatically saved to `tests/results/` directory:
- Performance metrics (response times, throughput)
- Cost analysis (actual spend vs projections)
- Integration compatibility report
- Error logs and failure analysis

## Important Notes

⚠️ **Cost Warning**: These tests use real API services and will incur costs
⚠️ **Rate Limits**: Tests respect API rate limits with appropriate delays  
⚠️ **Test Data**: All test data is clearly marked and separate from production
⚠️ **Cleanup**: Automated cleanup removes test campaigns and data after completion