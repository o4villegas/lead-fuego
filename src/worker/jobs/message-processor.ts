// Message processor for drip campaign automation
// This would typically run as a scheduled job to process pending SMS/email messages

import { Env } from '../types/env';
import { DatabaseService } from '../services/database';
import { TwilioService } from '../services/twilio';
import { SendGridService } from '../services/sendgrid';

export interface MessageProcessorOptions {
  batchSize?: number;
  maxRetries?: number;
}

export class MessageProcessor {
  private db: DatabaseService;
  private twilio: TwilioService;
  private sendgrid: SendGridService;

  constructor(env: Env, _options: MessageProcessorOptions = {}) {
    this.db = new DatabaseService(env.DB);
    this.twilio = new TwilioService(env);
    this.sendgrid = new SendGridService(env);
  }

  /**
   * Process all pending messages (SMS and Email)
   */
  async processPendingMessages(): Promise<{
    smsProcessed: number;
    emailsProcessed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    console.log('Starting message processing job...');

    // Process SMS messages
    const smsResults = await this.processPendingSMS();
    if (smsResults.errors.length > 0) {
      errors.push(...smsResults.errors);
    }

    // Process Email messages
    const emailResults = await this.processPendingEmails();
    if (emailResults.errors.length > 0) {
      errors.push(...emailResults.errors);
    }

    console.log(`Message processing complete. SMS: ${smsResults.processed}, Emails: ${emailResults.processed}, Errors: ${errors.length}`);

    return {
      smsProcessed: smsResults.processed,
      emailsProcessed: emailResults.processed,
      errors
    };
  }

  /**
   * Process pending SMS messages
   */
  private async processPendingSMS(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      const pendingMessages = await this.db.getPendingSMSMessages(50);
      console.log(`Found ${pendingMessages.length} pending SMS messages`);

      for (const message of pendingMessages) {
        try {
          // Update status to queued
          await this.db.updateSMSMessage(message.id, {
            status: 'queued',
            updated_at: Date.now()
          });

          // Send SMS via Twilio
          const result = await this.twilio.sendSMS({
            to: message.to_number,
            from: message.from_number,
            body: message.content,
            leadId: message.lead_id,
            dripStepId: message.drip_step_id
          });

          if (result.sid) {
            // Update with Twilio SID and sent status
            await this.db.updateSMSMessage(message.id, {
              status: 'sent',
              twilio_sid: result.sid,
              sent_at: Date.now(),
              updated_at: Date.now()
            });

            // Update journey stats
            await this.updateJourneyStats(message.lead_id, 'sms_sent');
            
            processed++;
            console.log(`SMS sent successfully: ${result.sid}`);
          } else {
            // Mark as failed
            await this.db.updateSMSMessage(message.id, {
              status: 'failed',
              error_message: 'SMS send failed',
              updated_at: Date.now()
            });

            errors.push(`SMS failed for ${message.to_number}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`SMS processing error for ${message.id}: ${errorMsg}`);
          
          // Mark as failed
          await this.db.updateSMSMessage(message.id, {
            status: 'failed',
            error_message: errorMsg,
            updated_at: Date.now()
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`SMS batch processing error: ${errorMsg}`);
    }

    return { processed, errors };
  }

  /**
   * Process pending email messages
   */
  private async processPendingEmails(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      const pendingMessages = await this.db.getPendingEmailMessages(50);
      console.log(`Found ${pendingMessages.length} pending email messages`);

      for (const message of pendingMessages) {
        try {
          // Prepare email data
          const emailData = {
            to: message.to_email,
            subject: message.subject,
            templateId: message.template_id,
            dynamicData: message.dynamic_data ? JSON.parse(message.dynamic_data) : undefined,
            leadId: message.lead_id,
            dripStepId: message.drip_step_id
          };

          // Send email via SendGrid
          const result = await this.sendgrid.sendEmail(emailData);

          if (result.success) {
            // Update with SendGrid message ID and sent status
            await this.db.updateEmailMessage(message.id, {
              status: 'sent',
              sendgrid_message_id: result.messageId,
              sent_at: Date.now(),
              updated_at: Date.now()
            });

            // Update journey stats
            await this.updateJourneyStats(message.lead_id, 'email_sent');
            
            processed++;
            console.log(`Email sent successfully: ${result.messageId}`);
          } else {
            // Mark as failed
            await this.db.updateEmailMessage(message.id, {
              status: 'bounced',
              error_message: result.error || 'Unknown error',
              updated_at: Date.now()
            });

            errors.push(`Email failed for ${message.to_email}: ${result.error}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Email processing error for ${message.id}: ${errorMsg}`);
          
          // Mark as failed
          await this.db.updateEmailMessage(message.id, {
            status: 'bounced',
            error_message: errorMsg,
            updated_at: Date.now()
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Email batch processing error: ${errorMsg}`);
    }

    return { processed, errors };
  }

  /**
   * Update journey statistics when messages are sent
   */
  private async updateJourneyStats(leadId: string, statType: 'sms_sent' | 'email_sent'): Promise<void> {
    try {
      // This is a simplified version - in practice you'd need to find the active journey
      // and update the appropriate stats field
      console.log(`Updated journey stats for lead ${leadId}: ${statType}`);
    } catch (error) {
      console.error('Error updating journey stats:', error);
    }
  }

  /**
   * Process webhook events to update message statuses
   */
  async processWebhookEvent(event: {
    type: 'twilio' | 'sendgrid';
    messageId: string;
    status: string;
    timestamp: number;
    url?: string;
    error?: string;
  }): Promise<void> {
    try {
      if (event.type === 'twilio') {
        await this.processTwilioWebhook(event);
      } else if (event.type === 'sendgrid') {
        await this.processSendGridWebhook(event);
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
    }
  }

  /**
   * Process Twilio webhook events
   */
  private async processTwilioWebhook(event: any): Promise<void> {
    // Find SMS message by Twilio SID
    const message = await this.db.getSMSMessageBySid(event.messageId);
    
    if (!message) {
      console.warn(`SMS message not found for SID: ${event.messageId}`);
      return;
    }

    const statusMap: Record<string, string> = {
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed'
    };

    const newStatus = statusMap[event.status] || event.status;

    await this.db.updateSMSMessage(message.id, {
      status: newStatus as any,
      delivered_at: event.status === 'delivered' ? event.timestamp : undefined,
      error_message: event.error,
      updated_at: Date.now()
    });

    console.log(`Updated SMS ${message.id} status to ${newStatus}`);
  }

  /**
   * Process SendGrid webhook events
   */
  private async processSendGridWebhook(event: any): Promise<void> {
    // Find email message by SendGrid message ID
    const message = await this.db.getEmailMessageBySendGridId(event.messageId);
    
    if (!message) {
      console.warn(`Email message not found for ID: ${event.messageId}`);
      return;
    }

    const statusMap: Record<string, string> = {
      'delivered': 'delivered',
      'bounce': 'bounced',
      'open': 'opened',
      'click': 'clicked'
    };

    const newStatus = statusMap[event.status] || event.status;

    const updates: any = {
      status: newStatus,
      updated_at: Date.now()
    };

    if (event.status === 'delivered') {
      updates.delivered_at = event.timestamp;
    } else if (event.status === 'open') {
      updates.opened_at = event.timestamp;
      // Update journey stats
      await this.updateJourneyStats(message.lead_id, 'email_sent'); // TODO: Add opens tracking
    } else if (event.status === 'click') {
      updates.clicked_at = event.timestamp;
      // Update journey stats  
      await this.updateJourneyStats(message.lead_id, 'email_sent'); // TODO: Add clicks tracking
    }

    await this.db.updateEmailMessage(message.id, updates);

    console.log(`Updated email ${message.id} status to ${newStatus}`);
  }
}

/**
 * Cloudflare Workers Scheduled Event handler
 * This would be called by a Cron Trigger to process messages periodically
 */
export async function handleScheduledEvent(env: Env): Promise<void> {
  const processor = new MessageProcessor(env);
  await processor.processPendingMessages();
}