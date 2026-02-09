import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, ContactRound, Phone, Mail, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPod, useLeads, useCreateLead, useUpdateLead, useDeleteLead } from '@/hooks/useSupabaseData';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  { value: 'closed', label: 'Closed', color: 'bg-muted text-muted-foreground border-muted' },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || '';
}

export default function Leads() {
  // Support "view as client" mode
  const context = useOutletContext<{ pod?: any; isViewAsClient?: boolean } | undefined>();
  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = context?.pod || myPod;
  const podId = pod?.id;

  const [statusFilter, setStatusFilter] = useState('all');
  const { data: leads, isLoading: leadsLoading } = useLeads(podId, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const isLoading = podLoading || leadsLoading;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!podId) return;

    createLead.mutate(
      {
        pod_id: podId,
        name: newName,
        phone: newPhone || undefined,
        email: newEmail || undefined,
        notes: newNotes || undefined,
        source: 'manual',
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewPhone('');
          setNewEmail('');
          setNewNotes('');
          setDialogOpen(false);
        },
      }
    );
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    if (!podId) return;
    updateLead.mutate({ id: leadId, podId, updates: { status: newStatus } });
  };

  const handleDelete = (leadId: string) => {
    if (!podId) return;
    deleteLead.mutate({ id: leadId, podId });
  };

  // Count by status
  const statusCounts = {
    new: leads?.filter((l: any) => l.status === 'new').length || 0,
    contacted: leads?.filter((l: any) => l.status === 'contacted').length || 0,
    qualified: leads?.filter((l: any) => l.status === 'qualified').length || 0,
    closed: leads?.filter((l: any) => l.status === 'closed').length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Track and manage leads from your voice agent</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-orange text-white shadow-glow-orange">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>
                Manually add a lead to your tracker.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-name">Name *</Label>
                  <Input
                    id="lead-name"
                    placeholder="John Smith"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead-phone">Phone</Label>
                    <Input
                      id="lead-phone"
                      placeholder="(555) 123-4567"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-email">Email</Label>
                    <Input
                      id="lead-email"
                      type="email"
                      placeholder="john@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-notes">Notes</Label>
                  <Textarea
                    id="lead-notes"
                    placeholder="Any details about this lead..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="gradient-orange text-white" disabled={createLead.isPending}>
                  {createLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Lead
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map((s) => (
          <Card
            key={s.value}
            className={`cursor-pointer transition-colors ${statusFilter === s.value ? 'ring-2 ring-accent' : ''}`}
            onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
          >
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{statusCounts[s.value as keyof typeof statusCounts]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leads</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {leads?.length || 0} lead{(leads?.length || 0) !== 1 ? 's' : ''}
          {statusFilter !== 'all' ? ` (${statusFilter})` : ''}
        </p>
      </div>

      {/* Leads table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ContactRound className="h-5 w-5 text-accent" />
            Lead Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!leads || leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ContactRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">No leads yet</p>
              <p className="text-sm">Leads captured by your voice agent will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        {lead.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={(value) => handleStatusChange(lead.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <Badge variant="outline" className={getStatusStyle(lead.status)}>
                            {STATUS_OPTIONS.find(s => s.value === lead.status)?.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm capitalize">
                      {lead.source?.replace('_', ' ') || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(lead.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
