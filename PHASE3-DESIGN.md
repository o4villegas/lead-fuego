# Phase 3: Drip Campaign Automation Design

## 🎯 **Complete Lead Journey Workflow**

### **Lead Journey: Meta → SMS → Email → Conversion**

```
Meta Ad Lead Capture
        ↓
   Lead Webhook Received
        ↓
   AI-Generated Welcome SMS (Immediate)
        ↓
   Email Sequence Launch (30 min delay)
        ↓
   Multi-Touch Nurturing Campaign
        ↓
   Conversion Tracking & Analytics
```

## 📊 **Database Schema Extension**

### **New Tables for Phase 3**

```sql
-- Drip Campaign Templates
CREATE TABLE drip_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'meta_lead', 'manual', 'api'
  total_steps INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Individual Campaign Steps
CREATE TABLE drip_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES drip_campaigns(id),
  step_number INTEGER NOT NULL,
  channel TEXT NOT NULL, -- 'sms', 'email'
  delay_minutes INTEGER NOT NULL, -- Delay from previous step or trigger
  content_template TEXT, -- AI prompt template
  subject_template TEXT, -- For emails
  sendgrid_template_id TEXT, -- SendGrid dynamic template ID
  active BOOLEAN DEFAULT true,
  created_at INTEGER NOT NULL
);

-- SMS Message Tracking
CREATE TABLE sms_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  drip_step_id INTEGER REFERENCES drip_steps(id),
  twilio_sid TEXT UNIQUE,
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'sent', 'delivered', 'failed'
  scheduled_at INTEGER NOT NULL,
  sent_at INTEGER,
  delivered_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Email Message Tracking
CREATE TABLE email_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  drip_step_id INTEGER REFERENCES drip_steps(id),
  sendgrid_message_id TEXT UNIQUE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id TEXT,
  dynamic_data TEXT, -- JSON
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced'
  scheduled_at INTEGER NOT NULL,
  sent_at INTEGER,
  delivered_at INTEGER,
  opened_at INTEGER,
  clicked_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Lead Journey Tracking
CREATE TABLE lead_journeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  campaign_id INTEGER REFERENCES drip_campaigns(id),
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'failed'
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  last_interaction_at INTEGER,
  total_sms_sent INTEGER DEFAULT 0,
  total_emails_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  conversion_event TEXT, -- Track what converted them
  converted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Drip Campaign Analytics
CREATE TABLE drip_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES drip_campaigns(id),
  date TEXT NOT NULL, -- YYYY-MM-DD
  leads_entered INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  total_sms_sent INTEGER DEFAULT 0,
  total_emails_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  conversion_rate REAL DEFAULT 0.0,
  engagement_rate REAL DEFAULT 0.0,
  created_at INTEGER NOT NULL,
  UNIQUE(campaign_id, date)
);
```

## 🔄 **Drip Campaign Automation Logic**

### **1. Lead Capture Trigger**

```typescript
// When Meta webhook receives a lead
async function processMetaLead(webhookData: MetaWebhookData) {
  // Create lead record (existing Phase 2 logic)
  const lead = await createLeadFromMeta(webhookData);
  
  // Find active drip campaigns for Meta leads
  const campaigns = await db.prepare(`
    SELECT * FROM drip_campaigns 
    WHERE trigger_type = 'meta_lead' AND active = true
  `).all();
  
  // Start journey for each active campaign
  for (const campaign of campaigns.results) {
    await startLeadJourney(lead.id, campaign.id);
  }
}
```

### **2. Journey Orchestration**

```typescript
async function startLeadJourney(leadId: string, campaignId: string) {
  // Create journey record
  const journeyId = await generateId();
  await db.prepare(`
    INSERT INTO lead_journeys (id, lead_id, campaign_id, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(journeyId, leadId, campaignId, Date.now(), Date.now(), Date.now()).run();
  
  // Schedule first step
  await scheduleNextStep(journeyId);
}

async function scheduleNextStep(journeyId: string) {
  const journey = await getJourneyWithLead(journeyId);
  const nextStepNumber = journey.current_step + 1;
  
  // Get next step configuration
  const step = await db.prepare(`
    SELECT * FROM drip_steps 
    WHERE campaign_id = ? AND step_number = ? AND active = true
  `).bind(journey.campaign_id, nextStepNumber).first();
  
  if (!step) {
    // Journey complete
    await completeJourney(journeyId);
    return;
  }
  
  // Calculate send time
  const scheduledAt = Date.now() + (step.delay_minutes * 60 * 1000);
  
  // Schedule message based on channel
  if (step.channel === 'sms') {
    await scheduleSMS(journey, step, scheduledAt);
  } else if (step.channel === 'email') {
    await scheduleEmail(journey, step, scheduledAt);
  }
  
  // Update journey current step
  await db.prepare(`
    UPDATE lead_journeys 
    SET current_step = ?, updated_at = ?
    WHERE id = ?
  `).bind(nextStepNumber, Date.now(), journeyId).run();
}
```

### **3. AI-Powered Content Generation**

```typescript
async function generateDripContent(
  lead: Lead,
  step: DripStep,
  campaign: DripCampaign
): Promise<{ content: string; subject?: string }> {
  
  const prompt = buildDripPrompt(lead, step, campaign);
  
  if (step.channel === 'sms') {
    // Generate SMS content with Workers AI
    const aiService = new WorkersAIService(env);
    const content = await aiService.generateDripContent(
      'sms',
      {
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company,
        phone: lead.phone
      },
      campaign.name,
      step.step_number
    );
    
    return { content: content.text };
  } else {
    // Generate email content
    const aiService = new WorkersAIService(env);
    const emailContent = await aiService.generateDripContent(
      'email',
      {
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company,
        email: lead.email
      },
      campaign.name,
      step.step_number
    );
    
    // Extract subject and body
    const lines = emailContent.text.split('\n');
    const subject = lines.find(line => line.startsWith('Subject:'))?.replace('Subject:', '').trim() || 
                   `Step ${step.step_number}: ${campaign.name}`;
    const content = lines.filter(line => !line.startsWith('Subject:')).join('\n').trim();
    
    return { content, subject };
  }
}
```

## 📱 **SMS Integration Service**

```typescript
export class TwilioService {
  constructor(private env: Env) {}

  async sendSMS(to: string, body: string, from?: string): Promise<TwilioResponse> {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const payload = new URLSearchParams({
      'To': to,
      'From': from || this.env.TWILIO_PHONE_NUMBER,
      'Body': body,
      'StatusCallback': `${this.env.WEBHOOK_BASE_URL}/api/webhooks/twilio`
    });

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
      throw new Error(`Twilio API error: ${response.status}`);
    }

    return await response.json();
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}
```

## 📧 **Email Integration Service**

```typescript
export class SendGridService {
  constructor(private env: Env) {}

  async sendEmail(emailData: SendGridEmailData): Promise<SendGridResponse> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { 
          email: this.env.SENDGRID_FROM_EMAIL,
          name: this.env.SENDGRID_FROM_NAME || 'LeadFuego'
        },
        personalizations: [{
          to: [{ email: emailData.to, name: emailData.name }],
          dynamic_template_data: emailData.dynamicData,
          custom_args: {
            lead_id: emailData.leadId,
            drip_step_id: emailData.dripStepId,
            journey_id: emailData.journeyId
          }
        }],
        template_id: emailData.templateId,
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${error}`);
    }

    return {
      messageId: response.headers.get('X-Message-Id'),
      success: true
    };
  }

  async validateEmail(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

## ⚡ **Scheduled Processing**

```typescript
// Cloudflare Worker Cron Jobs
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Processing scheduled drip campaign messages...');
    
    // Process SMS messages
    await processPendingSMS(env);
    
    // Process email messages
    await processPendingEmails(env);
    
    // Update analytics
    await updateDripAnalytics(env);
  }
};

async function processPendingSMS(env: Env): Promise<void> {
  const pendingMessages = await env.DB.prepare(`
    SELECT sm.*, lj.id as journey_id, l.first_name, l.phone 
    FROM sms_messages sm
    JOIN lead_journeys lj ON sm.lead_id = lj.lead_id
    JOIN leads l ON sm.lead_id = l.id
    WHERE sm.status = 'pending' 
    AND sm.scheduled_at <= ?
    ORDER BY sm.scheduled_at ASC
    LIMIT 100
  `).bind(Date.now()).all();

  const twilioService = new TwilioService(env);

  for (const message of pendingMessages.results) {
    try {
      const response = await twilioService.sendSMS(
        message.to_number,
        message.content,
        message.from_number
      );

      // Update message with Twilio SID
      await env.DB.prepare(`
        UPDATE sms_messages 
        SET twilio_sid = ?, status = 'sent', sent_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(response.sid, Date.now(), Date.now(), message.id).run();

      // Schedule next step in journey
      await scheduleNextStep(message.journey_id);

    } catch (error) {
      console.error(`SMS sending failed for message ${message.id}:`, error);
      
      await env.DB.prepare(`
        UPDATE sms_messages 
        SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ?
      `).bind(error.message, Date.now(), message.id).run();
    }
  }
}
```

## 📊 **Analytics & Tracking**

### **Real-time Dashboard Metrics**
- Active journeys count
- Messages sent today (SMS/Email)
- Open rates by campaign
- Click-through rates
- Conversion tracking
- Revenue attribution

### **Campaign Performance API**
```typescript
// GET /api/drip/campaigns/:id/analytics
async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const analytics = await env.DB.prepare(`
    SELECT 
      SUM(leads_entered) as total_leads,
      SUM(leads_completed) as completed_journeys,
      SUM(leads_converted) as conversions,
      SUM(total_opens) as total_opens,
      SUM(total_clicks) as total_clicks,
      AVG(conversion_rate) as avg_conversion_rate,
      AVG(engagement_rate) as avg_engagement_rate
    FROM drip_analytics 
    WHERE campaign_id = ?
    AND date >= date('now', '-30 days')
  `).bind(campaignId).first();

  return {
    totalLeads: analytics.total_leads || 0,
    completedJourneys: analytics.completed_journeys || 0,
    conversions: analytics.conversions || 0,
    conversionRate: analytics.avg_conversion_rate || 0,
    engagementRate: analytics.avg_engagement_rate || 0,
    totalOpens: analytics.total_opens || 0,
    totalClicks: analytics.total_clicks || 0
  };
}
```

## 🔧 **Configuration & Management**

### **Environment Variables**
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid Configuration  
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Your Company Name

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-worker.workers.dev
```

### **Default Drip Campaign Template**
```json
{
  "name": "Lead Generation Nurture",
  "description": "5-step nurturing sequence for Meta leads",
  "trigger_type": "meta_lead",
  "steps": [
    {
      "step_number": 1,
      "channel": "sms",
      "delay_minutes": 0,
      "content_template": "Hi {{first_name}}! Thanks for your interest in {{campaign_name}}. We'll send you more details shortly!"
    },
    {
      "step_number": 2,
      "channel": "email",
      "delay_minutes": 30,
      "content_template": "Welcome to our community! Here's what you can expect...",
      "subject_template": "Welcome {{first_name}} - Let's get started!"
    },
    {
      "step_number": 3,
      "channel": "email",
      "delay_minutes": 1440,
      "content_template": "Here are some success stories from customers like you...",
      "subject_template": "See how {{company_type}} companies grow with us"
    },
    {
      "step_number": 4,
      "channel": "sms",
      "delay_minutes": 2880,
      "content_template": "Quick question {{first_name}} - what's your biggest challenge with {{interest_area}}?"
    },
    {
      "step_number": 5,
      "channel": "email",
      "delay_minutes": 4320,
      "content_template": "Ready to take the next step? Here's a special offer...",
      "subject_template": "Exclusive offer for {{first_name}} - Limited time"
    }
  ]
}
```

This comprehensive design creates a seamless, AI-powered drip campaign system that automatically nurtures Meta leads through personalized SMS and email sequences, with full tracking and analytics.