import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types/env';
import { authRoutes } from './routes/auth';
import { campaignRoutes } from './routes/campaigns';
import { creativeRoutes } from './routes/creatives';
import { webhookRoutes } from './routes/webhooks';
import { dripCampaignRoutes } from './routes/drip-campaigns';
import { errorHandler } from './middleware/error-handler';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: (origin) => origin, // Allow all origins in development
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Health check endpoint
app.get('/api/', (c) => c.json({ 
  name: 'LeadFuego API',
  version: '2.0.0',
  status: 'healthy',
  features: [
    'Authentication',
    'Campaign Management', 
    'AI Content Generation',
    'Meta API Integration',
    'Lead Capture Webhooks',
    'Drip Campaign Automation'
  ],
  timestamp: new Date().toISOString()
}));

// Mount route groups
app.route('/api/auth', authRoutes);
app.route('/api/campaigns', campaignRoutes);
app.route('/api/creatives', creativeRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/drip', dripCampaignRoutes);

// Global error handler
app.onError(errorHandler);

// 404 handler for API routes
app.all('/api/*', (c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

export default app;
