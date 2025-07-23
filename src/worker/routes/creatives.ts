// Creative generation routes - AI-powered content creation with smart variations

import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { GenerateCreativeRequest, ApiResponse } from '../types/api';
import { AdCreative, CreativeGuidance } from '../types/database';
import { DatabaseService } from '../services/database';
import { WorkersAIService } from '../services/workers-ai';
import { OpenAIService } from '../services/openai';
import { MetaAPIService } from '../services/meta-api';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';

// Validation schemas
const generateCreativeSchema = z.object({
  campaignId: z.string().min(1, 'Campaign ID is required'),
  prompt: z.string().max(500, 'Prompt too long').optional(),
  variations: z.number().min(1).max(5).default(3),
  regenerate: z.boolean().default(false),
  includeImages: z.boolean().default(true)
});

const approveCreativeSchema = z.object({
  creativeId: z.string().min(1, 'Creative ID is required'),
  approved: z.boolean()
});

export const creativeRoutes = new Hono<{ Bindings: Env }>();

// All routes require authentication
creativeRoutes.use('*', authMiddleware);

// POST /api/creatives/generate - Generate AI content with smart variations
creativeRoutes.post('/generate', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<GenerateCreativeRequest>();
    const validated = generateCreativeSchema.parse(body);
    
    // Get campaign details
    const db = new DatabaseService(c.env.DB);
    const campaign = await db.getCampaignById(validated.campaignId);
    
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
    
    // Parse guidance and audience
    const guidance: CreativeGuidance | undefined = campaign.creative_guidance 
      ? JSON.parse(campaign.creative_guidance) 
      : undefined;
    const audience = JSON.parse(campaign.target_audience);
    
    // Initialize AI services
    const workersAI = new WorkersAIService(c.env);
    const openAI = new OpenAIService(c.env);
    
    // Generate ad copy variations with Workers AI
    console.log('Generating ad copy with Workers AI...');
    const adCopyVariations = await workersAI.generateAdCopy(
      campaign.objective,
      audience,
      guidance,
      validated.variations
    );
    
    // Filter valid ad copy
    const validAdCopy = adCopyVariations.filter(copy => copy.valid);
    if (validAdCopy.length === 0) {
      return c.json({
        success: false,
        error: 'Failed to generate valid ad copy under 125 characters'
      }, 500);
    }
    
    const creatives: AdCreative[] = [];
    
    // Generate content for each valid ad copy variation
    for (let i = 0; i < validAdCopy.length; i++) {
      const adCopy = validAdCopy[i];
      const creativeId = await generateId();
      
      try {
        // Generate headlines for this ad copy
        const headlines = await workersAI.generateHeadlines(
          campaign.objective,
          adCopy.text,
          guidance
        );
        const bestHeadline = headlines.find(h => h.valid)?.text || 'Get Started Today';
        
        let imageUrl = '';
        let imageHash = '';
        
        // Generate image if requested and OpenAI is configured
        if (validated.includeImages && openAI.isConfigured()) {
          console.log(`Generating image ${i + 1} with DALL-E...`);
          const image = await openAI.generateImage(
            campaign.objective,
            adCopy.text,
            guidance,
            i === 0 ? 'hd' : 'standard' // First image in HD
          );
          
          if (image.valid) {
            imageUrl = image.url;
            // Optimize with Cloudflare Images
            imageUrl = await openAI.optimizeImage(imageUrl);
          }
        }
        
        // Create ad creative record
        const creative: AdCreative = {
          id: creativeId,
          campaign_id: campaign.id,
          type: 'image',
          primary_text: adCopy.text,
          headline: bestHeadline,
          description: `AI-generated creative for ${campaign.objective}`,
          image_url: imageUrl,
          image_hash: imageHash,
          call_to_action: 'LEARN_MORE',
          generation_prompt: adCopy.prompt,
          ai_model_used: `${adCopy.model} + ${openAI.isConfigured() ? 'dall-e-3' : 'no-image'}`,
          status: 'generated',
          created_at: Date.now()
        };
        
        // Save to database
        await db.createAdCreative(creative);
        creatives.push(creative);
        
        console.log(`Created creative ${i + 1}/${validAdCopy.length}`);
        
      } catch (error) {
        console.error(`Error creating creative ${i + 1}:`, error);
        // Continue with other variations
      }
    }
    
    if (creatives.length === 0) {
      return c.json({
        success: false,
        error: 'Failed to generate any valid creatives'
      }, 500);
    }
    
    const response: ApiResponse<AdCreative[]> = {
      success: true,
      data: creatives,
      meta: {
        total: creatives.length,
        workersAICost: validAdCopy.length * 0.00001, // Estimated cost
        openAICost: validated.includeImages ? validAdCopy.length * 0.08 : 0
      }
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
    
    console.error('Generate creative error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to generate creatives' 
    }, 500);
  }
});

// POST /api/creatives/:id/preview - Generate Meta ad previews
creativeRoutes.post('/:id/preview', async (c) => {
  try {
    // const user = c.get('user'); // Will be used for ownership verification
    const creativeId = c.req.param('id');
    
    // TODO: Implement getCreativeById in DatabaseService
    // const db = new DatabaseService(c.env.DB);
    // const creative = await db.getCreativeById(creativeId);
    
    // For now, return mock preview data
    // In production, this would use Meta's generatepreviews API
    const previews = [
      {
        platform: 'facebook_desktop',
        preview_url: 'https://mockup.facebook.com/preview/desktop',
        body: 'Sample ad text goes here',
        headline: 'Sample Headline',
        image_url: 'https://via.placeholder.com/1200x630'
      },
      {
        platform: 'instagram_feed',
        preview_url: 'https://mockup.instagram.com/preview/feed',
        body: 'Sample ad text goes here',
        headline: 'Sample Headline',
        image_url: 'https://via.placeholder.com/1080x1080'
      }
    ];
    
    // Mock check for creative existence
    if (!creativeId) {
      return c.json({ 
        success: false, 
        error: 'Creative not found' 
      }, 404);
    }
    
    const response: ApiResponse<any[]> = {
      success: true,
      data: previews
    };
    
    return c.json(response);
    
  } catch (error) {
    console.error('Preview generation error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to generate previews' 
    }, 500);
  }
});

// POST /api/creatives/:id/approve - Approve creative for campaign launch
creativeRoutes.post('/:id/approve', async (c) => {
  try {
    // const user = c.get('user'); // Will be used for ownership verification
    // const creativeId = c.req.param('id'); // Will be used to identify creative
    const body = await c.req.json();
    const validated = approveCreativeSchema.parse(body);
    
    // const db = new DatabaseService(c.env.DB); // Will be used for database operations
    
    // Update creative status
    // TODO: Implement updateCreative method in DatabaseService
    const status = validated.approved ? 'approved' : 'rejected';
    
    // For now, just return success
    // In production, this would update the database and potentially trigger Meta campaign creation
    
    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status }
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
    
    console.error('Approve creative error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to approve creative' 
    }, 500);
  }
});

// POST /api/creatives/launch - Launch approved creatives to Meta
creativeRoutes.post('/launch', async (c) => {
  try {
    const user = c.get('user');
    const { campaignId } = await c.req.json();
    
    if (!campaignId) {
      return c.json({
        success: false,
        error: 'Campaign ID is required'
      }, 400);
    }
    
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
    
    // Get user's Meta credentials (in production, these would be encrypted in database)
    const metaAPI = new MetaAPIService(
      c.env.META_ACCESS_TOKEN || '',
      c.env.META_AD_ACCOUNT_ID || '',
      c.env.META_APP_SECRET || ''
    );
    
    if (!metaAPI.isConfigured()) {
      return c.json({
        success: false,
        error: 'Meta API credentials not configured'
      }, 400);
    }
    
    // Validate credentials
    const validation = await metaAPI.validateCredentials();
    if (!validation.valid) {
      return c.json({
        success: false,
        error: `Meta API validation failed: ${validation.error}`
      }, 400);
    }
    
    // For now, return success without actually launching
    // In production, this would:
    // 1. Create Meta campaign
    // 2. Create ad sets
    // 3. Upload images
    // 4. Create creatives
    // 5. Create ads
    // 6. Update campaign status to 'active'
    
    const response: ApiResponse<{ metaCampaignId: string; status: string }> = {
      success: true,
      data: {
        metaCampaignId: 'mock_meta_campaign_123',
        status: 'launched'
      }
    };
    
    return c.json(response);
    
  } catch (error) {
    console.error('Launch creative error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to launch campaign' 
    }, 500);
  }
});

// GET /api/creatives/costs - Get estimated costs for generation
creativeRoutes.get('/costs', async (c) => {
  const variations = parseInt(c.req.query('variations') || '3');
  const includeImages = c.req.query('includeImages') === 'true';
  
  const workersAICost = variations * 0.00001; // $0.00001 per text generation
  const openAICost = includeImages ? variations * 0.08 : 0; // $0.08 per HD image
  const totalCost = workersAICost + openAICost;
  
  const response: ApiResponse<any> = {
    success: true,
    data: {
      workersAI: workersAICost,
      openAI: openAICost,
      total: totalCost,
      variations,
      includeImages
    }
  };
  
  return c.json(response);
});