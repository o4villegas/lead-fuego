import { PageLayout, Card, EmptyState } from '../components/PageLayout';
import { Button } from '../components/Form';
import { LoadingSpinner, LoadingOverlay } from '../components/LoadingSpinner';
import { useApi, useAsyncAction, usePagination } from '../hooks/useApi';
import { apiService } from '../services/apiService';
import type { Campaign } from '../types';

export function CampaignsPage() {
  const { page, limit, nextPage, prevPage, goToPage } = usePagination();
  const { 
    data: campaignsData, 
    loading, 
    error, 
    refetch 
  } = useApi(() => apiService.getCampaigns(page, limit), [page, limit]);

  const { execute: deleteCampaign, loading: deleting } = useAsyncAction(
    (id: string) => apiService.deleteCampaign(id)
  );


  const handleDelete = async (campaign: Campaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      const success = await deleteCampaign(campaign.id);
      if (success) {
        refetch();
      }
    }
  };

  const campaigns = campaignsData?.items || [];
  const total = campaignsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Campaigns"
      subtitle="Create and manage your Meta advertising campaigns"
      actions={
        <Button onClick={() => window.location.href = '/campaigns/create'}>
          Create Campaign
        </Button>
      }
    >
      {error && (
        <Card className="mb-6">
          <div className="text-destructive">
            <p className="font-medium">Error loading campaigns</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading campaigns..." />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaigns yet"
            description="Get started by creating your first Meta advertising campaign"
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
        <>
          {/* Campaigns Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onDelete={() => handleDelete(campaign)}
                onEdit={() => window.location.href = `/campaigns/${campaign.id}/edit`}
                deleting={deleting}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} campaigns
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
                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>
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

function CampaignCard({ 
  campaign, 
  onDelete, 
  onEdit,
  deleting 
}: { 
  campaign: Campaign;
  onDelete: () => void;
  onEdit: () => void;
  deleting: boolean;
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    review: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-orange-100 text-orange-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  return (
    <Card className="relative">
      {deleting && <LoadingOverlay text="Deleting..." />}
      
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{campaign.name}</h3>
            <p className="text-sm text-muted-foreground">{campaign.objective}</p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[campaign.status]}`}>
            {campaign.status}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily Budget:</span>
            <span className="font-medium">${(campaign.dailyBudget / 100).toFixed(2)}</span>
          </div>
          {campaign.launchDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Launch Date:</span>
              <span className="font-medium">
                {new Date(campaign.launchDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.location.href = `/campaigns/${campaign.id}/analytics`}
            >
              Analytics
            </Button>
          </div>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}