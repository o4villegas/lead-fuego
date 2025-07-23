import { useState } from 'react';
import { PageLayout, Card, EmptyState } from '../components/PageLayout';
import { Button, Select } from '../components/Form';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/apiService';

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedCampaign, setSelectedCampaign] = useState('all');

  // Mock data for demonstration
  const {
    data: campaignsData,
    loading: campaignsLoading
  } = useApi(() => apiService.getCampaigns(1, 50), []);

  const campaigns = campaignsData?.items || [];
  
  // Mock analytics data
  const analyticsData = {
    overview: {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalLeads: 1247,
      totalSpend: 2847.50,
      averageCPL: 2.28,
      conversionRate: 12.5
    },
    chartData: {
      leads: [
        { date: '2024-01-01', leads: 45, spend: 102.50 },
        { date: '2024-01-02', leads: 52, spend: 118.30 },
        { date: '2024-01-03', leads: 38, spend: 95.20 },
        { date: '2024-01-04', leads: 61, spend: 139.80 },
        { date: '2024-01-05', leads: 47, spend: 107.90 },
        { date: '2024-01-06', leads: 55, spend: 125.60 },
        { date: '2024-01-07', leads: 49, spend: 112.40 }
      ]
    }
  };

  return (
    <PageLayout
      title="Analytics"
      subtitle="Track your campaign performance and ROI"
      actions={
        <div className="flex items-center space-x-3">
          <Select
            options={[
              { value: '7d', label: 'Last 7 Days' },
              { value: '30d', label: 'Last 30 Days' },
              { value: '90d', label: 'Last 90 Days' },
              { value: 'custom', label: 'Custom Range' }
            ]}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          />
          <Select
            options={[
              { value: 'all', label: 'All Campaigns' },
              ...campaigns.map(c => ({ value: c.id, label: c.name }))
            ]}
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
          />
          <Button variant="outline">
            Export Report
          </Button>
        </div>
      }
    >
      {campaignsLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaign data"
            description="Start running campaigns to see analytics data here"
            action={
              <Button onClick={() => window.location.href = '/campaigns/create'}>
                Create Your First Campaign
              </Button>
            }
            icon={
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <MetricCard
              title="Total Campaigns"
              value={analyticsData.overview.totalCampaigns}
              icon="📊"
            />
            <MetricCard
              title="Active Campaigns"
              value={analyticsData.overview.activeCampaigns}
              icon="🟢"
            />
            <MetricCard
              title="Total Leads"
              value={analyticsData.overview.totalLeads.toLocaleString()}
              icon="👥"
            />
            <MetricCard
              title="Total Spend"
              value={`$${analyticsData.overview.totalSpend.toLocaleString()}`}
              icon="💰"
              trend={{ value: '+12.5%', positive: true }}
            />
            <MetricCard
              title="Avg Cost/Lead"
              value={`$${analyticsData.overview.averageCPL}`}
              icon="📈"
              trend={{ value: '-8.2%', positive: true }}
            />
            <MetricCard
              title="Conversion Rate"
              value={`${analyticsData.overview.conversionRate}%`}
              icon="🎯"
              trend={{ value: '+3.1%', positive: true }}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Leads Over Time" className="col-span-1 lg:col-span-2">
              <SimpleLineChart data={analyticsData.chartData.leads} />
            </Card>
          </div>

          {/* Campaign Performance Table */}
          <Card title="Campaign Performance">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Campaign</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Leads</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Spend</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">CPL</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Conv. Rate</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 10).map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} mockMetrics={{
                      leads: Math.floor(Math.random() * 100) + 20,
                      spend: Math.floor(Math.random() * 500) + 100,
                      cpl: (Math.random() * 5 + 1).toFixed(2),
                      conversionRate: (Math.random() * 20 + 5).toFixed(1)
                    }} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Drip Campaign Analytics */}
          <Card title="Drip Campaign Performance">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">847</div>
                <div className="text-sm text-muted-foreground">SMS Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">623</div>
                <div className="text-sm text-muted-foreground">Emails Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">18.5%</div>
                <div className="text-sm text-muted-foreground">Response Rate</div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  trend 
}: { 
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card className="text-center">
      <div className="space-y-2">
        <div className="text-2xl">{icon}</div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
        {trend && (
          <div className={`text-xs ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value}
          </div>
        )}
      </div>
    </Card>
  );
}

function SimpleLineChart({ data }: { data: Array<{ date: string; leads: number; spend: number }> }) {
  const maxLeads = Math.max(...data.map(d => d.leads));
  
  return (
    <div className="h-64 flex items-end justify-between space-x-2 p-4">
      {data.map((point, index) => (
        <div key={index} className="flex flex-col items-center space-y-2 flex-1">
          <div
            className="bg-primary rounded-t"
            style={{
              height: `${(point.leads / maxLeads) * 200}px`,
              width: '100%',
              minHeight: '4px'
            }}
            title={`${point.leads} leads on ${new Date(point.date).toLocaleDateString()}`}
          />
          <div className="text-xs text-muted-foreground transform rotate-45 origin-left">
            {new Date(point.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignRow({ 
  campaign, 
  mockMetrics 
}: { 
  campaign: any;
  mockMetrics: {
    leads: number;
    spend: number;
    cpl: string;
    conversionRate: string;
  };
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    review: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-orange-100 text-orange-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  return (
    <tr className="border-b border-border hover:bg-secondary/50">
      <td className="py-3 px-4">
        <div className="font-medium text-foreground">{campaign.name}</div>
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[campaign.status as keyof typeof statusColors] || statusColors.draft}`}>
          {campaign.status}
        </span>
      </td>
      <td className="py-3 px-4 font-medium">{mockMetrics.leads}</td>
      <td className="py-3 px-4">${mockMetrics.spend.toLocaleString()}</td>
      <td className="py-3 px-4">${mockMetrics.cpl}</td>
      <td className="py-3 px-4">{mockMetrics.conversionRate}%</td>
      <td className="py-3 px-4">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => window.location.href = `/campaigns/${campaign.id}/analytics`}
        >
          Details
        </Button>
      </td>
    </tr>
  );
}