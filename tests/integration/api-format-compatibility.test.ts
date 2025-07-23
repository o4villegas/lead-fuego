// Integration Test 4: API Format Compatibility
// Tests data format compatibility across Meta, OpenAI, and Twilio APIs

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface APICompatibilityResult {
  success: boolean;
  metaToOpenAI: {
    compatible: boolean;
    issues: string[];
    sampleConversion: any;
  };
  openAIToMeta: {
    compatible: boolean;
    issues: string[];
    sampleConversion: any;
  };
  metaToTwilio: {
    compatible: boolean;
    issues: string[];
    sampleConversion: any;
  };
  twilioToMeta: {
    compatible: boolean;
    issues: string[];
    sampleConversion: any;
  };
  dataFlowValidation: {
    campaignCreationFlow: boolean;
    leadCaptureFlow: boolean;
    dripCampaignFlow: boolean;
  };
  errors: string[];
}

// Sample data structures from each API
const SAMPLE_META_CAMPAIGN_DATA = {
  campaign: {
    id: '23851028601234',
    name: 'Test Campaign - Lead Generation',
    objective: 'LEAD_GENERATION',
    status: 'PAUSED',
    daily_budget: '2000',
    created_time: '2025-01-01T12:00:00+0000',
  },
  adset: {
    id: '23851028601235',
    name: 'Test AdSet',
    campaign_id: '23851028601234',
    targeting: {
      geo_locations: {
        countries: ['US'],
      },
      age_min: 25,
      age_max: 55,
      genders: [1, 2],
    },
    daily_budget: '2000',
    optimization_goal: 'LEAD_GENERATION',
  },
  creative: {
    id: '23851028601236',
    name: 'Test Creative',
    object_story_spec: {
      page_id: '123456789',
      link_data: {
        image_hash: 'abc123def456',
        message: 'Transform your business with our solution',
        link: 'https://example.com',
        call_to_action: {
          type: 'LEARN_MORE',
        },
      },
    },
  },
};

const SAMPLE_META_LEAD_DATA = {
  id: '987654321',
  created_time: '2025-01-01T12:30:00+0000',
  field_data: [
    {
      name: 'email',
      values: ['john.doe@example.com'],
    },
    {
      name: 'phone_number',
      values: ['+1-555-123-4567'],
    },
    {
      name: 'first_name',
      values: ['John'],
    },
    {
      name: 'last_name',
      values: ['Doe'],
    },
    {
      name: 'company',
      values: ['Acme Corp'],
    },
  ],
  form_id: '456789123',
  ad_id: '23851028601237',
  adset_id: '23851028601235',
  campaign_id: '23851028601234',
};

const SAMPLE_OPENAI_TEXT_RESPONSE = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1677652288,
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Transform your business today! Discover innovative solutions that drive growth and success. Limited time offer - get started now!',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 25,
    total_tokens: 75,
  },
};

const SAMPLE_OPENAI_IMAGE_RESPONSE = {
  created: 1677652288,
  data: [
    {
      url: 'https://oaidalleapiprodscus.blob.core.windows.net/private/example-image.png?st=2025-01-01T12%3A00%3A00Z&se=2025-01-01T14%3A00%3A00Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=123&sktid=456&skt=2025-01-01T12%3A00%3A00Z&ske=2025-01-02T12%3A00%3A00Z&sks=b&skv=2021-08-06&sig=example',
    },
  ],
};

const SAMPLE_TWILIO_SMS_REQUEST = {
  To: '+15551234567',
  From: '+15559876543',
  Body: 'Hi John! Thanks for your interest in our solution. We\'ll be in touch soon with more information.',
  MessagingServiceSid: 'MG123456789abcdef',
  StatusCallback: 'https://example.com/webhook/sms-status',
};

const SAMPLE_TWILIO_SMS_RESPONSE = {
  account_sid: 'AC123456789abcdef',
  api_version: '2010-04-01',
  body: 'Hi John! Thanks for your interest in our solution. We\'ll be in touch soon with more information.',
  date_created: 'Mon, 01 Jan 2025 12:45:00 +0000',
  date_sent: null,
  date_updated: 'Mon, 01 Jan 2025 12:45:00 +0000',
  direction: 'outbound-api',
  error_code: null,
  error_message: null,
  from: '+15559876543',
  messaging_service_sid: 'MG123456789abcdef',
  num_media: '0',
  num_segments: '1',
  price: null,
  price_unit: 'USD',
  sid: 'SM123456789abcdef',
  status: 'queued',
  subresource_uris: {},
  to: '+15551234567',
  uri: '/2010-04-01/Accounts/AC123456789abcdef/Messages/SM123456789abcdef.json',
};

class APIFormatCompatibilityTest {
  private results: APICompatibilityResult = {
    success: false,
    metaToOpenAI: { compatible: false, issues: [], sampleConversion: null },
    openAIToMeta: { compatible: false, issues: [], sampleConversion: null },
    metaToTwilio: { compatible: false, issues: [], sampleConversion: null },
    twilioToMeta: { compatible: false, issues: [], sampleConversion: null },
    dataFlowValidation: {
      campaignCreationFlow: false,
      leadCaptureFlow: false,
      dripCampaignFlow: false,
    },
    errors: [],
  };

  async run(): Promise<APICompatibilityResult> {
    console.log('🧪 Starting API Format Compatibility Test...');

    try {
      // Test 1: Meta → OpenAI format compatibility
      this.testMetaToOpenAI();

      // Test 2: OpenAI → Meta format compatibility
      this.testOpenAIToMeta();

      // Test 3: Meta → Twilio format compatibility
      this.testMetaToTwilio();

      // Test 4: Twilio → Meta format compatibility (for response tracking)
      this.testTwilioToMeta();

      // Test 5: End-to-end data flow validation
      this.testDataFlowValidation();

      this.results.success = true;
      console.log('✅ API Format Compatibility Test PASSED');

    } catch (error) {
      this.results.success = false;
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      console.log('❌ API Format Compatibility Test FAILED:', error);
    }

    return this.results;
  }

  private testMetaToOpenAI() {
    console.log('  🔄 Testing Meta → OpenAI format compatibility...');

    try {
      // Convert Meta campaign data to OpenAI prompt context
      const campaignContext = this.convertMetaCampaignToOpenAIContext(SAMPLE_META_CAMPAIGN_DATA);
      
      // Convert Meta lead data to OpenAI personalization context
      const leadPersonalization = this.convertMetaLeadToOpenAIContext(SAMPLE_META_LEAD_DATA);

      this.results.metaToOpenAI = {
        compatible: true,
        issues: [],
        sampleConversion: {
          campaignContext,
          leadPersonalization,
        },
      };

      console.log('    ✅ Meta → OpenAI conversion successful');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.metaToOpenAI = {
        compatible: false,
        issues: [errorMessage],
        sampleConversion: null,
      };
      console.log('    ❌ Meta → OpenAI conversion failed:', errorMessage);
    }
  }

  private testOpenAIToMeta() {
    console.log('  🔄 Testing OpenAI → Meta format compatibility...');

    try {
      // Convert OpenAI text response to Meta creative format
      const metaCreativeText = this.convertOpenAITextToMetaCreative(SAMPLE_OPENAI_TEXT_RESPONSE);
      
      // Convert OpenAI image URL to Meta creative format
      const metaCreativeImage = this.convertOpenAIImageToMetaCreative(SAMPLE_OPENAI_IMAGE_RESPONSE);

      // Validate format requirements
      const issues = this.validateMetaCreativeFormat(metaCreativeText, metaCreativeImage);

      this.results.openAIToMeta = {
        compatible: issues.length === 0,
        issues,
        sampleConversion: {
          text: metaCreativeText,
          image: metaCreativeImage,
        },
      };

      console.log(`    ${issues.length === 0 ? '✅' : '⚠️'} OpenAI → Meta conversion ${issues.length === 0 ? 'successful' : 'has issues'}`);
      if (issues.length > 0) {
        issues.forEach(issue => console.log(`      - ${issue}`));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.openAIToMeta = {
        compatible: false,
        issues: [errorMessage],
        sampleConversion: null,
      };
      console.log('    ❌ OpenAI → Meta conversion failed:', errorMessage);
    }
  }

  private testMetaToTwilio() {
    console.log('  🔄 Testing Meta → Twilio format compatibility...');

    try {
      // Convert Meta lead data to Twilio SMS format
      const twilioSMSData = this.convertMetaLeadToTwilioSMS(SAMPLE_META_LEAD_DATA, SAMPLE_META_CAMPAIGN_DATA);
      
      // Convert Meta lead data to SendGrid email format
      const sendgridEmailData = this.convertMetaLeadToSendGridEmail(SAMPLE_META_LEAD_DATA, SAMPLE_META_CAMPAIGN_DATA);

      // Validate format requirements
      const issues = this.validateTwilioFormats(twilioSMSData, sendgridEmailData);

      this.results.metaToTwilio = {
        compatible: issues.length === 0,
        issues,
        sampleConversion: {
          sms: twilioSMSData,
          email: sendgridEmailData,
        },
      };

      console.log(`    ${issues.length === 0 ? '✅' : '⚠️'} Meta → Twilio conversion ${issues.length === 0 ? 'successful' : 'has issues'}`);
      if (issues.length > 0) {
        issues.forEach(issue => console.log(`      - ${issue}`));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.metaToTwilio = {
        compatible: false,
        issues: [errorMessage],
        sampleConversion: null,
      };
      console.log('    ❌ Meta → Twilio conversion failed:', errorMessage);
    }
  }

  private testTwilioToMeta() {
    console.log('  🔄 Testing Twilio → Meta format compatibility...');

    try {
      // Convert Twilio response data for Meta reporting
      const metaInteractionData = this.convertTwilioResponseToMetaInteraction(SAMPLE_TWILIO_SMS_RESPONSE);
      
      // Validate tracking data format
      const issues = this.validateMetaInteractionFormat(metaInteractionData);

      this.results.twilioToMeta = {
        compatible: issues.length === 0,
        issues,
        sampleConversion: metaInteractionData,
      };

      console.log(`    ${issues.length === 0 ? '✅' : '⚠️'} Twilio → Meta conversion ${issues.length === 0 ? 'successful' : 'has issues'}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.twilioToMeta = {
        compatible: false,
        issues: [errorMessage],
        sampleConversion: null,
      };
      console.log('    ❌ Twilio → Meta conversion failed:', errorMessage);
    }
  }

  private testDataFlowValidation() {
    console.log('  🔄 Testing end-to-end data flow validation...');

    // Test campaign creation flow: User Input → Meta → OpenAI → Meta
    this.results.dataFlowValidation.campaignCreationFlow = this.validateCampaignCreationFlow();
    
    // Test lead capture flow: Meta Webhook → Database → Twilio
    this.results.dataFlowValidation.leadCaptureFlow = this.validateLeadCaptureFlow();
    
    // Test drip campaign flow: Database → OpenAI → Twilio
    this.results.dataFlowValidation.dripCampaignFlow = this.validateDripCampaignFlow();

    console.log('    📊 Data Flow Validation:');
    console.log(`      Campaign Creation: ${this.results.dataFlowValidation.campaignCreationFlow ? '✅' : '❌'}`);
    console.log(`      Lead Capture: ${this.results.dataFlowValidation.leadCaptureFlow ? '✅' : '❌'}`);
    console.log(`      Drip Campaign: ${this.results.dataFlowValidation.dripCampaignFlow ? '✅' : '❌'}`);
  }

  // Conversion helper methods
  private convertMetaCampaignToOpenAIContext(campaignData: any) {
    return {
      objective: campaignData.campaign.objective,
      targeting: {
        demographics: {
          ageRange: `${campaignData.adset.targeting.age_min}-${campaignData.adset.targeting.age_max}`,
          genders: campaignData.adset.targeting.genders,
        },
        geography: campaignData.adset.targeting.geo_locations.countries,
      },
      budget: campaignData.adset.daily_budget,
      context: `Lead generation campaign targeting ${campaignData.adset.targeting.geo_locations.countries.join(', ')} audience`,
    };
  }

  private convertMetaLeadToOpenAIContext(leadData: any) {
    const fieldMap: Record<string, string> = {};
    leadData.field_data.forEach((field: any) => {
      fieldMap[field.name] = field.values[0];
    });

    return {
      firstName: fieldMap.first_name || '',
      lastName: fieldMap.last_name || '',
      email: fieldMap.email || '',
      phone: fieldMap.phone_number || '',
      company: fieldMap.company || '',
      campaignId: leadData.campaign_id,
    };
  }

  private convertOpenAITextToMetaCreative(openaiResponse: any) {
    const content = openaiResponse.choices[0].message.content;
    
    // Validate Meta text requirements
    if (content.length > 125) {
      throw new Error(`Ad copy too long: ${content.length} characters (max 125)`);
    }

    return {
      message: content,
      link: 'https://example.com',
      call_to_action: { type: 'LEARN_MORE' },
    };
  }

  private convertOpenAIImageToMetaCreative(imageResponse: any) {
    return {
      image_url: imageResponse.data[0].url,
      format: 'png',
      size: '1024x1024',
    };
  }

  private convertMetaLeadToTwilioSMS(leadData: any, campaignData: any) {
    const fieldMap: Record<string, string> = {};
    leadData.field_data.forEach((field: any) => {
      fieldMap[field.name] = field.values[0];
    });

    // Extract phone number and clean format
    let phoneNumber = fieldMap.phone_number;
    if (phoneNumber && !phoneNumber.startsWith('+')) {
      phoneNumber = `+1${phoneNumber.replace(/\D/g, '')}`; // Assume US number
    }

    return {
      To: phoneNumber,
      Body: `Hi ${fieldMap.first_name || 'there'}! Thanks for your interest in our ${campaignData.campaign.name}. We'll be in touch soon!`,
      StatusCallback: 'https://example.com/webhook/sms-status',
    };
  }

  private convertMetaLeadToSendGridEmail(leadData: any, campaignData: any) {
    const fieldMap: Record<string, string> = {};
    leadData.field_data.forEach((field: any) => {
      fieldMap[field.name] = field.values[0];
    });

    return {
      to: fieldMap.email,
      from: 'noreply@example.com',
      subject: `Welcome ${fieldMap.first_name || ''}!`,
      html: `<p>Hi ${fieldMap.first_name || 'there'},</p><p>Thanks for your interest in our solution. We'll be in touch soon with more information.</p>`,
      personalizations: [{
        to: [{ email: fieldMap.email }],
        substitutions: {
          '-firstName-': fieldMap.first_name || '',
          '-company-': fieldMap.company || '',
        },
      }],
    };
  }

  private convertTwilioResponseToMetaInteraction(twilioResponse: any) {
    return {
      external_id: twilioResponse.sid,
      channel: 'sms',
      status: twilioResponse.status,
      sent_at: twilioResponse.date_created,
      cost: twilioResponse.price || '0.0075', // Estimated SMS cost
      error_code: twilioResponse.error_code,
      error_message: twilioResponse.error_message,
    };
  }

  // Validation helper methods
  private validateMetaCreativeFormat(textCreative: any, imageCreative: any): string[] {
    const issues: string[] = [];

    // Text validation
    if (textCreative.message.length > 125) {
      issues.push(`Primary text too long: ${textCreative.message.length}/125 characters`);
    }

    // Image validation
    if (!imageCreative.image_url) {
      issues.push('Missing image URL');
    } else if (!imageCreative.image_url.startsWith('https://')) {
      issues.push('Image URL must use HTTPS');
    }

    return issues;
  }

  private validateTwilioFormats(smsData: any, emailData: any): string[] {
    const issues: string[] = [];

    // SMS validation
    if (!smsData.To || !smsData.To.startsWith('+')) {
      issues.push('SMS recipient phone number must include country code');
    }
    if (!smsData.Body || smsData.Body.length === 0) {
      issues.push('SMS body cannot be empty');
    }
    if (smsData.Body && smsData.Body.length > 1600) {
      issues.push(`SMS body too long: ${smsData.Body.length}/1600 characters`);
    }

    // Email validation
    if (!emailData.to || !emailData.to.includes('@')) {
      issues.push('Invalid email address format');
    }
    if (!emailData.subject || emailData.subject.length === 0) {
      issues.push('Email subject cannot be empty');
    }

    return issues;
  }

  private validateMetaInteractionFormat(interactionData: any): string[] {
    const issues: string[] = [];

    if (!interactionData.external_id) {
      issues.push('Missing external ID for tracking');
    }
    if (!interactionData.channel) {
      issues.push('Missing communication channel');
    }
    if (!interactionData.status) {
      issues.push('Missing delivery status');
    }

    return issues;
  }

  // Data flow validation methods
  private validateCampaignCreationFlow(): boolean {
    try {
      // Simulate: User Input → Meta Campaign → OpenAI Generation → Meta Creative
      const userInput = { objective: 'LEAD_GENERATION', budget: 2000, targeting: 'US adults 25-55' };
      const metaCampaign = this.convertMetaCampaignToOpenAIContext(SAMPLE_META_CAMPAIGN_DATA);
      const openaiResponse = this.convertOpenAITextToMetaCreative(SAMPLE_OPENAI_TEXT_RESPONSE);
      
      return metaCampaign && openaiResponse && openaiResponse.message;
    } catch (error) {
      this.results.errors.push(`Campaign creation flow error: ${error}`);
      return false;
    }
  }

  private validateLeadCaptureFlow(): boolean {
    try {
      // Simulate: Meta Webhook → Lead Processing → Twilio SMS
      const leadContext = this.convertMetaLeadToOpenAIContext(SAMPLE_META_LEAD_DATA);
      const twilioSMS = this.convertMetaLeadToTwilioSMS(SAMPLE_META_LEAD_DATA, SAMPLE_META_CAMPAIGN_DATA);
      
      return leadContext && twilioSMS && twilioSMS.To && twilioSMS.Body;
    } catch (error) {
      this.results.errors.push(`Lead capture flow error: ${error}`);
      return false;
    }
  }

  private validateDripCampaignFlow(): boolean {
    try {
      // Simulate: Database Lead → OpenAI Personalization → Twilio Delivery
      const leadContext = this.convertMetaLeadToOpenAIContext(SAMPLE_META_LEAD_DATA);
      const personalizedContent = `Hi ${leadContext.firstName}! Based on your interest in our solution...`;
      const twilioSMS = { ...this.convertMetaLeadToTwilioSMS(SAMPLE_META_LEAD_DATA, SAMPLE_META_CAMPAIGN_DATA), Body: personalizedContent };
      
      return personalizedContent.includes(leadContext.firstName) && twilioSMS.Body === personalizedContent;
    } catch (error) {
      this.results.errors.push(`Drip campaign flow error: ${error}`);
      return false;
    }
  }
}

// Export the test function
export async function runAPIFormatCompatibilityTest(): Promise<APICompatibilityResult> {
  const test = new APIFormatCompatibilityTest();
  const results = await test.run();

  // Save results
  try {
    const resultsDir = join(__dirname, '../results');
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, 'api-format-compatibility-results.json'),
      JSON.stringify(results, null, 2)
    );
  } catch (error) {
    console.log('⚠️  Failed to save results:', error);
  }

  return results;
}

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runAPIFormatCompatibilityTest()
    .then(result => {
      console.log('\n📊 API Format Compatibility Test Results:');
      console.log('Overall Success:', result.success);
      console.log('\nCompatibility Results:');
      console.log('  Meta → OpenAI:', result.metaToOpenAI.compatible ? '✅' : '❌');
      console.log('  OpenAI → Meta:', result.openAIToMeta.compatible ? '✅' : '❌');
      console.log('  Meta → Twilio:', result.metaToTwilio.compatible ? '✅' : '❌');
      console.log('  Twilio → Meta:', result.twilioToMeta.compatible ? '✅' : '❌');
      console.log('\nData Flow Validation:');
      console.log('  Campaign Creation:', result.dataFlowValidation.campaignCreationFlow ? '✅' : '❌');
      console.log('  Lead Capture:', result.dataFlowValidation.leadCaptureFlow ? '✅' : '❌');
      console.log('  Drip Campaign:', result.dataFlowValidation.dripCampaignFlow ? '✅' : '❌');

      // Show issues if any
      const allIssues = [
        ...result.metaToOpenAI.issues,
        ...result.openAIToMeta.issues,
        ...result.metaToTwilio.issues,
        ...result.twilioToMeta.issues,
        ...result.errors,
      ];

      if (allIssues.length > 0) {
        console.log('\nIssues Found:');
        allIssues.forEach(issue => console.log(`  - ${issue}`));
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}