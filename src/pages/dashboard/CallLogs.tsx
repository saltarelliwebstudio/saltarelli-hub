import { useState } from 'react';
import { Search, Phone, PhoneIncoming, PhoneOutgoing, Play, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Mock data
const mockCallLogs = [
  {
    id: '1',
    caller_number: '(555) 123-4567',
    called_number: '(555) 999-0000',
    direction: 'inbound',
    duration_seconds: 222,
    call_status: 'completed',
    call_started_at: new Date(Date.now() - 1000 * 60 * 30),
    transcript: 'Agent: Thank you for calling Acme Corporation. How can I help you today?\n\nCaller: Hi, I\'d like to schedule an appointment for next week.\n\nAgent: Absolutely! I\'d be happy to help you with that. What day works best for you?\n\nCaller: Wednesday would be great if you have any openings.\n\nAgent: Let me check our availability. We have openings at 10 AM, 2 PM, and 4 PM on Wednesday. Which time would you prefer?\n\nCaller: 2 PM works perfectly.\n\nAgent: Excellent! I\'ve scheduled your appointment for Wednesday at 2 PM. You\'ll receive a confirmation email shortly. Is there anything else I can help you with?\n\nCaller: No, that\'s all. Thank you!\n\nAgent: You\'re welcome! Have a great day!',
    recording_url: 'https://example.com/recording.mp3',
  },
  {
    id: '2',
    caller_number: '(555) 987-6543',
    called_number: '(555) 999-0000',
    direction: 'inbound',
    duration_seconds: 0,
    call_status: 'missed',
    call_started_at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    transcript: null,
    recording_url: null,
  },
  {
    id: '3',
    caller_number: '(555) 999-0000',
    called_number: '(555) 456-7890',
    direction: 'outbound',
    duration_seconds: 185,
    call_status: 'completed',
    call_started_at: new Date(Date.now() - 1000 * 60 * 60 * 4),
    transcript: 'Agent: Hello, this is a follow-up call from Acme Corporation regarding your recent inquiry...',
    recording_url: 'https://example.com/recording2.mp3',
  },
  {
    id: '4',
    caller_number: '(555) 111-2222',
    called_number: '(555) 999-0000',
    direction: 'inbound',
    duration_seconds: 45,
    call_status: 'voicemail',
    call_started_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    transcript: 'Voicemail message left by caller.',
    recording_url: 'https://example.com/voicemail.mp3',
  },
];

const statusStyles: Record<string, string> = {
  completed: 'bg-success/10 text-success border-success/20',
  missed: 'bg-destructive/10 text-destructive border-destructive/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  voicemail: 'bg-warning/10 text-warning border-warning/20',
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function CallLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<typeof mockCallLogs[0] | null>(null);

  const filteredCalls = mockCallLogs.filter((call) => {
    const matchesSearch =
      call.caller_number.includes(searchQuery) ||
      call.called_number.includes(searchQuery) ||
      call.transcript?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || call.call_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Phone className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No calls found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCalls.map((call) => (
                <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {format(call.call_started_at, 'MMM d, yyyy')}
                    <span className="block text-sm text-muted-foreground">
                      {format(call.call_started_at, 'h:mm a')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {call.direction === 'inbound' ? call.caller_number : call.called_number}
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
                      className={cn('capitalize', statusStyles[call.call_status])}
                    >
                      {call.call_status}
                    </Badge>
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

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Details
            </DialogTitle>
            <DialogDescription>
              {selectedCall && format(selectedCall.call_started_at, 'MMMM d, yyyy at h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6">
              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">{selectedCall.caller_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="font-medium">{selectedCall.called_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn('capitalize mt-1', statusStyles[selectedCall.call_status])}
                  >
                    {selectedCall.call_status}
                  </Badge>
                </div>
              </div>

              {/* Recording */}
              {selectedCall.recording_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Recording
                  </p>
                  <div className="rounded-lg bg-muted p-4">
                    <audio controls className="w-full">
                      <source src={selectedCall.recording_url} type="audio/mpeg" />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.transcript && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transcript
                  </p>
                  <ScrollArea className="h-[200px] rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {selectedCall.transcript}
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
