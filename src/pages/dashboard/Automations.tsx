import { useState } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import { Search, Zap, Mail, MessageSquare, Calendar, Workflow } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useMyPod, useAutomationLogs, AutomationLog, PodWithSettings } from '@/hooks/useSupabaseData';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

const statusStyles: Record<string, string> = {
  success: 'bg-success/10 text-success border-success/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
};

const moduleIcons: Record<string, typeof Mail> = {
  leads: Mail,
  sms: MessageSquare,
  bookings: Calendar,
  workflow: Workflow,
  custom: Zap,
};

export default function Automations() {
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;

  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;
  const podId = pod?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<AutomationLog | null>(null);

  const { data: automationLogs, isLoading: logsLoading } = useAutomationLogs(podId, {
    moduleType: moduleFilter !== 'all' ? moduleFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Redirect if automations module is not enabled
  if (!podLoading && pod && !pod.pod_settings?.automations_enabled && !isViewAsClient) {
    return <Navigate to="/dashboard" replace />;
  }

  const isLoading = podLoading || logsLoading;

  // Filter by search locally
  const filteredLogs = automationLogs?.filter((log) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.event_label?.toLowerCase().includes(searchLower) ||
      log.event_type.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Calculate module stats from logs
  const moduleStats = automationLogs?.reduce((acc, log) => {
    const key = log.module_type;
    if (!acc[key]) {
      acc[key] = { count: 0, success: 0, failed: 0 };
    }
    acc[key].count++;
    if (log.status === 'success') acc[key].success++;
    if (log.status === 'failed') acc[key].failed++;
    return acc;
  }, {} as Record<string, { count: number; success: number; failed: number }>) || {};

  const statCards = Object.entries(moduleStats).map(([type, stats]) => ({
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    count: stats.count,
    icon: moduleIcons[type] || Zap,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">Monitor your automation events and workflows</p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      ) : statCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.type}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.count}</div>
                  <p className="text-xs text-muted-foreground">events this period</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="bookings">Bookings</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event Log Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery || moduleFilter !== 'all' || statusFilter !== 'all'
                        ? 'No events match your filters'
                        : 'No automation events recorded yet.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const ModuleIcon = moduleIcons[log.module_type] || Zap;
                return (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {format(new Date(log.created_at), 'MMM d, yyyy')}
                      <span className="block text-sm text-muted-foreground">
                        {format(new Date(log.created_at), 'h:mm a')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{log.module_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.event_label || log.event_type}</p>
                        <p className="text-sm text-muted-foreground">{log.event_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusStyles[log.status])}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEvent(log)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Event Details
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && format(new Date(selectedEvent.created_at), 'MMMM d, yyyy at h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Module</p>
                  <p className="font-medium capitalize">{selectedEvent.module_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn('capitalize mt-1', statusStyles[selectedEvent.status])}
                  >
                    {selectedEvent.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Event Type</p>
                  <p className="font-medium">{selectedEvent.event_type}</p>
                </div>
                {selectedEvent.event_label && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Label</p>
                    <p className="font-medium">{selectedEvent.event_label}</p>
                  </div>
                )}
              </div>

              {selectedEvent.payload && (
                <div>
                  <p className="text-sm font-medium mb-2">Payload</p>
                  <ScrollArea className="h-[200px] rounded-lg border bg-muted/50 p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
