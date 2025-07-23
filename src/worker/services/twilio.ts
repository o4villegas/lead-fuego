// Twilio SMS service for drip campaign automation

import { Env } from '../types/env';

export interface TwilioSMSData {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
  leadId?: string;
  dripStepId?: string;
  journeyId?: string;
}

export interface TwilioResponse {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: string;
  date_created: string;
  date_updated: string;
  date_sent?: string;
  uri: string;
  price?: string;
  price_unit?: string;
  error_code?: string;
  error_message?: string;
}

export interface TwilioWebhookData {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  From: string;
  Body: string;
  NumSegments: string;
  Direction: string;
  AccountSid: string;
  ApiVersion: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export class TwilioService {
  private readonly BASE_URL = 'https://api.twilio.com/2010-04-01';
  
  constructor(private env: Env) {}

  /**
   * Send SMS message via Twilio API
   */
  async sendSMS(smsData: TwilioSMSData): Promise<TwilioResponse> {
    if (!this.isConfigured()) {
      throw new Error('Twilio credentials not configured');
    }

    // Validate phone number format
    if (!this.validatePhoneNumber(smsData.to)) {
      throw new Error(`Invalid phone number format: ${smsData.to}`);
    }

    // Validate message length (1600 character limit)
    if (smsData.body.length > 1600) {
      throw new Error(`SMS body too long: ${smsData.body.length} characters (max 1600)`);
    }

    const endpoint = `${this.BASE_URL}/Accounts/${this.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const payload = new URLSearchParams({
      'To': smsData.to,
      'From': smsData.from || this.env.TWILIO_PHONE_NUMBER || '',
      'Body': smsData.body
    });

    // Add status callback if provided
    if (smsData.statusCallback || this.env.WEBHOOK_BASE_URL) {
      const callbackUrl = smsData.statusCallback || `${this.env.WEBHOOK_BASE_URL}/api/webhooks/twilio`;
      payload.append('StatusCallback', callbackUrl);
    }

    // Add custom parameters for tracking
    if (smsData.leadId) {
      payload.append('MessagingServiceSid', ''); // Placeholder for custom tracking
    }

    const auth = btoa(`${this.env.TWILIO_ACCOUNT_SID}:${this.env.TWILIO_AUTH_TOKEN}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio API error: ${response.status} - ${error}`);
    }

    const result = await response.json() as TwilioResponse;
    
    // Log successful send
    console.log(`SMS sent successfully: ${result.sid} to ${smsData.to}`);
    
    return result;
  }

  /**
   * Send bulk SMS messages (rate-limited)
   */
  async sendBulkSMS(messages: TwilioSMSData[]): Promise<{ sent: TwilioResponse[]; failed: Array<{ data: TwilioSMSData; error: string }> }> {
    const sent: TwilioResponse[] = [];
    const failed: Array<{ data: TwilioSMSData; error: string }> = [];

    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          const result = await this.sendSMS(message);
          sent.push(result);
        } catch (error) {
          failed.push({
            data: message,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed };
  }

  /**
   * Process Twilio webhook for SMS status updates
   */
  processWebhook(webhookData: TwilioWebhookData): {
    messageSid: string;
    status: string;
    to: string;
    from: string;
    errorCode?: string;
    errorMessage?: string;
    timestamp: number;
  } {
    return {
      messageSid: webhookData.MessageSid,
      status: webhookData.MessageStatus.toLowerCase(),
      to: webhookData.To,
      from: webhookData.From,
      errorCode: webhookData.ErrorCode,
      errorMessage: webhookData.ErrorMessage,
      timestamp: Date.now()
    };
  }

  /**
   * Validate phone number in E.164 format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][area code][local number]
    // Examples: +14155552671, +442071838750
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If already has country code
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // Add default country code for US numbers
    if (digits.length === 10 && defaultCountryCode === '+1') {
      return `+1${digits}`;
    }
    
    // Add country code if missing
    if (digits.length > 10 && !phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  /**
   * Calculate SMS segment count for pricing
   */
  calculateSegments(message: string): number {
    // GSM 7-bit encoding (most common)
    const gsmChars = /^[A-Za-z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà\[\\\]^{|}~€]*$/;
    
    if (gsmChars.test(message)) {
      // GSM 7-bit: 160 chars per segment
      if (message.length <= 160) return 1;
      return Math.ceil(message.length / 153); // 153 for concatenated messages
    } else {
      // UCS-2 encoding (Unicode): 70 chars per segment
      if (message.length <= 70) return 1;
      return Math.ceil(message.length / 67); // 67 for concatenated messages
    }
  }

  /**
   * Estimate SMS cost
   */
  estimateCost(message: string, destination: string): number {
    const segments = this.calculateSegments(message);
    
    // Basic US pricing (varies by destination)
    const baseCostPerSegment = 0.0075; // $0.0075 per segment
    
    // Additional carrier fees for some destinations
    let carrierFee = 0;
    if (destination.startsWith('+1')) {
      carrierFee = 0.003; // US carrier fee
    }
    
    return (baseCostPerSegment + carrierFee) * segments;
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<{ friendlyName: string; status: string; type: string }> {
    if (!this.isConfigured()) {
      throw new Error('Twilio credentials not configured');
    }

    const endpoint = `${this.BASE_URL}/Accounts/${this.env.TWILIO_ACCOUNT_SID}.json`;
    const auth = btoa(`${this.env.TWILIO_ACCOUNT_SID}:${this.env.TWILIO_AUTH_TOKEN}`);

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const account = await response.json() as any;
    return {
      friendlyName: account.friendly_name,
      status: account.status,
      type: account.type
    };
  }

  /**
   * Check if Twilio is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.env.TWILIO_ACCOUNT_SID &&
      this.env.TWILIO_AUTH_TOKEN &&
      this.env.TWILIO_PHONE_NUMBER
    );
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus(): {
    hasAccountSid: boolean;
    hasAuthToken: boolean;
    hasPhoneNumber: boolean;
    hasWebhookUrl: boolean;
    isFullyConfigured: boolean;
  } {
    return {
      hasAccountSid: !!this.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!this.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!this.env.TWILIO_PHONE_NUMBER,
      hasWebhookUrl: !!this.env.WEBHOOK_BASE_URL,
      isFullyConfigured: this.isConfigured()
    };
  }

  /**
   * Format phone number to E.164 format
   */
  formatToE164(phoneNumber: string, countryCode: string = 'US'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Country code mapping for common countries
    const countryCodes: Record<string, string> = {
      'US': '1',
      'CA': '1',
      'GB': '44',
      'AU': '61',
      'FR': '33',
      'DE': '49',
      'IT': '39',
      'ES': '34',
      'BR': '55',
      'IN': '91',
      'JP': '81',
      'CN': '86'
    };

    // If already starts with +, validate and return
    if (phoneNumber.startsWith('+')) {
      return this.validatePhoneNumber(phoneNumber) ? phoneNumber : '';
    }

    // Get country code
    const code = countryCodes[countryCode.toUpperCase()] || '1';

    // Handle different input formats
    if (countryCode.toUpperCase() === 'US' || countryCode.toUpperCase() === 'CA') {
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
    } else if (countryCode.toUpperCase() === 'GB') {
      if (digits.startsWith('0')) {
        // Remove leading 0 for UK numbers
        return `+44${digits.substring(1)}`;
      } else if (digits.length >= 10) {
        return `+44${digits}`;
      }
    }

    // Default: prepend country code if not present
    if (digits.length >= 7) {
      return `+${code}${digits}`;
    }

    // Invalid format
    return '';
  }

  /**
   * Validate SMS data structure
   */
  validateSMSData(smsData: any): void {
    // Validate required fields
    if (!smsData.to) {
      throw new Error('SMS data missing "to" field');
    }
    if (!smsData.from) {
      throw new Error('SMS data missing "from" field');
    }
    if (!smsData.body) {
      throw new Error('SMS data missing "body" field');
    }

    // Validate phone numbers
    if (!this.validatePhoneNumber(smsData.to)) {
      throw new Error('Invalid phone number format in "to" field');
    }
    if (!this.validatePhoneNumber(smsData.from)) {
      throw new Error('Invalid phone number format in "from" field');
    }

    // Validate message content
    if (typeof smsData.body !== 'string' || smsData.body.length === 0) {
      throw new Error('SMS body must be a non-empty string');
    }
    if (smsData.body.length > 1600) {
      throw new Error('SMS body exceeds maximum length of 1600 characters');
    }
  }

  /**
   * Validate bulk SMS data array
   */
  validateBulkSMSData(bulkData: any[]): void {
    if (!Array.isArray(bulkData)) {
      throw new Error('Bulk SMS data must be an array');
    }
    if (bulkData.length === 0) {
      throw new Error('Bulk SMS data array cannot be empty');
    }
    if (bulkData.length > 1000) {
      throw new Error('Bulk SMS data contains too many messages (max 1000)');
    }

    // Validate each message
    bulkData.forEach((smsData, index) => {
      try {
        this.validateSMSData(smsData);
      } catch (error) {
        throw new Error(`Invalid SMS data at index ${index}: ${error instanceof Error ? error.message : error}`);
      }
    });
  }

  /**
   * Process Twilio webhook events
   */
  processWebhookEvents(events: TwilioWebhookData[]): Array<{
    messageSid: string;
    status: string;
    to: string;
    from: string;
    body?: string;
    timestamp: number;
    errorCode?: string;
    errorMessage?: string;
  }> {
    return events.map(event => ({
      messageSid: event.MessageSid,
      status: event.MessageStatus,
      to: event.To,
      from: event.From,
      body: event.Body,
      timestamp: Date.now(), // Twilio doesn't provide timestamp in webhook, use current time
      errorCode: event.ErrorCode,
      errorMessage: event.ErrorMessage
    }));
  }
}