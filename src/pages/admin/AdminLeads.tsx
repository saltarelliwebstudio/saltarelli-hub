import { useState } from 'react';
import { Plus, Pencil, ContactRound, AlertCircle } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminLeads, useAdminFollowupsDue, type AdminLead } from '@/hooks/useSupabaseData';
import { LeadModal } from '@/components/admin/LeadModal';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<AdminLead['status'], string> = {
  cold: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  warm: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  hot: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  followed_up: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  closed: 'bg-red-500/10 text-red-500 border-red-500/20',
  client: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const STATUS_LABELS: Record<AdminLead['status'], string> = {
  cold: 'Cold',
  warm: 'Warm',
  hot: 'Hot',
  followed_up: 'Followed Up',
  closed: 'Closed',
  client: 'Client',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return format(new Date(dateStr + 'T00:00:00'), 'MMM d, yyyy');
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return isBefore(new Date(dateStr + 'T00:00:00'), startOfDay(new Date()));
}

export default function AdminLeads() {
  const { data: leads, isLoading } = useAdminLeads();
  const { data: followupsDue } = useAdminFollowupsDue();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);

  const handleEdit = (lead: AdminLead) => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  const followupCount = followupsDue?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
              {leads && (
                <Badge variant="secondary" className="text-sm">
                  {leads.length}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Track and manage your sales prospects</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {followupCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
              <AlertCircle className="h-4 w-4" />
              {followupCount} follow-up{followupCount !== 1 ? 's' : ''} due
            </div>
          )}
          <Button
            className="gradient-orange text-white shadow-glow-orange"
            onClick={handleAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Service Interest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead>Last Contacted</TableHead>
              <TableHead>Next Follow-Up</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : !leads || leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ContactRound className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No leads yet. Click "Add Lead" to add your first one.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.business_name || '\u2014'}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.source || '\u2014'}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.service_interest || '\u2014'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_STYLES[lead.status]}>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                      {lead.status === 'followed_up' && lead.followup_date && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(lead.followup_date)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(lead.date_added)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(lead.last_contacted_date)}
                  </TableCell>
                  <TableCell>
                    {lead.next_followup_date ? (
                      <span
                        className={cn(
                          'text-sm',
                          isOverdue(lead.next_followup_date) && lead.status !== 'closed' && lead.status !== 'client'
                            ? 'text-red-500 font-medium'
                            : 'text-muted-foreground'
                        )}
                      >
                        {formatDate(lead.next_followup_date)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">{'\u2014'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(lead)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Lead Modal */}
      <LeadModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        lead={editingLead}
      />
    </div>
  );
}
