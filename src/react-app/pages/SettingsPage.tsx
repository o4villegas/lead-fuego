import { useState } from 'react';
import { PageLayout, Card } from '../components/PageLayout';
import { Form, Input, Button } from '../components/Form';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsyncAction } from '../hooks/useApi';
import { apiService } from '../services/apiService';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'notifications'>('profile');

  return (
    <PageLayout
      title="Settings"
      subtitle="Manage your account settings and API configurations"
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            <NavButton
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            >
              Profile Settings
            </NavButton>
            <NavButton
              active={activeTab === 'api'}
              onClick={() => setActiveTab('api')}
            >
              API Configuration
            </NavButton>
            <NavButton
              active={activeTab === 'notifications'}
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </NavButton>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'api' && <ApiSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </PageLayout>
  );
}

function NavButton({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function ProfileSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    company: user?.company || '',
    email: user?.email || ''
  });

  const { execute: updateProfile, loading } = useAsyncAction(
    (_data: typeof formData) => apiService.getCurrentUser() // TODO: Implement updateProfile endpoint
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await updateProfile(formData);
    if (success) {
      showToast('Profile updated successfully', 'success');
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card title="Profile Information">
      <Form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={handleChange('firstName')}
            placeholder="Enter your first name"
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={handleChange('lastName')}
            placeholder="Enter your last name"
          />
        </div>
        
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          placeholder="Enter your email"
          disabled
          description="Email cannot be changed after registration"
        />
        
        <Input
          label="Company"
          value={formData.company}
          onChange={handleChange('company')}
          placeholder="Enter your company name"
        />

        <div className="flex justify-end">
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </div>
      </Form>
    </Card>
  );
}

function ApiSettings() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    metaAccessToken: '',
    metaAdAccountId: '',
    metaAppId: '',
    metaAppSecret: '',
    openaiApiKey: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    sendgridApiKey: ''
  });

  const { execute: saveApiSettings, loading } = useAsyncAction(
    (_data: typeof formData) => Promise.resolve(_data) // TODO: Implement saveApiSettings endpoint
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveApiSettings(formData);
    if (success) {
      showToast('API settings saved successfully', 'success');
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };


  return (
    <div className="space-y-6">
      <Card title="Meta API Configuration" description="Configure your Meta Marketing API credentials">
        <Form>
          <Input
            label="Access Token"
            type="password"
            value={formData.metaAccessToken}
            onChange={handleChange('metaAccessToken')}
            placeholder="Enter your Meta access token"
            description="Your Meta Marketing API access token"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Ad Account ID"
              value={formData.metaAdAccountId}
              onChange={handleChange('metaAdAccountId')}
              placeholder="act_1234567890"
            />
            <Input
              label="App ID"
              value={formData.metaAppId}
              onChange={handleChange('metaAppId')}
              placeholder="Enter your app ID"
            />
          </div>
          <Input
            label="App Secret"
            type="password"
            value={formData.metaAppSecret}
            onChange={handleChange('metaAppSecret')}
            placeholder="Enter your app secret"
          />
        </Form>
      </Card>

      <Card title="OpenAI Configuration" description="Configure your OpenAI API for content generation">
        <Form>
          <Input
            label="OpenAI API Key"
            type="password"
            value={formData.openaiApiKey}
            onChange={handleChange('openaiApiKey')}
            placeholder="sk-..."
            description="Your OpenAI API key for DALL-E image generation"
          />
        </Form>
      </Card>

      <Card title="Communication APIs" description="Configure Twilio and SendGrid for drip campaigns">
        <Form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Twilio Account SID"
              value={formData.twilioAccountSid}
              onChange={handleChange('twilioAccountSid')}
              placeholder="AC..."
            />
            <Input
              label="Twilio Auth Token"
              type="password"
              value={formData.twilioAuthToken}
              onChange={handleChange('twilioAuthToken')}
              placeholder="Enter auth token"
            />
          </div>
          <Input
            label="SendGrid API Key"
            type="password"
            value={formData.sendgridApiKey}
            onChange={handleChange('sendgridApiKey')}
            placeholder="SG..."
            description="Your SendGrid API key for email campaigns"
          />
        </Form>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={loading}>
          Save All API Settings
        </Button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    campaignAlerts: true,
    leadNotifications: false,
    weeklyReports: true
  });

  const handleToggle = (setting: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
    showToast(`${setting} ${settings[setting] ? 'disabled' : 'enabled'}`, 'success');
  };

  return (
    <Card title="Notification Preferences">
      <div className="space-y-4">
        <NotificationToggle
          title="Email Notifications"
          description="Receive general email notifications"
          checked={settings.emailNotifications}
          onChange={() => handleToggle('emailNotifications')}
        />
        <NotificationToggle
          title="Campaign Alerts"
          description="Get notified when campaigns start, pause, or complete"
          checked={settings.campaignAlerts}
          onChange={() => handleToggle('campaignAlerts')}
        />
        <NotificationToggle
          title="Lead Notifications"
          description="Instant notifications when new leads are captured"
          checked={settings.leadNotifications}
          onChange={() => handleToggle('leadNotifications')}
        />
        <NotificationToggle
          title="Weekly Reports"
          description="Receive weekly performance summaries"
          checked={settings.weeklyReports}
          onChange={() => handleToggle('weeklyReports')}
        />
      </div>
    </Card>
  );
}

function NotificationToggle({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}