import { useState, useEffect } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import { Search, Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useMyPod, useCallLogsPaginated, CallLog, PodWithSettings } from '@/hooks/useSupabaseData';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

const statusStyles: Record<string, string> = {
  completed: 'bg-success/10 text-success border-success/20',
  missed: 'bg-destructive/10 text-destructive border-destructive/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  voicemail: 'bg-warning/10 text-warning border-warning/20',
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default function CallLogs() {
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;

  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;
  const podId = pod?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: paginatedData, isLoading: callsLoading, isFetching } = useCallLogsPaginated(podId, {
    page,
    pageSize,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    direction: directionFilter !== 'all' ? directionFilter : undefined,
    search: searchQuery || undefined,
  });

  const callLogs = paginatedData?.data ?? [];
  const totalCount = paginatedData?.count ?? 0;
  const hasMore = page * pageSize < totalCount;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, directionFilter, searchQuery]);

  // Redirect if voice module is not enabled
  if (!podLoading && pod && !pod.pod_settings?.voice_enabled && !isViewAsClient) {
    return <Navigate to="/dashboard" replace />;
  }

  const isLoading = podLoading || callsLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Call Logs</h1>
        <p className="text-muted-foreground">View and manage your voice agent call history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by phone or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Summary</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : !callLogs || callLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Phone className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' || directionFilter !== 'all' 
                        ? 'No calls match your filters' 
                        : 'No calls synced yet. Make sure a Retell account is configured and active.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              callLogs.map((call) => (
                <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {call.call_started_at ? (
                      <>
                        {format(new Date(call.call_started_at), 'MMM d, yyyy')}
                        <span className="block text-sm text-muted-foreground">
                          {format(new Date(call.call_started_at), 'h:mm a')}
                        </span>
                      </>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {formatPhone(call.direction === 'inbound' ? call.caller_number : call.called_number)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-4 w-4 text-success" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-accent" />
                      )}
                      <span className="capitalize">{call.direction}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('capitalize', statusStyles[call.call_status || 'completed'])}
                    >
                      {call.call_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {call.summary ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-[300px]">
                        {call.summary}
                      </p>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCall(call)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * pageSize + 1, totalCount)} - {Math.min(page * pageSize, totalCount)} of {totalCount} calls
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || isFetching}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || isFetching}
              onClick={() => setPage(p => p + 1)}
            >
              {isFetching ? 'Loading...' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Call Detail Dialog - Simplified */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Details
            </DialogTitle>
            <DialogDescription>
              {selectedCall?.call_started_at && format(new Date(selectedCall.call_started_at), 'MMMM d, yyyy \'at\' h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
              {/* Call Info - Simplified */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">
                    {formatPhone(selectedCall.direction === 'inbound' ? selectedCall.caller_number : selectedCall.called_number)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDuration(selectedCall.duration_seconds)}
                  </p>
                </div>
              </div>

              {/* Summary - only show if exists */}
              {selectedCall.summary && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Summary</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedCall.summary}
                  </p>
                </div>
              )}

              {/* Transcript - scrollable */}
              <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
                <p className="text-sm font-medium">Transcript</p>
                {selectedCall.transcript ? (
                  <ScrollArea className="flex-1 rounded-lg border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                      {selectedCall.transcript}
                    </p>
                  </ScrollArea>
                ) : (
                  <div className="flex-1 rounded-lg border bg-muted/30 p-4 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground italic">Transcript not available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
