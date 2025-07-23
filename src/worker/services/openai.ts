// OpenAI service for DALL-E image generation

import { Env } from '../types/env';
import { CreativeGuidance } from '../types/database';

export interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  quality: string;
  size: string;
  valid: boolean;
  optimizedUrl?: string; // After Cloudflare Images processing
}

export class OpenAIService {
  private readonly BASE_URL = 'https://api.openai.com/v1';
  
  constructor(private env: Env) {}

  /**
   * Generate high-quality images using DALL-E 3
   */
  async generateImage(
    campaignObjective: string,
    adCopy: string,
    guidance?: CreativeGuidance,
    quality: 'standard' | 'hd' = 'hd'
  ): Promise<GeneratedImage> {
    const prompt = this.buildImagePrompt(campaignObjective, adCopy, guidance);
    
    try {
      const response = await fetch(`${this.BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          size: '1024x1024',
          quality: quality,
          n: 1,
          response_format: 'url'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json() as any;
      const imageUrl = data.data[0].url;

      return {
        url: imageUrl,
        prompt,
        model: 'dall-e-3',
        quality,
        size: '1024x1024',
        valid: true
      };
    } catch (error) {
      console.error('OpenAI image generation error:', error);
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple image variations
   */
  async generateImageVariations(
    campaignObjective: string,
    adCopy: string,
    guidance?: CreativeGuidance,
    count: number = 3
  ): Promise<GeneratedImage[]> {
    const images: GeneratedImage[] = [];
    const basePrompt = this.buildImagePrompt(campaignObjective, adCopy, guidance);
    
    // Create different style variations
    const styleVariations = [
      'modern minimalist style',
      'vibrant colorful design',
      'professional clean aesthetic'
    ];

    for (let i = 0; i < Math.min(count, 3); i++) {
      try {
        const styleVariation = styleVariations[i] || 'professional style';
        const enhancedPrompt = `${basePrompt}, ${styleVariation}`;
        
        const image = await this.generateImage(campaignObjective, adCopy, {
          ...guidance,
          visualStyle: `${guidance?.visualStyle || ''} ${styleVariation}`.trim()
        }, i === 0 ? 'hd' : 'standard'); // First image in HD, others standard
        
        images.push({
          ...image,
          prompt: enhancedPrompt
        });
        
        // Small delay to avoid rate limits
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Image variation ${i + 1} failed:`, error);
        // Continue with other variations even if one fails
      }
    }

    return images;
  }

  /**
   * Optimize image with Cloudflare Images
   */
  async optimizeImage(imageUrl: string): Promise<string> {
    try {
      // Check if IMAGES service is available
      if (!this.env.IMAGES) {
        console.log('IMAGES service not available, returning original URL');
        return imageUrl;
      }

      // Upload to Cloudflare Images for optimization
      const formData = new FormData();
      formData.append('url', imageUrl);
      formData.append('metadata', JSON.stringify({
        source: 'dalle-3',
        optimized: true
      }));

      const response = await this.env.IMAGES.fetch('/images/v1', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Images API error: ${response.status}`);
      }

      const result = await response.json() as any;
      return result.result.variants[0]; // Return optimized URL
    } catch (error) {
      console.error('Image optimization error:', error);
      return imageUrl; // Return original URL if optimization fails
    }
  }

  /**
   * Build comprehensive image generation prompt
   */
  private buildImagePrompt(
    objective: string,
    adCopy: string,
    guidance?: CreativeGuidance
  ): string {
    let prompt = `Professional advertising image for ${objective.toLowerCase()} campaign. `;
    
    // Add ad copy context
    prompt += `Ad copy: "${adCopy}". `;
    
    // Apply creative guidance
    if (guidance?.visualStyle) {
      prompt += `Visual style: ${guidance.visualStyle}. `;
    }
    
    if (guidance?.keyMessage) {
      prompt += `Key message focus: ${guidance.keyMessage}. `;
    }
    
    if (guidance?.brandVoice) {
      prompt += `Brand mood: ${guidance.brandVoice.toLowerCase()}. `;
    }
    
    // Add Meta-specific requirements
    prompt += 'High-quality commercial photography style, ';
    prompt += 'no text overlays or words, ';
    prompt += 'suitable for Facebook/Instagram advertising, ';
    prompt += 'engaging and click-worthy, ';
    prompt += '1024x1024 aspect ratio, ';
    prompt += 'professional lighting and composition.';
    
    return prompt;
  }

  /**
   * Validate image meets Meta advertising requirements
   */
  validateImage(image: GeneratedImage): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check URL validity
    if (!image.url || !image.url.startsWith('https://')) {
      issues.push('Invalid image URL');
    }
    
    // Check size requirements
    if (image.size !== '1024x1024') {
      issues.push('Image must be 1024x1024 pixels');
    }
    
    // Check if prompt might contain restricted content
    const restrictedTerms = ['weapon', 'violence', 'adult', 'gambling', 'crypto'];
    if (restrictedTerms.some(term => image.prompt.toLowerCase().includes(term))) {
      issues.push('Prompt may contain restricted content');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get estimated cost for image generation
   */
  getEstimatedCost(quality: 'standard' | 'hd', count: number = 1): number {
    const costs = {
      standard: 0.04, // $0.04 per image
      hd: 0.08        // $0.08 per image
    };
    
    return costs[quality] * count;
  }

  /**
   * Check if OpenAI API key is configured
   */
  isConfigured(): boolean {
    return !!this.env.OPENAI_API_KEY && this.env.OPENAI_API_KEY.length > 0;
  }
}