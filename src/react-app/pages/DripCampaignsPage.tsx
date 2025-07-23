import { useState } from 'react';
import { PageLayout, Card, EmptyState } from '../components/PageLayout';
import { Button, Input, Select } from '../components/Form';
import { LoadingSpinner, LoadingOverlay } from '../components/LoadingSpinner';
import { useApi, useAsyncAction, usePagination } from '../hooks/useApi';
import { apiService } from '../services/apiService';
import type { DripCampaign } from '../types';

export function DripCampaignsPage() {
  const { page, limit, nextPage, prevPage } = usePagination();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { 
    data: dripCampaignsData, 
    loading, 
    error, 
    refetch 
  } = useApi(() => apiService.getDripCampaigns(page, limit), [page, limit]);

  const { execute: deleteDripCampaign, loading: deleting } = useAsyncAction(
    (id: string) => apiService.deleteDripCampaign(id)
  );

  const dripCampaigns = dripCampaignsData?.items || [];
  const total = dripCampaignsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Filter campaigns based on search and status
  const filteredCampaigns = dripCampaigns.filter(campaign => {
    const matchesSearch = !searchTerm || 
      campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (campaign: DripCampaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      const success = await deleteDripCampaign(campaign.id);
      if (success) {
        refetch();
      }
    }
  };

  return (
    <PageLayout
      title="Drip Campaigns"
      subtitle="Manage your automated lead nurturing sequences"
      actions={
        <Button onClick={() => window.location.href = '/drip-campaigns/create'}>
          Create Drip Campaign
        </Button>
      }
    >
      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'completed', label: 'Completed' }
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Button variant="outline" onClick={refetch}>
            Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="mb-6">
          <div className="text-destructive">
            <p className="font-medium">Error loading drip campaigns</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading drip campaigns..." />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <EmptyState
            title={searchTerm || statusFilter ? "No campaigns match filters" : "No drip campaigns yet"}
            description={searchTerm || statusFilter ? 
              "Try adjusting your search or filters" : 
              "Create automated sequences to nurture your leads after they're captured"
            }
            action={
              <Button onClick={() => window.location.href = '/drip-campaigns/create'}>
                Create Drip Campaign
              </Button>
            }
            icon={
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
        </Card>
      ) : (
        <>
          {/* Campaigns Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <DripCampaignCard
                key={campaign.id}
                campaign={campaign}
                onDelete={() => handleDelete(campaign)}
                onEdit={() => window.location.href = `/drip-campaigns/${campaign.id}/edit`}
                deleting={deleting}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm text-muted-foreground">
                Showing {filteredCampaigns.length} of {total} drip campaigns
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}

function DripCampaignCard({ 
  campaign, 
  onDelete, 
  onEdit,
  deleting 
}: { 
  campaign: DripCampaign;
  onDelete: () => void;
  onEdit: () => void;
  deleting: boolean;
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-orange-100 text-orange-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  // Mock data for demonstration
  const mockStats = {
    totalSteps: Math.floor(Math.random() * 5) + 3,
    activeLeads: Math.floor(Math.random() * 150) + 20,
    completionRate: (Math.random() * 30 + 10).toFixed(1),
    channels: ['SMS', 'Email'] // Mock channels
  };

  return (
    <Card className="relative">
      {deleting && <LoadingOverlay text="Deleting..." />}
      
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{campaign.name}</h3>
            <p className="text-sm text-muted-foreground">
              {mockStats.channels.join(' + ')} • {mockStats.totalSteps} steps
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[campaign.status as keyof typeof statusColors] || statusColors.draft}`}>
            {campaign.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-foreground">{mockStats.activeLeads}</div>
            <div className="text-muted-foreground">Active Leads</div>
          </div>
          <div>
            <div className="font-medium text-foreground">{mockStats.completionRate}%</div>
            <div className="text-muted-foreground">Completion Rate</div>
          </div>
        </div>

        {/* Trigger Info */}
        <div className="text-sm">
          <div className="text-muted-foreground">Trigger:</div>
          <div className="font-medium text-foreground capitalize">
            {campaign.triggerEvent?.replace('_', ' ') || 'Lead Capture'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.location.href = `/drip-campaigns/${campaign.id}/analytics`}
            >
              Analytics
            </Button>
          </div>
          <div className="flex space-x-2">
            {campaign.status === 'active' ? (
              <Button size="sm" variant="outline">
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="outline">
                Activate
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Template Selection Component for Creating New Drip Campaigns
export function DripCampaignTemplates() {
  const templates = [
    {
      id: 'lead_nurturing_standard',
      name: 'Standard Lead Nurturing',
      description: '3-step sequence: Welcome → Follow-up → Final offer',
      steps: 3,
      channels: ['SMS', 'Email'],
      estimatedDuration: '7 days'
    },
    {
      id: 'service_business',
      name: 'Service Business',
      description: '5-step sequence focused on building trust and scheduling consultations',
      steps: 5,
      channels: ['SMS', 'Email'],
      estimatedDuration: '14 days'
    },
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: '4-step sequence with product recommendations and cart recovery',
      steps: 4,
      channels: ['SMS', 'Email'],
      estimatedDuration: '10 days'
    },
    {
      id: 'real_estate',
      name: 'Real Estate',
      description: '6-step sequence for property leads with market updates',
      steps: 6,
      channels: ['SMS', 'Email'],
      estimatedDuration: '21 days'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((template) => (
        <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">{template.name}</h3>
            <p className="text-sm text-muted-foreground">{template.description}</p>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{template.steps} steps</span>
              <span>{template.channels.join(' + ')}</span>
              <span>{template.estimatedDuration}</span>
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => window.location.href = `/drip-campaigns/create?template=${template.id}`}
            >
              Use Template
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}