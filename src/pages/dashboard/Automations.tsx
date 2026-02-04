import { useState } from 'react';
import { Search, Zap, Mail, MessageSquare, Calendar, Workflow, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// Mock data
const mockModuleStats = [
  { type: 'leads', label: 'Leads Captured', count: 47, trend: 12, icon: Mail },
  { type: 'sms', label: 'SMS Sent', count: 132, trend: 8, icon: MessageSquare },
  { type: 'bookings', label: 'Bookings Confirmed', count: 23, trend: -5, icon: Calendar },
  { type: 'workflow', label: 'Workflow Runs', count: 89, trend: 15, icon: Workflow },
];

const mockAutomationLogs = [
  {
    id: '1',
    module_type: 'leads',
    event_type: 'lead_captured',
    event_label: 'New lead from website form',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 15),
    payload: { email: 'john@example.com', source: 'website_form', name: 'John Doe' },
  },
  {
    id: '2',
    module_type: 'sms',
    event_type: 'sms_sent',
    event_label: 'Appointment reminder sent',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 30),
    payload: { to: '+15551234567', message: 'Reminder: Your appointment is tomorrow at 2 PM' },
  },
  {
    id: '3',
    module_type: 'workflow',
    event_type: 'workflow_run',
    event_label: 'Follow-up sequence triggered',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 60),
    payload: { workflow_id: 'follow_up_v1', trigger: 'new_lead', steps_completed: 3 },
  },
  {
    id: '4',
    module_type: 'bookings',
    event_type: 'booking_failed',
    event_label: 'Calendar sync failed',
    status: 'failed',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    payload: { error: 'Calendar API rate limit exceeded', retry_count: 3 },
  },
  {
    id: '5',
    module_type: 'leads',
    event_type: 'lead_captured',
    event_label: 'New lead from Facebook ad',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
    payload: { email: 'sarah@example.com', source: 'facebook', campaign: 'summer_promo' },
  },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<typeof mockAutomationLogs[0] | null>(null);

  const filteredLogs = mockAutomationLogs.filter((log) => {
    const matchesSearch =
      log.event_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === 'all' || log.module_type === moduleFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesModule && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">Monitor your automation events and workflows</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mockModuleStats.map((stat) => {
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
                <div className={cn(
                  'flex items-center text-xs',
                  stat.trend >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {stat.trend >= 0 ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {Math.abs(stat.trend)}% from last month
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No events found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const ModuleIcon = moduleIcons[log.module_type] || Zap;
                return (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {format(log.created_at, 'MMM d, yyyy')}
                      <span className="block text-sm text-muted-foreground">
                        {format(log.created_at, 'h:mm a')}
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
                        <p className="font-medium">{log.event_label}</p>
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
              {selectedEvent && format(selectedEvent.created_at, 'MMMM d, yyyy at h:mm a')}
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
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Payload</p>
                <ScrollArea className="h-[200px] rounded-lg border bg-muted/50 p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
