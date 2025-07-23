import { Link } from 'react-router-dom';
import { PageLayout, Card } from '../components/PageLayout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/apiService';
import { 
  BarChart3, 
  Users, 
  Mail, 
  TrendingUp, 
  Activity,
  Plus,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  newLeads: number;
  emailsSent: number;
  conversionRate: number;
  revenue: number;
  growth: number;
}

export function DashboardPage() {
  const { 
    data: stats, 
    loading: isLoading, 
    error 
  } = useApi<DashboardStats>(() => apiService.getDashboardStats());

  if (isLoading) {
    return (
      <PageLayout
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your campaigns."
      >
        <LoadingSpinner />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your campaigns."
      >
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">Unable to load dashboard data.</p>
            <p className="text-sm text-gray-400 mt-2">{error}</p>
          </div>
        </Card>
      </PageLayout>
    );
  }

  const statCards = [
    {
      title: 'Total Campaigns',
      value: stats?.totalCampaigns || 0,
      change: '+12%',
      trend: 'up' as const,
      icon: BarChart3,
      color: 'blue'
    },
    {
      title: 'Active Leads',
      value: stats?.totalLeads || 0,
      change: '+8%',
      trend: 'up' as const,
      icon: Users,
      color: 'green'
    },
    {
      title: 'Emails Sent',
      value: stats?.emailsSent || 0,
      change: '+23%',
      trend: 'up' as const,
      icon: Mail,
      color: 'purple'
    },
    {
      title: 'Conversion Rate',
      value: `${stats?.conversionRate || 0}%`,
      change: '-2%',
      trend: 'down' as const,
      icon: TrendingUp,
      color: 'orange'
    }
  ];

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Welcome back! Here's what's happening with your campaigns."
      actions={
        <Link
          to="/campaigns/create"
          className="btn btn-primary"
        >
          <Plus size={20} />
          New Campaign
        </Link>
      }
    >
      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className={`stat-card stat-card-${stat.color}`}>
              <div className="stat-header">
                <h3>{stat.title}</h3>
                <div className="stat-icon">
                  <Icon size={24} />
                </div>
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className={`stat-change stat-change-${stat.trend === 'up' ? 'increase' : 'decrease'}`}>
                {stat.trend === 'up' ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}
                {stat.change} from last month
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        {/* Recent Campaigns */}
        <Card>
          <div className="card-header">
            <h2>Recent Campaigns</h2>
            <Link to="/campaigns" className="card-action">
              View all
            </Link>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Activity size={20} className="text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Campaign {i}</h4>
                      <p className="text-sm text-gray-500">Created 2 days ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">$1,234</div>
                    <div className="text-xs text-gray-500">Budget</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/campaigns/create"
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center"
              >
                <BarChart3 size={32} className="mx-auto mb-2 text-primary-600" />
                <div className="font-medium">New Campaign</div>
                <div className="text-sm text-gray-500">Create campaign</div>
              </Link>
              
              <Link
                to="/leads"
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center"
              >
                <Users size={32} className="mx-auto mb-2 text-primary-600" />
                <div className="font-medium">Import Leads</div>
                <div className="text-sm text-gray-500">Add new leads</div>
              </Link>
              
              <Link
                to="/drip-campaigns"
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center"
              >
                <Mail size={32} className="mx-auto mb-2 text-primary-600" />
                <div className="font-medium">Drip Campaign</div>
                <div className="text-sm text-gray-500">Automate emails</div>
              </Link>
              
              <Link
                to="/analytics"
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center"
              >
                <TrendingUp size={32} className="mx-auto mb-2 text-primary-600" />
                <div className="font-medium">Analytics</div>
                <div className="text-sm text-gray-500">View reports</div>
              </Link>
            </div>
          </div>
        </Card>

        {/* Performance Chart */}
        <Card className="dashboard-card-wide">
          <div className="card-header">
            <h2>Performance Overview</h2>
            <select className="border border-gray-300 rounded-md px-3 py-1 text-sm">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="card-content">
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <BarChart3 size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Performance chart will display here</p>
                <p className="text-sm text-gray-400">Connect to analytics service to view data</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}