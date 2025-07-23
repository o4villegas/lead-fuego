// SendGrid Email service for drip campaign automation

import { Env } from '../types/env';

export interface SendGridEmailData {
  to: string;
  name?: string;
  subject?: string;
  content?: string;
  templateId?: string;
  dynamicData?: Record<string, any>;
  leadId?: string;
  dripStepId?: string;
  journeyId?: string;
  from?: {
    email: string;
    name?: string;
  };
}

export interface SendGridResponse {
  messageId?: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;
  url?: string;
  category?: string[];
  unique_args?: Record<string, string>;
  marketing_campaign_id?: string;
  marketing_campaign_name?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  type?: string;
}

export class SendGridService {
  private readonly BASE_URL = 'https://api.sendgrid.com/v3';
  
  constructor(private env: Env) {}

  /**
   * Send email via SendGrid API
   */
  async sendEmail(emailData: SendGridEmailData): Promise<SendGridResponse> {
    if (!this.isConfigured()) {
      throw new Error('SendGrid API key not configured');
    }

    // Validate email address
    if (!this.validateEmail(emailData.to)) {
      throw new Error(`Invalid email address: ${emailData.to}`);
    }

    const payload = this.buildEmailPayload(emailData);

    const response = await fetch(`${this.BASE_URL}/mail/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const messageId = response.headers.get('X-Message-Id');

    if (!response.ok) {
      const error = await response.text();
      console.error(`SendGrid API error: ${response.status} - ${error}`);
      return {
        success: false,
        statusCode: response.status,
        error: `SendGrid API error: ${response.status} - ${error}`
      };
    }

    console.log(`Email sent successfully: ${messageId} to ${emailData.to}`);
    
    return {
      success: true,
      messageId: messageId || undefined,
      statusCode: response.status
    };
  }

  /**
   * Send bulk emails (with rate limiting)
   */
  async sendBulkEmails(emails: SendGridEmailData[]): Promise<{
    sent: Array<{ email: SendGridEmailData; messageId?: string }>;
    failed: Array<{ email: SendGridEmailData; error: string }>;
  }> {
    const sent: Array<{ email: SendGridEmailData; messageId?: string }> = [];
    const failed: Array<{ email: SendGridEmailData; error: string }> = [];

    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (email) => {
        try {
          const result = await this.sendEmail(email);
          if (result.success) {
            sent.push({ email, messageId: result.messageId });
          } else {
            failed.push({ email, error: result.error || 'Unknown error' });
          }
        } catch (error) {
          failed.push({
            email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed };
  }

  /**
   * Build email payload for SendGrid API
   */
  private buildEmailPayload(emailData: SendGridEmailData): any {
    const fromEmail = emailData.from?.email || this.env.SENDGRID_FROM_EMAIL;
    const fromName = emailData.from?.name || this.env.SENDGRID_FROM_NAME || 'LeadFuego';

    if (!fromEmail) {
      throw new Error('From email address not configured');
    }

    const payload: any = {
      from: {
        email: fromEmail,
        name: fromName
      },
      personalizations: [{
        to: [{ 
          email: emailData.to,
          name: emailData.name || emailData.to 
        }]
      }],
      tracking_settings: {
        click_tracking: { enable: true, enable_text: false },
        open_tracking: { enable: true, substitution_tag: '%open_track%' },
        subscription_tracking: { enable: true }
      }
    };

    // Add custom arguments for tracking
    if (emailData.leadId || emailData.dripStepId || emailData.journeyId) {
      payload.personalizations[0].custom_args = {
        ...(emailData.leadId && { lead_id: emailData.leadId }),
        ...(emailData.dripStepId && { drip_step_id: emailData.dripStepId }),
        ...(emailData.journeyId && { journey_id: emailData.journeyId })
      };
    }

    // Use dynamic template or static content
    if (emailData.templateId) {
      payload.template_id = emailData.templateId;
      
      if (emailData.dynamicData) {
        payload.personalizations[0].dynamic_template_data = emailData.dynamicData;
      }
    } else {
      // Static content
      payload.subject = emailData.subject || 'Message from LeadFuego';
      payload.content = [{
        type: 'text/html',
        value: emailData.content || 'Thank you for your interest!'
      }];
    }

    // Add unsubscribe group if configured
    if (this.env.SENDGRID_UNSUBSCRIBE_GROUP_ID) {
      payload.asm = {
        group_id: parseInt(this.env.SENDGRID_UNSUBSCRIBE_GROUP_ID)
      };
    }

    return payload;
  }

  /**
   * Process SendGrid webhook events
   */
  processWebhookEvents(events: SendGridWebhookEvent[]): Array<{
    messageId: string;
    email: string;
    event: string;
    timestamp: number;
    url?: string;
    uniqueArgs?: Record<string, string>;
    reason?: string;
  }> {
    return events.map(event => ({
      messageId: event.sg_message_id,
      email: event.email,
      event: event.event,
      timestamp: event.timestamp * 1000, // Convert to milliseconds
      url: event.url,
      uniqueArgs: event.unique_args,
      reason: event.reason
    }));
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Create or update email template
   */
  async createTemplate(templateData: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
  }): Promise<{ templateId: string; versionId: string }> {
    if (!this.isConfigured()) {
      throw new Error('SendGrid API key not configured');
    }

    // First create the template
    const templatePayload = {
      name: templateData.name,
      generation: 'dynamic'
    };

    const templateResponse = await fetch(`${this.BASE_URL}/templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templatePayload)
    });

    if (!templateResponse.ok) {
      const error = await templateResponse.text();
      throw new Error(`Failed to create template: ${error}`);
    }

    const template = await templateResponse.json() as any;
    const templateId = template.id;

    // Create the first version
    const versionPayload = {
      active: 1,
      name: `${templateData.name} - Version 1`,
      subject: templateData.subject,
      html_content: templateData.htmlContent,
      plain_content: templateData.textContent || this.htmlToText(templateData.htmlContent),
      generate_plain_content: !templateData.textContent
    };

    const versionResponse = await fetch(`${this.BASE_URL}/templates/${templateId}/versions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(versionPayload)
    });

    if (!versionResponse.ok) {
      const error = await versionResponse.text();
      throw new Error(`Failed to create template version: ${error}`);
    }

    const version = await versionResponse.json() as any;

    return {
      templateId: templateId,
      versionId: version.id
    };
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SendGrid API key not configured');
    }

    const response = await fetch(`${this.BASE_URL}/templates/${templateId}`, {
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get template: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Simple HTML to text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get email statistics
   */
  async getEmailStats(startDate: string, endDate?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SendGrid API key not configured');
    }

    const params = new URLSearchParams({
      start_date: startDate,
      aggregated_by: 'day'
    });

    if (endDate) {
      params.append('end_date', endDate);
    }

    const response = await fetch(`${this.BASE_URL}/stats?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get email stats: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Verify sender identity
   */
  async verifySender(): Promise<{ verified: boolean; email: string; status?: string }> {
    if (!this.isConfigured()) {
      throw new Error('SendGrid API key not configured');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/verified_senders`, {
        headers: {
          'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`
        }
      });

      if (!response.ok) {
        return { 
          verified: false, 
          email: this.env.SENDGRID_FROM_EMAIL || 'not-configured',
          status: `API error: ${response.status}`
        };
      }

      const senders = await response.json() as any;
      const fromEmail = this.env.SENDGRID_FROM_EMAIL;
      
      const verifiedSender = senders.results?.find((sender: any) => 
        sender.from_email === fromEmail && sender.verified
      );

      return {
        verified: !!verifiedSender,
        email: fromEmail || 'not-configured',
        status: verifiedSender?.verified ? 'verified' : 'not-verified'
      };
    } catch (error) {
      return {
        verified: false,
        email: this.env.SENDGRID_FROM_EMAIL || 'not-configured',
        status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if SendGrid is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.env.SENDGRID_API_KEY &&
      this.env.SENDGRID_FROM_EMAIL
    );
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus(): {
    hasApiKey: boolean;
    hasFromEmail: boolean;
    hasFromName: boolean;
    isFullyConfigured: boolean;
  } {
    return {
      hasApiKey: !!this.env.SENDGRID_API_KEY,
      hasFromEmail: !!this.env.SENDGRID_FROM_EMAIL,
      hasFromName: !!this.env.SENDGRID_FROM_NAME,
      isFullyConfigured: this.isConfigured()
    };
  }
}