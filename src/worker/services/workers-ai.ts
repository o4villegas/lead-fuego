// Workers AI service for content generation

import { Env } from '../types/env';
import { CreativeGuidance } from '../types/database';

export interface GeneratedContent {
  text: string;
  characterCount: number;
  model: string;
  prompt: string;
  valid: boolean;
}

export class WorkersAIService {
  constructor(private env: Env) {}

  /**
   * Generate Meta ad copy with strict 125 character limit
   */
  async generateAdCopy(
    campaignObjective: string,
    targetAudience: any,
    guidance?: CreativeGuidance,
    variations: number = 3
  ): Promise<GeneratedContent[]> {
    const results: GeneratedContent[] = [];
    
    for (let i = 0; i < variations; i++) {
      const prompt = this.buildAdCopyPrompt(campaignObjective, targetAudience, guidance, i);
      
      try {
        const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            {
              role: 'system',
              content: 'You are an expert Meta ad copywriter. Create compelling, concise ad copy under 125 characters that drives high CTR and conversions. Output ONLY the ad copy text, nothing else.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 60,
          temperature: 0.7 + (i * 0.1) // Slight variation for each attempt
        });

        const text = ((response as any).response || '').trim();
        const characterCount = text.length;
        
        results.push({
          text,
          characterCount,
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          prompt,
          valid: characterCount <= 125 && characterCount > 10
        });
      } catch (error) {
        console.error('Workers AI error:', error);
        // Add fallback content
        results.push({
          text: `Boost your ${campaignObjective.toLowerCase()} with proven strategies. Get started today!`,
          characterCount: 0,
          model: 'fallback',
          prompt,
          valid: false
        });
      }
    }
    
    return results;
  }

  /**
   * Generate headlines for ad creatives
   */
  async generateHeadlines(
    campaignObjective: string,
    primaryText: string,
    guidance?: CreativeGuidance
  ): Promise<GeneratedContent[]> {
    const prompt = this.buildHeadlinePrompt(campaignObjective, primaryText, guidance);
    
    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages: [
          {
            role: 'system',
            content: 'Generate 3 compelling headlines for Meta ads. Each headline should be under 40 characters and complement the primary text. Format as numbered list: 1. Headline 2. Headline 3. Headline'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.8
      });

      const responseText = (response as any).response || '';
      const headlines = this.parseNumberedList(responseText);
      
      return headlines.map(headline => ({
        text: headline,
        characterCount: headline.length,
        model: '@cf/meta/llama-3.1-8b-instruct-fp8',
        prompt,
        valid: headline.length <= 40 && headline.length > 5
      }));
    } catch (error) {
      console.error('Workers AI headline error:', error);
      return [
        {
          text: 'Get Started Today',
          characterCount: 17,
          model: 'fallback',
          prompt,
          valid: true
        }
      ];
    }
  }

  /**
   * Generate email drip content
   */
  async generateDripContent(
    type: 'sms' | 'email',
    leadData: any,
    campaignName: string,
    sequenceNumber: number
  ): Promise<GeneratedContent> {
    const prompt = this.buildDripPrompt(type, leadData, campaignName, sequenceNumber);
    const maxLength = type === 'sms' ? 160 : 500;
    
    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages: [
          {
            role: 'system',
            content: `Create ${type} content for lead nurturing sequence #${sequenceNumber}. Be personal, actionable, and focused on conversion. ${type === 'sms' ? 'Keep under 160 chars.' : 'Include compelling subject line.'}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: type === 'sms' ? 40 : 120,
        temperature: 0.6
      });

      const text = ((response as any).response || '').trim();
      
      return {
        text,
        characterCount: text.length,
        model: '@cf/meta/llama-3.1-8b-instruct-fp8',
        prompt,
        valid: text.length <= maxLength && text.length > 10
      };
    } catch (error) {
      console.error('Workers AI drip content error:', error);
      return {
        text: type === 'sms' 
          ? `Hi ${leadData.firstName}, thanks for your interest! We'll be in touch soon.`
          : `Subject: Welcome ${leadData.firstName}!\n\nThank you for your interest in ${campaignName}. We're excited to help you achieve your goals.`,
        characterCount: 0,
        model: 'fallback',
        prompt,
        valid: false
      };
    }
  }

  /**
   * Build ad copy generation prompt with guidance
   */
  private buildAdCopyPrompt(
    objective: string,
    audience: any,
    guidance?: CreativeGuidance,
    variation: number = 0
  ): string {
    const audienceStr = typeof audience === 'string' ? audience : JSON.stringify(audience);
    
    let prompt = `Create ad copy for ${objective} campaign targeting: ${audienceStr}.`;
    
    if (guidance?.brandVoice) {
      prompt += ` Brand voice: ${guidance.brandVoice}.`;
    }
    
    if (guidance?.keyMessage) {
      prompt += ` Key message: ${guidance.keyMessage}.`;
    }
    
    if (guidance?.visualStyle) {
      prompt += ` Visual style: ${guidance.visualStyle}.`;
    }
    
    // Add variation prompts
    const variationPrompts = [
      'Focus on urgency and scarcity.',
      'Emphasize benefits and value proposition.',
      'Use curiosity and intrigue.'
    ];
    
    if (variation < variationPrompts.length) {
      prompt += ` ${variationPrompts[variation]}`;
    }
    
    prompt += ' Create compelling ad copy under 125 characters that drives clicks.';
    
    return prompt;
  }

  /**
   * Build headline generation prompt
   */
  private buildHeadlinePrompt(
    objective: string,
    primaryText: string,
    guidance?: CreativeGuidance
  ): string {
    let prompt = `Primary ad text: "${primaryText}". Campaign objective: ${objective}.`;
    
    if (guidance?.keyMessage) {
      prompt += ` Key message: ${guidance.keyMessage}.`;
    }
    
    prompt += ' Create 3 complementary headlines under 40 characters each.';
    
    return prompt;
  }

  /**
   * Build drip content prompt
   */
  private buildDripPrompt(
    type: 'sms' | 'email',
    leadData: any,
    campaignName: string,
    sequenceNumber: number
  ): string {
    const sequencePurpose = [
      'welcome and introduction',
      'value demonstration',
      'objection handling',
      'final conversion push'
    ];
    
    const purpose = sequencePurpose[sequenceNumber - 1] || 'follow-up';
    
    return `Lead: ${leadData.firstName || 'Prospect'} interested in ${campaignName}. 
            Create ${type} message #${sequenceNumber} for ${purpose}. 
            ${leadData.company ? `Company: ${leadData.company}.` : ''}
            Make it personal and actionable.`;
  }

  /**
   * Parse numbered list response
   */
  private parseNumberedList(text: string): string[] {
    const lines = text.split('\n');
    const results: string[] = [];
    
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match && match[1]) {
        results.push(match[1].trim());
      }
    }
    
    // Fallback if parsing fails
    if (results.length === 0) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return sentences.slice(0, 3).map(s => s.trim());
    }
    
    return results.slice(0, 3);
  }

  /**
   * Validate generated content meets Meta requirements
   */
  validateContent(content: GeneratedContent, type: 'ad_copy' | 'headline' | 'sms' | 'email'): boolean {
    const limits = {
      ad_copy: 125,
      headline: 40,
      sms: 160,
      email: 500
    };
    
    const limit = limits[type];
    return content.characterCount <= limit && 
           content.characterCount > 5 && 
           content.text.trim().length > 0;
  }
}