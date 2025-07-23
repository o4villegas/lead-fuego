import { useState } from 'react';
import { PageLayout, Card } from '../components/PageLayout';
import { Button, Input, Textarea, Select, Form } from '../components/Form';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAsyncAction } from '../hooks/useApi';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';

type WizardStep = 'setup' | 'targeting' | 'creative' | 'drip' | 'review';

interface CampaignData {
  // Step 1: Campaign Setup
  name: string;
  objective: string;
  dailyBudget: number;
  
  // Step 2: Targeting
  audience: {
    ageMin: number;
    ageMax: number;
    genders: string[];
    locations: string[];
    interests: string[];
  };
  
  // Step 3: Creative
  creativeGuidance: {
    brandVoice: string;
    keyMessage: string;
    visualStyle: string;
  };
  
  // Step 4: Drip Campaign
  dripCampaign: {
    enabled: boolean;
    template: string;
    channels: string[];
  };
}

export function CreateCampaignPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('setup');
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    objective: 'LEAD_GENERATION',
    dailyBudget: 5000, // in cents
    audience: {
      ageMin: 18,
      ageMax: 65,
      genders: ['all'],
      locations: [],
      interests: []
    },
    creativeGuidance: {
      brandVoice: '',
      keyMessage: '',
      visualStyle: ''
    },
    dripCampaign: {
      enabled: true,
      template: 'lead_nurturing_standard',
      channels: ['sms', 'email']
    }
  });

  const { showToast } = useToast();
  const { execute: createCampaign, loading: creating } = useAsyncAction(
    (data: any) => apiService.createCampaign(data)
  );

  const steps: { key: WizardStep; title: string; description: string }[] = [
    { key: 'setup', title: 'Campaign Setup', description: 'Basic campaign information' },
    { key: 'targeting', title: 'Audience Targeting', description: 'Define your target audience' },
    { key: 'creative', title: 'Creative Guidance', description: 'Guide AI content generation' },
    { key: 'drip', title: 'Drip Campaign', description: 'Setup lead nurturing' },
    { key: 'review', title: 'Review & Launch', description: 'Final review and launch' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    const success = await createCampaign(campaignData);
    if (success) {
      showToast('Campaign created successfully!', 'success');
      window.location.href = '/campaigns';
    }
  };

  return (
    <PageLayout
      title="Create Campaign"
      subtitle="Launch a new Meta advertising campaign with automated lead nurturing"
    >
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <Card className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index <= currentStepIndex 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${
                    index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`mx-4 h-px w-12 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Step Content */}
        <Card>
          {currentStep === 'setup' && (
            <CampaignSetupStep 
              data={campaignData} 
              onChange={setCampaignData} 
            />
          )}
          {currentStep === 'targeting' && (
            <TargetingStep 
              data={campaignData} 
              onChange={setCampaignData} 
            />
          )}
          {currentStep === 'creative' && (
            <CreativeGuidanceStep 
              data={campaignData} 
              onChange={setCampaignData} 
            />
          )}
          {currentStep === 'drip' && (
            <DripCampaignStep 
              data={campaignData} 
              onChange={setCampaignData} 
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep 
              data={campaignData} 
              onSubmit={handleSubmit}
              creating={creating}
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStepIndex === 0}
            >
              Previous
            </Button>
            
            {currentStep === 'review' ? (
              <Button 
                onClick={handleSubmit}
                loading={creating}
                className="bg-green-600 hover:bg-green-700"
              >
                🚀 Launch Campaign
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Next
              </Button>
            )}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}

function CampaignSetupStep({ 
  data, 
  onChange 
}: { 
  data: CampaignData; 
  onChange: (data: CampaignData) => void; 
}) {
  const updateData = (field: keyof CampaignData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Campaign Basics</h3>
        <Form>
          <Input
            label="Campaign Name"
            required
            value={data.name}
            onChange={(e) => updateData('name', e.target.value)}
            placeholder="e.g., Q1 Lead Generation Campaign"
            description="Choose a descriptive name for your campaign"
          />
          
          <Select
            label="Campaign Objective"
            required
            options={[
              { value: 'LEAD_GENERATION', label: 'Lead Generation' },
              { value: 'CONVERSIONS', label: 'Conversions' },
              { value: 'TRAFFIC', label: 'Traffic' }
            ]}
            value={data.objective}
            onChange={(e) => updateData('objective', e.target.value)}
            description="What do you want to achieve with this campaign?"
          />
          
          <div>
            <Input
              label="Daily Budget"
              type="number"
              required
              value={data.dailyBudget / 100}
              onChange={(e) => updateData('dailyBudget', parseInt(e.target.value) * 100)}
              placeholder="50"
              description="Your daily advertising budget in USD"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Monthly estimate: ${((data.dailyBudget / 100) * 30).toLocaleString()}
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}

function TargetingStep({ 
  data, 
  onChange 
}: { 
  data: CampaignData; 
  onChange: (data: CampaignData) => void; 
}) {
  const updateAudience = (field: keyof CampaignData['audience'], value: any) => {
    onChange({ 
      ...data, 
      audience: { ...data.audience, [field]: value } 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Target Audience</h3>
        <Form>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Minimum Age"
              type="number"
              value={data.audience.ageMin}
              onChange={(e) => updateAudience('ageMin', parseInt(e.target.value))}
              min="18"
              max="65"
            />
            <Input
              label="Maximum Age"
              type="number"
              value={data.audience.ageMax}
              onChange={(e) => updateAudience('ageMax', parseInt(e.target.value))}
              min="18"
              max="65"
            />
          </div>
          
          <Select
            label="Gender"
            options={[
              { value: 'all', label: 'All Genders' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' }
            ]}
            value={data.audience.genders[0] || 'all'}
            onChange={(e) => updateAudience('genders', [e.target.value])}
          />
          
          <Textarea
            label="Target Locations"
            value={data.audience.locations.join(', ')}
            onChange={(e) => updateAudience('locations', e.target.value.split(', ').filter(Boolean))}
            placeholder="United States, Canada, United Kingdom"
            description="Enter locations separated by commas"
          />
          
          <Textarea
            label="Interests & Behaviors"
            value={data.audience.interests.join(', ')}
            onChange={(e) => updateAudience('interests', e.target.value.split(', ').filter(Boolean))}
            placeholder="Small business, entrepreneurship, marketing"
            description="Enter interests separated by commas"
          />
        </Form>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Estimated Audience Size</h4>
        <p className="text-blue-700 text-sm">
          Based on your targeting criteria, your potential reach is approximately 2.5M - 3.2M people.
        </p>
      </div>
    </div>
  );
}

function CreativeGuidanceStep({ 
  data, 
  onChange 
}: { 
  data: CampaignData; 
  onChange: (data: CampaignData) => void; 
}) {
  const updateGuidance = (field: keyof CampaignData['creativeGuidance'], value: string) => {
    onChange({ 
      ...data, 
      creativeGuidance: { ...data.creativeGuidance, [field]: value } 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Creative Guidance</h3>
        <p className="text-muted-foreground mb-6">
          Help our AI generate better content by providing some guidance about your brand and message.
        </p>
        
        <Form>
          <Select
            label="Brand Voice"
            options={[
              { value: '', label: 'Auto-detect from campaign' },
              { value: 'professional', label: 'Professional' },
              { value: 'friendly', label: 'Friendly' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'luxury', label: 'Luxury' }
            ]}
            value={data.creativeGuidance.brandVoice}
            onChange={(e) => updateGuidance('brandVoice', e.target.value)}
            description="The tone and personality of your brand"
          />
          
          <Input
            label="Key Message/Benefit"
            value={data.creativeGuidance.keyMessage}
            onChange={(e) => updateGuidance('keyMessage', e.target.value)}
            placeholder="e.g., Save 50% on energy bills with smart home automation"
            maxLength={100}
            description="The main benefit or value proposition (max 100 characters)"
          />
          
          <Select
            label="Visual Style"
            options={[
              { value: '', label: 'Match campaign objective' },
              { value: 'clean_minimal', label: 'Clean/Minimal' },
              { value: 'bold_dynamic', label: 'Bold/Dynamic' },
              { value: 'lifestyle_people', label: 'Lifestyle/People' },
              { value: 'product_focused', label: 'Product-Focused' }
            ]}
            value={data.creativeGuidance.visualStyle}
            onChange={(e) => updateGuidance('visualStyle', e.target.value)}
            description="The visual style for generated images"
          />
        </Form>
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">AI Content Generation</h4>
        <p className="text-green-700 text-sm">
          Our AI will generate 3-5 creative variations based on your guidance. You'll be able to 
          review, edit, and approve them before launch.
        </p>
      </div>
    </div>
  );
}

function DripCampaignStep({ 
  data, 
  onChange 
}: { 
  data: CampaignData; 
  onChange: (data: CampaignData) => void; 
}) {
  const updateDrip = (field: keyof CampaignData['dripCampaign'], value: any) => {
    onChange({ 
      ...data, 
      dripCampaign: { ...data.dripCampaign, [field]: value } 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Automated Lead Nurturing</h3>
        <p className="text-muted-foreground mb-6">
          Set up automated follow-up messages for leads captured by your Meta campaign.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="enableDrip"
              checked={data.dripCampaign.enabled}
              onChange={(e) => updateDrip('enabled', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="enableDrip" className="font-medium text-foreground">
              Enable automated drip campaign
            </label>
          </div>
          
          {data.dripCampaign.enabled && (
            <Form>
              <Select
                label="Drip Campaign Template"
                options={[
                  { value: 'lead_nurturing_standard', label: 'Standard Lead Nurturing (3 messages)' },
                  { value: 'service_business', label: 'Service Business (5 messages)' },
                  { value: 'ecommerce', label: 'E-commerce (4 messages)' },
                  { value: 'custom', label: 'Custom Sequence' }
                ]}
                value={data.dripCampaign.template}
                onChange={(e) => updateDrip('template', e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Communication Channels
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={data.dripCampaign.channels.includes('sms')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateDrip('channels', [...data.dripCampaign.channels, 'sms']);
                        } else {
                          updateDrip('channels', data.dripCampaign.channels.filter(c => c !== 'sms'));
                        }
                      }}
                      className="mr-2 rounded"
                    />
                    SMS (A2P 10DLC compliant)
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={data.dripCampaign.channels.includes('email')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateDrip('channels', [...data.dripCampaign.channels, 'email']);
                        } else {
                          updateDrip('channels', data.dripCampaign.channels.filter(c => c !== 'email'));
                        }
                      }}
                      className="mr-2 rounded"
                    />
                    Email (SendGrid)
                  </label>
                </div>
              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ 
  data, 
  creating 
}: { 
  data: CampaignData; 
  onSubmit: () => void;
  creating: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Review Your Campaign</h3>
        <p className="text-muted-foreground mb-6">
          Please review all settings before launching your campaign.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Campaign Setup */}
        <Card title="Campaign Setup">
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Name:</span> {data.name}</div>
            <div><span className="font-medium">Objective:</span> {data.objective}</div>
            <div><span className="font-medium">Daily Budget:</span> ${data.dailyBudget / 100}</div>
          </div>
        </Card>
        
        {/* Targeting */}
        <Card title="Target Audience">
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Age:</span> {data.audience.ageMin}-{data.audience.ageMax}</div>
            <div><span className="font-medium">Gender:</span> {data.audience.genders.join(', ')}</div>
            <div><span className="font-medium">Locations:</span> {data.audience.locations.length > 0 ? data.audience.locations.join(', ') : 'Not specified'}</div>
          </div>
        </Card>
        
        {/* Creative Guidance */}
        <Card title="Creative Guidance">
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Brand Voice:</span> {data.creativeGuidance.brandVoice || 'Auto-detect'}</div>
            <div><span className="font-medium">Key Message:</span> {data.creativeGuidance.keyMessage || 'Not specified'}</div>
            <div><span className="font-medium">Visual Style:</span> {data.creativeGuidance.visualStyle || 'Auto-detect'}</div>
          </div>
        </Card>
        
        {/* Drip Campaign */}
        <Card title="Drip Campaign">
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Enabled:</span> {data.dripCampaign.enabled ? 'Yes' : 'No'}</div>
            {data.dripCampaign.enabled && (
              <>
                <div><span className="font-medium">Template:</span> {data.dripCampaign.template}</div>
                <div><span className="font-medium">Channels:</span> {data.dripCampaign.channels.join(', ')}</div>
              </>
            )}
          </div>
        </Card>
      </div>
      
      <div className="bg-green-50 p-6 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">🚀 Ready to Launch</h4>
        <p className="text-green-700 text-sm mb-4">
          Your campaign will be created and both your Meta campaign and drip sequence will be activated together.
        </p>
        <div className="text-xs text-green-600">
          <div>✅ Meta campaign configured</div>
          <div>✅ AI creative generation ready</div>
          <div>✅ Lead capture webhook enabled</div>
          {data.dripCampaign.enabled && <div>✅ Drip campaign synchronized</div>}
        </div>
      </div>
      
      {creating && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner text="Creating your campaign..." />
        </div>
      )}
    </div>
  );
}