import { useState } from 'react';
import { PageLayout, Card, EmptyState } from '../components/PageLayout';
import { Button, Input, Select } from '../components/Form';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useApi, usePagination } from '../hooks/useApi';
import { apiService } from '../services/apiService';
import type { Lead } from '../types';

export function LeadsPage() {
  const [filters, setFilters] = useState({
    campaignId: '',
    search: '',
    status: ''
  });
  
  const { page, limit, nextPage, prevPage } = usePagination();
  
  const { 
    data: leadsData, 
    loading, 
    error, 
    refetch 
  } = useApi(() => 
    apiService.getLeads(page, limit, filters.campaignId || undefined), 
    [page, limit, filters.campaignId]
  );

  const leads = leadsData?.items || [];
  const total = leadsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Filter leads based on search and status
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !filters.search || 
      lead.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      lead.phone?.includes(filters.search);
    
    const matchesStatus = !filters.status || lead.status === filters.status;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <PageLayout
      title="Leads"
      subtitle="Manage and track your captured leads"
      actions={
        <Button onClick={() => refetch()}>
          Refresh
        </Button>
      }
    >
      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search by email or phone..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
          <Select
            options={[
              { value: '', label: 'All Campaigns' },
              { value: 'campaign1', label: 'Campaign 1' },
              { value: 'campaign2', label: 'Campaign 2' }
            ]}
            value={filters.campaignId}
            onChange={(e) => setFilters(prev => ({ ...prev, campaignId: e.target.value }))}
          />
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'converted', label: 'Converted' },
              { value: 'unsubscribed', label: 'Unsubscribed' }
            ]}
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          />
        </div>
      </Card>

      {error && (
        <Card className="mb-6">
          <div className="text-destructive">
            <p className="font-medium">Error loading leads</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading leads..." />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <EmptyState
            title="No leads found"
            description={filters.search || filters.status ? 
              "Try adjusting your filters to see more leads" : 
              "Leads will appear here once your campaigns start capturing them"
            }
            icon={
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        </Card>
      ) : (
        <>
          {/* Leads Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Campaign</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Source</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Captured</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {filteredLeads.length} of {total} leads
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

function LeadRow({ lead }: { lead: Lead }) {
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    converted: 'bg-blue-100 text-blue-800',
    unsubscribed: 'bg-red-100 text-red-800'
  };

  return (
    <tr className="border-b border-border hover:bg-secondary/50">
      <td className="py-3 px-4">
        <div>
          <div className="font-medium text-foreground">{lead.email}</div>
          {lead.phone && (
            <div className="text-sm text-muted-foreground">{lead.phone}</div>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-muted-foreground">
          Campaign #{lead.campaignId.slice(-8)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-muted-foreground capitalize">
          {lead.source}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[lead.status]}`}>
          {lead.status}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-muted-foreground">
          {new Date(lead.capturedAt).toLocaleDateString()}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = `/leads/${lead.id}`}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = `/leads/${lead.id}/journey`}
          >
            Journey
          </Button>
        </div>
      </td>
    </tr>
  );
}