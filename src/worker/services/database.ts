// Database service layer for D1 operations

// D1Database type is available globally in Workers environment
import { 
  User, 
  Campaign, 
  AdCreative, 
  Lead, 
  DripCampaign, 
  DripStep, 
  LeadJourney, 
  SMSMessage, 
  EmailMessage 
} from '../types/database';

export class DatabaseService {
  constructor(private db: D1Database) {}

  // User operations
  async createUser(user: User): Promise<void> {
    await this.db.prepare(`
      INSERT INTO users (
        id, email, password_hash, first_name, last_name, company,
        subscription_tier, onboarding_completed, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      user.email,
      user.password_hash,
      user.first_name || null,
      user.last_name || null,
      user.company || null,
      user.subscription_tier,
      user.onboarding_completed ? 1 : 0,
      user.is_active ? 1 : 0,
      user.created_at,
      user.updated_at
    ).run();
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first<User>();
    
    return result ? this.mapUserFromDb(result) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    return result ? this.mapUserFromDb(result) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => updates[key as keyof User]);
    
    values.push(Date.now()); // updated_at
    values.push(id); // WHERE id = ?

    await this.db.prepare(`
      UPDATE users SET ${fields}, updated_at = ? WHERE id = ?
    `).bind(...values).run();
  }

  // Campaign operations
  async createCampaign(campaign: Campaign): Promise<void> {
    await this.db.prepare(`
      INSERT INTO campaigns (
        id, user_id, meta_campaign_id, name, objective, daily_budget,
        target_audience, creative_guidance, status, launch_date, end_date,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaign.id,
      campaign.user_id,
      campaign.meta_campaign_id || null,
      campaign.name,
      campaign.objective,
      campaign.daily_budget,
      campaign.target_audience,
      campaign.creative_guidance || null,
      campaign.status,
      campaign.launch_date || null,
      campaign.end_date || null,
      campaign.is_active ? 1 : 0,
      campaign.created_at,
      campaign.updated_at
    ).run();
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const result = await this.db.prepare(
      'SELECT * FROM campaigns WHERE id = ?'
    ).bind(id).first<Campaign>();
    
    return result ? this.mapCampaignFromDb(result) : null;
  }

  async getCampaignsByUserId(userId: string, limit = 20, offset = 0): Promise<Campaign[]> {
    const results = await this.db.prepare(`
      SELECT * FROM campaigns 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all<Campaign>();
    
    return results.results.map(this.mapCampaignFromDb);
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => updates[key as keyof Campaign]);
    
    values.push(Date.now()); // updated_at
    values.push(id); // WHERE id = ?

    await this.db.prepare(`
      UPDATE campaigns SET ${fields}, updated_at = ? WHERE id = ?
    `).bind(...values).run();
  }

  // Creative operations
  async createAdCreative(creative: AdCreative): Promise<void> {
    await this.db.prepare(`
      INSERT INTO ad_creatives (
        id, campaign_id, meta_creative_id, type, primary_text, headline,
        description, image_url, image_hash, call_to_action, generation_prompt,
        ai_model_used, performance_score, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      creative.id,
      creative.campaign_id,
      creative.meta_creative_id,
      creative.type,
      creative.primary_text,
      creative.headline,
      creative.description,
      creative.image_url,
      creative.image_hash,
      creative.call_to_action,
      creative.generation_prompt,
      creative.ai_model_used,
      creative.performance_score,
      creative.status,
      creative.created_at
    ).run();
  }

  async getCreativesByCampaignId(campaignId: string): Promise<AdCreative[]> {
    const results = await this.db.prepare(`
      SELECT * FROM ad_creatives 
      WHERE campaign_id = ? 
      ORDER BY created_at DESC
    `).bind(campaignId).all<AdCreative>();
    
    return results.results;
  }

  // Lead operations
  async createLead(lead: Lead): Promise<void> {
    await this.db.prepare(`
      INSERT INTO leads (
        id, campaign_id, meta_lead_id, first_name, last_name, email,
        phone, company, custom_fields, captured_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      lead.id,
      lead.campaign_id,
      lead.meta_lead_id,
      lead.first_name,
      lead.last_name,
      lead.email,
      lead.phone,
      lead.company,
      lead.custom_fields,
      lead.captured_at,
      lead.status
    ).run();
  }

  async getLeadsByCampaignId(campaignId: string, limit = 50, offset = 0): Promise<Lead[]> {
    const results = await this.db.prepare(`
      SELECT * FROM leads 
      WHERE campaign_id = ? 
      ORDER BY captured_at DESC 
      LIMIT ? OFFSET ?
    `).bind(campaignId, limit, offset).all<Lead>();
    
    return results.results;
  }

  async getLeadByMetaId(metaLeadId: string): Promise<Lead | null> {
    return await this.db.prepare(
      'SELECT * FROM leads WHERE meta_lead_id = ?'
    ).bind(metaLeadId).first<Lead>();
  }

  async getLeadById(id: string): Promise<Lead | null> {
    return await this.db.prepare(
      'SELECT * FROM leads WHERE id = ?'
    ).bind(id).first<Lead>();
  }

  // Ad Creative operations
  async getCreativeById(id: string): Promise<AdCreative | null> {
    return await this.db.prepare(
      'SELECT * FROM ad_creatives WHERE id = ?'
    ).bind(id).first<AdCreative>();
  }

  async updateCreative(id: string, updates: Partial<AdCreative>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => (updates as any)[key]);
    
    await this.db.prepare(`
      UPDATE ad_creatives 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  // Helper methods to map database boolean values
  private mapUserFromDb(user: any): User {
    return {
      ...user,
      onboarding_completed: user.onboarding_completed === 1,
      is_active: user.is_active === 1
    };
  }

  private mapCampaignFromDb(campaign: any): Campaign {
    return {
      ...campaign,
      is_active: campaign.is_active === 1
    };
  }

  // Drip Campaign operations
  async createDripCampaign(campaign: DripCampaign): Promise<void> {
    await this.db.prepare(`
      INSERT INTO drip_campaigns (
        id, name, description, trigger_type, total_steps, active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaign.id,
      campaign.name,
      campaign.description || null,
      campaign.trigger_type,
      campaign.total_steps,
      campaign.active ? 1 : 0,
      campaign.created_by,
      campaign.created_at,
      campaign.updated_at
    ).run();
  }

  async getDripCampaignById(id: string): Promise<DripCampaign | null> {
    const result = await this.db.prepare(
      'SELECT * FROM drip_campaigns WHERE id = ?'
    ).bind(id).first<DripCampaign>();
    
    return result ? this.mapDripCampaignFromDb(result) : null;
  }

  async getDripCampaignsByUser(userId: string): Promise<DripCampaign[]> {
    const results = await this.db.prepare(
      'SELECT * FROM drip_campaigns WHERE created_by = ? ORDER BY created_at DESC'
    ).bind(userId).all<DripCampaign>();
    
    return results.results.map(campaign => this.mapDripCampaignFromDb(campaign));
  }

  async updateDripCampaign(id: string, updates: Partial<DripCampaign>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => {
        const value = (updates as any)[key];
        if (key === 'active' && typeof value === 'boolean') {
          return value ? 1 : 0;
        }
        return value;
      });
    
    await this.db.prepare(`
      UPDATE drip_campaigns 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  async deleteDripCampaign(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM drip_campaigns WHERE id = ?').bind(id).run();
  }

  // Drip Step operations
  async createDripStep(step: DripStep): Promise<void> {
    await this.db.prepare(`
      INSERT INTO drip_steps (
        id, campaign_id, step_number, channel, delay_minutes, content_template,
        subject_template, sendgrid_template_id, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      step.id,
      step.campaign_id,
      step.step_number,
      step.channel,
      step.delay_minutes,
      step.content_template || null,
      step.subject_template || null,
      step.sendgrid_template_id || null,
      step.active ? 1 : 0,
      step.created_at
    ).run();
  }

  async getDripStepsByCampaign(campaignId: string): Promise<DripStep[]> {
    const results = await this.db.prepare(
      'SELECT * FROM drip_steps WHERE campaign_id = ? ORDER BY step_number ASC'
    ).bind(campaignId).all<DripStep>();
    
    return results.results.map(step => this.mapDripStepFromDb(step));
  }

  async getDripStepByNumber(campaignId: string, stepNumber: number): Promise<DripStep | null> {
    const result = await this.db.prepare(
      'SELECT * FROM drip_steps WHERE campaign_id = ? AND step_number = ?'
    ).bind(campaignId, stepNumber).first<DripStep>();
    
    return result ? this.mapDripStepFromDb(result) : null;
  }

  // Lead Journey operations
  async createLeadJourney(journey: LeadJourney): Promise<void> {
    await this.db.prepare(`
      INSERT INTO lead_journeys (
        id, lead_id, campaign_id, current_step, status, started_at, last_interaction_at,
        total_sms_sent, total_emails_sent, total_opens, total_clicks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      journey.id,
      journey.lead_id,
      journey.campaign_id,
      journey.current_step,
      journey.status,
      journey.started_at,
      journey.last_interaction_at || null,
      journey.total_sms_sent,
      journey.total_emails_sent,
      journey.total_opens,
      journey.total_clicks,
      journey.created_at,
      journey.updated_at
    ).run();
  }

  async getJourneyByLeadAndCampaign(leadId: string, campaignId: string): Promise<LeadJourney | null> {
    const result = await this.db.prepare(
      'SELECT * FROM lead_journeys WHERE lead_id = ? AND campaign_id = ?'
    ).bind(leadId, campaignId).first<LeadJourney>();
    
    return result || null;
  }

  async getJourneysByUser(userId: string, limit = 50, offset = 0, status?: string): Promise<LeadJourney[]> {
    let query = `
      SELECT lj.* FROM lead_journeys lj
      JOIN drip_campaigns dc ON lj.campaign_id = dc.id
      WHERE dc.created_by = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND lj.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lj.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit.toString(), offset.toString());

    const results = await this.db.prepare(query).bind(...params).all<LeadJourney>();
    return results.results;
  }

  async getActiveJourneysByCampaign(campaignId: string): Promise<LeadJourney[]> {
    const results = await this.db.prepare(
      'SELECT * FROM lead_journeys WHERE campaign_id = ? AND status = "active"'
    ).bind(campaignId).all<LeadJourney>();
    
    return results.results;
  }

  async updateLeadJourney(id: string, updates: Partial<LeadJourney>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => (updates as any)[key]);
    
    await this.db.prepare(`
      UPDATE lead_journeys 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  // SMS Message operations
  async createSMSMessage(message: SMSMessage): Promise<void> {
    await this.db.prepare(`
      INSERT INTO sms_messages (
        id, lead_id, drip_step_id, to_number, from_number, content, status,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      message.id,
      message.lead_id,
      message.drip_step_id || null,
      message.to_number,
      message.from_number,
      message.content,
      message.status,
      message.scheduled_at,
      message.created_at,
      message.updated_at
    ).run();
  }

  async getPendingSMSMessages(limit = 100): Promise<SMSMessage[]> {
    const results = await this.db.prepare(`
      SELECT * FROM sms_messages 
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
      LIMIT ?
    `).bind(Date.now(), limit).all<SMSMessage>();
    
    return results.results;
  }

  async updateSMSMessage(id: string, updates: Partial<SMSMessage>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => (updates as any)[key]);
    
    await this.db.prepare(`
      UPDATE sms_messages 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  // Email Message operations
  async createEmailMessage(message: EmailMessage): Promise<void> {
    await this.db.prepare(`
      INSERT INTO email_messages (
        id, lead_id, drip_step_id, to_email, subject, template_id, dynamic_data,
        status, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      message.id,
      message.lead_id,
      message.drip_step_id || null,
      message.to_email,
      message.subject,
      message.template_id || null,
      message.dynamic_data || null,
      message.status,
      message.scheduled_at,
      message.created_at,
      message.updated_at
    ).run();
  }

  async getPendingEmailMessages(limit = 100): Promise<EmailMessage[]> {
    const results = await this.db.prepare(`
      SELECT * FROM email_messages 
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
      LIMIT ?
    `).bind(Date.now(), limit).all<EmailMessage>();
    
    return results.results;
  }

  async updateEmailMessage(id: string, updates: Partial<EmailMessage>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => (updates as any)[key]);
    
    await this.db.prepare(`
      UPDATE email_messages 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  // Analytics
  async getDripCampaignAnalytics(campaignId: string): Promise<any> {
    const results = await this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN lj.status = 'active' THEN 1 END) as active_journeys,
        COUNT(CASE WHEN lj.status = 'completed' THEN 1 END) as completed_journeys,
        COUNT(CASE WHEN lj.conversion_event IS NOT NULL THEN 1 END) as conversions,
        SUM(lj.total_sms_sent) as total_sms_sent,
        SUM(lj.total_emails_sent) as total_emails_sent,
        SUM(lj.total_opens) as total_opens,
        SUM(lj.total_clicks) as total_clicks
      FROM lead_journeys lj
      WHERE lj.campaign_id = ?
    `).bind(campaignId).first();

    return results || {
      active_journeys: 0,
      completed_journeys: 0,
      conversions: 0,
      total_sms_sent: 0,
      total_emails_sent: 0,
      total_opens: 0,
      total_clicks: 0
    };
  }

  // Additional methods for finding messages by external IDs
  async getSMSMessageBySid(twilioSid: string): Promise<SMSMessage | null> {
    return await this.db.prepare(
      'SELECT * FROM sms_messages WHERE twilio_sid = ?'
    ).bind(twilioSid).first<SMSMessage>();
  }

  async getEmailMessageBySendGridId(sendgridMessageId: string): Promise<EmailMessage | null> {
    return await this.db.prepare(
      'SELECT * FROM email_messages WHERE sendgrid_message_id = ?'
    ).bind(sendgridMessageId).first<EmailMessage>();
  }

  // Drip Analytics operations
  async createDripAnalytics(analytics: any): Promise<void> {
    await this.db.prepare(`
      INSERT INTO drip_analytics (
        id, campaign_id, date, leads_entered, leads_completed, leads_converted,
        total_sms_sent, total_emails_sent, total_opens, total_clicks,
        conversion_rate, engagement_rate, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analytics.id,
      analytics.campaign_id,
      analytics.date,
      analytics.leads_entered,
      analytics.leads_completed,
      analytics.leads_converted,
      analytics.total_sms_sent,
      analytics.total_emails_sent,
      analytics.total_opens,
      analytics.total_clicks,
      analytics.conversion_rate,
      analytics.engagement_rate,
      analytics.created_at
    ).run();
  }

  async getDripAnalyticsByCampaign(campaignId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let query = 'SELECT * FROM drip_analytics WHERE campaign_id = ?';
    const params = [campaignId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    const results = await this.db.prepare(query).bind(...params).all();
    return results.results || [];
  }

  async updateDripAnalytics(id: string, updates: any): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (fields.length === 0) return;
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => updates[key]);
    
    await this.db.prepare(`
      UPDATE drip_analytics 
      SET ${fields}
      WHERE id = ?
    `).bind(...values, id).run();
  }

  // Helper methods for boolean mapping
  private mapDripCampaignFromDb(campaign: any): DripCampaign {
    return {
      ...campaign,
      active: campaign.active === 1
    };
  }

  private mapDripStepFromDb(step: any): DripStep {
    return {
      ...step,
      active: step.active === 1
    };
  }

  // Transaction helper
  async transaction<T>(fn: (tx: D1Database) => Promise<T>): Promise<T> {
    // D1 doesn't support explicit transactions yet, but this structure
    // allows us to add it later when available
    return fn(this.db);
  }
}