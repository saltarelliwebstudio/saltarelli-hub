import { useState } from 'react';
import { Plus, Pencil, ContactRound, AlertCircle, Search, PhoneCall } from 'lucide-react';
import { format, isBefore, startOfDay, subDays, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdminLeads, useAdminFollowupsDue, useUpdateAdminLead, type AdminLead } from '@/hooks/useSupabaseData';
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

function needsContactWarning(lead: AdminLead): boolean {
  if (lead.status === 'closed' || lead.status === 'client') return false;
  if (!lead.last_contacted_date) return true;
  const contactDate = new Date(lead.last_contacted_date + 'T00:00:00');
  return !isAfter(contactDate, subDays(startOfDay(new Date()), 7));
}

export default function AdminLeads() {
  const { data: leads, isLoading } = useAdminLeads();
  const { data: followupsDue } = useAdminFollowupsDue();
  const updateLead = useUpdateAdminLead();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contactedFilter, setContactedFilter] = useState<string>('all');

  const handleEdit = (lead: AdminLead) => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  const handleLogContact = (lead: AdminLead) => {
    updateLead.mutate({
      id: lead.id,
      updates: { last_contacted_date: format(new Date(), 'yyyy-MM-dd') },
    });
  };

  const followupCount = followupsDue?.length || 0;

  const filteredLeads = leads?.filter((lead) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        lead.name.toLowerCase().includes(q) ||
        lead.business_name?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.phone?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    // Status filter
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    // Last contacted filter
    if (contactedFilter !== 'all') {
      if (contactedFilter === 'never') {
        if (lead.last_contacted_date) return false;
      } else {
        if (!lead.last_contacted_date) return false;
        const contactDate = new Date(lead.last_contacted_date + 'T00:00:00');
        const daysMap: Record<string, number> = { '7days': 7, '14days': 14, '30days': 30 };
        const days = daysMap[contactedFilter];
        if (days && !isAfter(contactDate, subDays(startOfDay(new Date()), days))) return false;
      }
    }
    return true;
  });

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

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="followed_up">Followed Up</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contactedFilter} onValueChange={setContactedFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Last Contacted" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contacted</SelectItem>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="14days">Last 2 weeks</SelectItem>
            <SelectItem value="30days">Last month</SelectItem>
            <SelectItem value="never">Never contacted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Service Interest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead>Last Contacted</TableHead>
              <TableHead>Next Follow-Up</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : !filteredLeads || filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ContactRound className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {leads && leads.length > 0
                        ? 'No leads match your filters.'
                        : 'No leads yet. Click "Add Lead" to add your first one.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {lead.name}
                      {needsContactWarning(lead) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>Not contacted in 7+ days</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.business_name || '\u2014'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lead.phone || '\u2014'}</TableCell>
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
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleLogContact(lead)}
                          >
                            <PhoneCall className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Log contact today</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(lead)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
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
