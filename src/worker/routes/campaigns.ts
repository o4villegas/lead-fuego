// Campaign management routes - CRUD operations for campaigns

import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { CreateCampaignRequest, ApiResponse } from '../types/api';
import { Campaign } from '../types/database';
import { DatabaseService } from '../services/database';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name too long'),
  objective: z.enum(['LEAD_GENERATION', 'CONVERSIONS', 'TRAFFIC', 'AWARENESS']),
  dailyBudget: z.number().min(5, 'Minimum daily budget is $5').max(10000, 'Maximum daily budget is $10,000'),
  targetAudience: z.object({
    ageMin: z.number().min(13).max(65).optional(),
    ageMax: z.number().min(18).max(65).optional(),
    genders: z.array(z.enum(['male', 'female', 'all'])).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional()
  }),
  creativeGuidance: z.object({
    brandVoice: z.string().max(100).optional(),
    keyMessage: z.string().max(200).optional(),
    visualStyle: z.string().max(100).optional()
  }).optional()
});

const updateCampaignSchema = createCampaignSchema.partial();

export const campaignRoutes = new Hono<{ Bindings: Env }>();

// All campaign routes require authentication
campaignRoutes.use('*', authMiddleware);

// GET /api/campaigns - List user's campaigns
campaignRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    
    const db = new DatabaseService(c.env.DB);
    const campaigns = await db.getCampaignsByUserId(user.id, limit, offset);
    
    const response: ApiResponse<Campaign[]> = {
      success: true,
      data: campaigns,
      meta: {
        page,
        limit,
        total: campaigns.length
      }
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Get campaigns error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to retrieve campaigns' 
    }, 500);
  }
});

// POST /api/campaigns - Create new campaign
campaignRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<CreateCampaignRequest>();
    const validated = createCampaignSchema.parse(body);
    
    // Create campaign object
    const campaignId = await generateId();
    const now = Date.now();
    
    const campaign: Campaign = {
      id: campaignId,
      user_id: user.id,
      name: validated.name,
      objective: validated.objective,
      daily_budget: validated.dailyBudget * 100, // Convert to cents
      target_audience: JSON.stringify(validated.targetAudience),
      creative_guidance: validated.creativeGuidance ? JSON.stringify(validated.creativeGuidance) : undefined,
      status: 'draft',
      is_active: true,
      created_at: now,
      updated_at: now
    };
    
    // Save to database
    const db = new DatabaseService(c.env.DB);
    await db.createCampaign(campaign);
    
    // Return created campaign
    const response: ApiResponse<Campaign> = {
      success: true,
      data: campaign
    };
    
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Create campaign error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create campaign' 
    }, 500);
  }
});

// GET /api/campaigns/:id - Get specific campaign
campaignRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    
    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getCampaignById(campaignId);
    
    if (!campaign) {
      return c.json({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Verify ownership
    if (campaign.user_id !== user.id) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, 403);
    }
    
    const response: ApiResponse<Campaign> = {
      success: true,
      data: campaign
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Get campaign error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to retrieve campaign' 
    }, 500);
  }
});

// PUT /api/campaigns/:id - Update campaign
campaignRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    const body = await c.req.json();
    const validated = updateCampaignSchema.parse(body);
    
    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getCampaignById(campaignId);
    
    if (!campaign) {
      return c.json({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Verify ownership
    if (campaign.user_id !== user.id) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, 403);
    }
    
    // Prevent updates to launched campaigns
    if (campaign.status === 'active') {
      return c.json({ 
        success: false, 
        error: 'Cannot modify active campaigns' 
      }, 400);
    }
    
    // Build update object
    const updates: Partial<Campaign> = {};
    if (validated.name) updates.name = validated.name;
    if (validated.objective) updates.objective = validated.objective;
    if (validated.dailyBudget) updates.daily_budget = validated.dailyBudget * 100;
    if (validated.targetAudience) updates.target_audience = JSON.stringify(validated.targetAudience);
    if (validated.creativeGuidance) updates.creative_guidance = JSON.stringify(validated.creativeGuidance);
    
    // Update campaign
    await db.updateCampaign(campaignId, updates);
    
    // Get updated campaign
    const updatedCampaign = await db.getCampaignById(campaignId);
    
    const response: ApiResponse<Campaign> = {
      success: true,
      data: updatedCampaign!
    };
    
    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      }, 400);
    }
    
    console.error('Update campaign error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update campaign' 
    }, 500);
  }
});

// DELETE /api/campaigns/:id - Delete campaign (soft delete)
campaignRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    
    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getCampaignById(campaignId);
    
    if (!campaign) {
      return c.json({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Verify ownership
    if (campaign.user_id !== user.id) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, 403);
    }
    
    // Prevent deletion of active campaigns
    if (campaign.status === 'active') {
      return c.json({ 
        success: false, 
        error: 'Cannot delete active campaigns. Pause first.' 
      }, 400);
    }
    
    // Soft delete by setting is_active to false
    await db.updateCampaign(campaignId, { 
      is_active: false,
      status: 'deleted'
    });
    
    return c.json({ 
      success: true, 
      message: 'Campaign deleted successfully' 
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete campaign' 
    }, 500);
  }
});

// GET /api/campaigns/:id/creatives - Get campaign creatives
campaignRoutes.get('/:id/creatives', async (c) => {
  try {
    const user = c.get('user');
    const campaignId = c.req.param('id');
    
    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getCampaignById(campaignId);
    
    if (!campaign) {
      return c.json({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Verify ownership
    if (campaign.user_id !== user.id) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, 403);
    }
    
    const creatives = await db.getCreativesByCampaignId(campaignId);
    
    const response: ApiResponse<any[]> = {
      success: true,
      data: creatives
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Get creatives error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to retrieve creatives' 
    }, 500);
  }
});