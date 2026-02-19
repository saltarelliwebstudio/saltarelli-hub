import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Key, 
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  MessageSquare,
  Clock,
  BarChart3,
  Globe,
  Trophy,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  usePod,
  useProfile,
  useCallLogs,
  useAutomationLogs,
  useRetellAccounts,
  useAdminNotes,
  usePodCount,
  usePodTotalMinutes,
  useUpdatePod,
  useUpdatePodSettings,
  useResetClientPassword,
  useSyncRetellCalls,
  useAddAdminNote,
  useDeleteAdminNote,
  useAddRetellAccount,
  useUpdateRetellAccount,
  useDeleteRetellAccount,
  useAnalyticsConfig,
  useCreateAnalyticsConfig,
  useSyncAnalytics,
  useClientMonthlyStats,
} from '@/hooks/useSupabaseData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { StatCard } from '@/components/ui/stat-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Helper to format phone numbers
function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Helper to format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function ClientDetail() {
  const { podId } = useParams<{ podId: string }>();
  const navigate = useNavigate();
  
  const { data: pod, isLoading: podLoading } = usePod(podId);
  const { data: profile } = useProfile(pod?.owner_id);
  const { data: callLogs, isLoading: callsLoading } = useCallLogs(podId, { limit: 50 });
  const { data: automationLogs, isLoading: automationsLoading } = useAutomationLogs(podId, { limit: 50 });
  const { data: retellAccounts, isLoading: retellLoading } = useRetellAccounts(podId);
  const { data: adminNotes, isLoading: notesLoading } = useAdminNotes(podId);
  const { data: podCallCount } = usePodCount(podId, 'call_logs');
  const { data: podAutomationCount } = usePodCount(podId, 'automation_logs');
  const { data: podTotalMinutes } = usePodTotalMinutes(podId);
  
  const updatePod = useUpdatePod();
  const updatePodSettings = useUpdatePodSettings();
  const resetPassword = useResetClientPassword();
  const syncCalls = useSyncRetellCalls();
  const addNote = useAddAdminNote();
  const deleteNote = useDeleteAdminNote();
  const addRetellAccount = useAddRetellAccount();
  const updateRetellAccount = useUpdateRetellAccount();
  const deleteRetellAccount = useDeleteRetellAccount();
  const { data: analyticsConfigs } = useAnalyticsConfig(pod?.owner_id);
  const createAnalyticsConfig = useCreateAnalyticsConfig();
  const syncAnalytics = useSyncAnalytics();
  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useClientMonthlyStats(podId);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [retellAccountModalOpen, setRetellAccountModalOpen] = useState(false);
  const [newRetellAccount, setNewRetellAccount] = useState({ label: '', retell_api_key: '', retell_agent_id: '', google_sheet_url: '' });
  const [newAnalyticsSource, setNewAnalyticsSource] = useState('manual');
  const [websiteUrl, setWebsiteUrl] = useState(pod?.pod_settings?.website_url || '');
  const [googleSheetUrl, setGoogleSheetUrl] = useState(pod?.pod_settings?.google_sheet_url || '');

  // Sync website URL and google sheet state when pod data loads
  useEffect(() => {
    if (pod?.pod_settings?.website_url !== undefined) {
      setWebsiteUrl(pod.pod_settings.website_url || '');
    }
    if (pod?.pod_settings?.google_sheet_url !== undefined) {
      setGoogleSheetUrl(pod.pod_settings.google_sheet_url || '');
    }
  }, [pod?.pod_settings?.website_url, pod?.pod_settings?.google_sheet_url]);

  const [editForm, setEditForm] = useState({
    name: '',
    company_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
  });

  // Initialize edit form when pod loads
  const openEditModal = () => {
    if (pod) {
      setEditForm({
        name: pod.name,
        company_name: pod.company_name || '',
        contact_email: pod.contact_email || '',
        contact_phone: pod.contact_phone || '',
        address: pod.address || '',
      });
      setEditModalOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!podId) return;
    await updatePod.mutateAsync({ 
      podId, 
      updates: {
        name: editForm.name,
        company_name: editForm.company_name || null,
        contact_email: editForm.contact_email || null,
        contact_phone: editForm.contact_phone || null,
        address: editForm.address || null,
      }
    });
    setEditModalOpen(false);
  };

  const handleResetPassword = async () => {
    if (!pod?.owner_id || newPassword.length < 8) return;
    await resetPassword.mutateAsync({ userId: pod.owner_id, newPassword });
    setResetPasswordModalOpen(false);
    setNewPassword('');
  };

  const handleToggleModule = async (module: 'voice_enabled' | 'automations_enabled' | 'analytics_enabled' | 'website_enabled' | 'zen_planner_enabled', value: boolean) => {
    if (!podId) return;
    await updatePodSettings.mutateAsync({ podId, updates: { [module]: value } });
  };

  const handleSaveWebsiteSettings = async () => {
    if (!podId) return;
    await updatePodSettings.mutateAsync({
      podId,
      updates: {
        website_url: websiteUrl || null,
        google_sheet_url: googleSheetUrl || null,
      }
    });
  };

  const handleAddNote = async () => {
    if (!podId || !newNote.trim()) return;
    await addNote.mutateAsync({ podId, content: newNote });
    setNewNote('');
  };

  const handleDeleteNote = async () => {
    if (!podId || !noteToDelete) return;
    await deleteNote.mutateAsync({ noteId: noteToDelete, podId });
    setNoteToDelete(null);
  };

  const handleAddRetellAccount = async () => {
    if (!podId || !newRetellAccount.label || !newRetellAccount.retell_api_key || !newRetellAccount.retell_agent_id) return;
    const { google_sheet_url, ...rest } = newRetellAccount;
    await addRetellAccount.mutateAsync({ 
      pod_id: podId, 
      ...rest, 
      google_sheet_url: google_sheet_url || null 
    });
    setRetellAccountModalOpen(false);
    setNewRetellAccount({ label: '', retell_api_key: '', retell_agent_id: '', google_sheet_url: '' });
  };

  const handleViewAsClient = () => {
    navigate(`/admin/clients/${podId}/view-as-client`);
  };

  if (podLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!pod) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Client not found</h2>
        <p className="text-muted-foreground mb-4">This client may have been deleted.</p>
        <Button onClick={() => navigate('/admin/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{pod.name}</h1>
            <p className="text-muted-foreground">{pod.company_name || pod.contact_email}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openEditModal}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setResetPasswordModalOpen(true)}>
            <Key className="mr-2 h-4 w-4" />
            Reset Password
          </Button>
          <Button variant="outline" onClick={() => navigate(`/admin/clients/${podId}/progress`)}>
            <Trophy className="mr-2 h-4 w-4" />
            Member Progress
          </Button>
          <Button className="gradient-orange text-white" onClick={handleViewAsClient}>
            <Eye className="mr-2 h-4 w-4" />
            View as Client
          </Button>
        </div>
      </div>

      {/* Client Info Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{pod.contact_email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{formatPhone(pod.contact_phone)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{pod.company_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium truncate max-w-[200px]">{pod.address || '—'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="overflow-x-auto flex-nowrap justify-start w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Call Logs</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="retell">Retell Accounts</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Calls"
              value={podCallCount?.toLocaleString() || 0}
              icon={Phone}
            />
            <StatCard
              title="Total Minutes"
              value={podTotalMinutes?.toLocaleString() || 0}
              icon={Clock}
            />
            <StatCard
              title="Automation Events"
              value={podAutomationCount?.toLocaleString() || 0}
              icon={MessageSquare}
            />
            <StatCard
              title="Retell Agents"
              value={retellAccounts?.length || 0}
              icon={Building2}
            />
          </div>
        </TabsContent>

        {/* Call Logs Tab */}
        <TabsContent value="calls" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Call Logs</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => syncCalls.mutate(podId)}
              disabled={syncCalls.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncCalls.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </div>
          
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : callLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No calls synced yet. Make sure a Retell account is configured and active.
                    </TableCell>
                  </TableRow>
                ) : (
                  callLogs?.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        {call.call_started_at 
                          ? format(new Date(call.call_started_at), 'MMM d, yyyy h:mm a')
                          : '—'}
                      </TableCell>
                      <TableCell>{formatPhone(call.caller_number || call.called_number)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {call.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            call.call_status === 'completed' ? 'bg-success/10 text-success border-success/20' :
                            call.call_status === 'missed' ? 'bg-warning/10 text-warning border-warning/20' :
                            'bg-destructive/10 text-destructive border-destructive/20'
                          }
                        >
                          {call.call_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-4">
          <h3 className="text-lg font-semibold">Automation Events</h3>
          
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automationsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : automationLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No automation events recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  automationLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</TableCell>
                      <TableCell className="capitalize">{log.module_type}</TableCell>
                      <TableCell>{log.event_type}</TableCell>
                      <TableCell>{log.event_label || '—'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            log.status === 'success' ? 'bg-success/10 text-success border-success/20' :
                            log.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-warning/10 text-warning border-warning/20'
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Retell Accounts Tab */}
        <TabsContent value="retell" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Retell AI Agents</h3>
            <Button variant="outline" size="sm" onClick={() => setRetellAccountModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Agent
            </Button>
          </div>
          
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Agent ID</TableHead>
                  <TableHead>Google Sheet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retellLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : retellAccounts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No Retell agents configured. Click "Add Agent" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  retellAccounts?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.label}</TableCell>
                      <TableCell className="font-mono text-sm">{account.retell_agent_id}</TableCell>
                      <TableCell>
                        {account.google_sheet_url ? (
                          <a 
                            href={account.google_sheet_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline"
                          >
                            View Sheet
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? 'default' : 'secondary'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.last_synced_at 
                          ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              updateRetellAccount.mutate({
                                id: account.id,
                                podId: podId!,
                                updates: { is_active: !account.is_active }
                              });
                            }}
                          >
                            {account.is_active ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-50" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              deleteRetellAccount.mutate({ id: account.id, podId: podId! });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <h3 className="text-lg font-semibold">Admin Notes</h3>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note about this client..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <Button 
                onClick={handleAddNote} 
                disabled={!newNote.trim() || addNote.isPending}
              >
                {addNote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Note
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {notesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))
            ) : adminNotes?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No notes yet. Add your first note above.
              </p>
            ) : (
              adminNotes?.map((note: any) => (
                <Card key={note.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {note.profiles?.full_name || note.profiles?.email} • {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setNoteToDelete(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <h3 className="text-lg font-semibold">Monthly Analytics</h3>

          {monthlyStatsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[300px] rounded-xl" />
              <Skeleton className="h-[200px] rounded-xl" />
            </div>
          ) : !monthlyStats || monthlyStats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No monthly data available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Monthly Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Calls per Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyStats.map(s => ({
                      name: `${SHORT_MONTHS[s.month]} ${s.year}`,
                      Calls: s.calls,
                      Missed: s.missedCalls,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Calls" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Missed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Details Table */}
              <Card className="overflow-x-auto">
                <CardHeader>
                  <CardTitle className="text-base">Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Missed</TableHead>
                        <TableHead className="text-right">Minutes</TableHead>
                        <TableHead className="text-right">Automations</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyStats.map((s) => (
                        <TableRow key={`${s.year}-${s.month}`}>
                          <TableCell className="font-medium">{SHORT_MONTHS[s.month]} {s.year}</TableCell>
                          <TableCell className="text-right">{s.calls}</TableCell>
                          <TableCell className="text-right">{s.missedCalls}</TableCell>
                          <TableCell className="text-right">{s.totalMinutes}</TableCell>
                          <TableCell className="text-right">{s.automations}</TableCell>
                          <TableCell className="text-right">{s.leads}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h3 className="text-lg font-semibold">Module Settings</h3>
          
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Voice Agent</p>
                  <p className="text-sm text-muted-foreground">Enable Retell AI voice agent integration</p>
                </div>
                <Switch
                  checked={pod.pod_settings?.voice_enabled || false}
                  onCheckedChange={(checked) => handleToggleModule('voice_enabled', checked)}
                  disabled={updatePodSettings.isPending}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automations</p>
                  <p className="text-sm text-muted-foreground">Enable automation event logging</p>
                </div>
                <Switch
                  checked={pod.pod_settings?.automations_enabled || false}
                  onCheckedChange={(checked) => handleToggleModule('automations_enabled', checked)}
                  disabled={updatePodSettings.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">Enable client-facing analytics dashboard</p>
                </div>
                <Switch
                  checked={pod.pod_settings?.analytics_enabled || false}
                  onCheckedChange={(checked) => handleToggleModule('analytics_enabled', checked)}
                  disabled={updatePodSettings.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Website</p>
                  <p className="text-sm text-muted-foreground">Show a link to the client's website in their sidebar</p>
                </div>
                <Switch
                  checked={pod.pod_settings?.website_enabled || false}
                  onCheckedChange={(checked) => handleToggleModule('website_enabled', checked)}
                  disabled={updatePodSettings.isPending}
                />
              </div>

              {pod.pod_settings?.website_enabled && (
                <div className="pl-1 space-y-4 border-l-2 border-accent/30 ml-1">
                  <div className="space-y-2 ml-3">
                    <Label>Website URL</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                    {pod.pod_settings?.website_url && (
                      <p className="text-xs text-muted-foreground">
                        Current: <a href={pod.pod_settings.website_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{pod.pod_settings.website_url}</a>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 ml-3">
                    <Label>Google Sheet URL <span className="text-muted-foreground text-xs">(analytics)</span></Label>
                    <Input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    />
                    {pod.pod_settings?.google_sheet_url && (
                      <p className="text-xs text-muted-foreground">
                        Current: <a href={pod.pod_settings.google_sheet_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View Sheet</a>
                      </p>
                    )}
                  </div>
                  <div className="ml-3">
                    <Button
                      variant="outline"
                      onClick={handleSaveWebsiteSettings}
                      disabled={updatePodSettings.isPending}
                    >
                      Save Website Settings
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Zen Planner</p>
                  <p className="text-sm text-muted-foreground">Enable Zen Planner attendance data in the Analytics tab</p>
                </div>
                <Switch
                  checked={pod.pod_settings?.zen_planner_enabled || false}
                  onCheckedChange={(checked) => handleToggleModule('zen_planner_enabled', checked)}
                  disabled={updatePodSettings.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Analytics Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-accent" />
                Analytics Configuration
              </CardTitle>
              <CardDescription>Configure the analytics data source for this client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsConfigs && analyticsConfigs.length > 0 ? (
                <div className="space-y-3">
                  {analyticsConfigs.map((config: any) => (
                    <div key={config.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="font-medium capitalize">{config.source_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.is_active ? 'Active' : 'Inactive'} &middot; Added {new Date(config.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={config.is_active ? 'default' : 'secondary'}>
                        {config.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No analytics source configured.</p>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Add Analytics Source</Label>
                  <select
                    value={newAnalyticsSource}
                    onChange={(e) => setNewAnalyticsSource(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="vercel">Vercel</option>
                    <option value="google_analytics">Google Analytics</option>
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!pod?.owner_id) return;
                    createAnalyticsConfig.mutate({
                      client_id: pod.owner_id,
                      source_type: newAnalyticsSource,
                    });
                  }}
                  disabled={createAnalyticsConfig.isPending}
                >
                  {createAnalyticsConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add
                </Button>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pod?.owner_id && syncAnalytics.mutate(pod.owner_id)}
                  disabled={syncAnalytics.isPending || !analyticsConfigs?.length}
                >
                  {syncAnalytics.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Trigger Manual Sync
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Client Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.contact_email}
                onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editForm.contact_phone}
                onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updatePod.isPending}>
              {updatePod.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Client Password</DialogTitle>
            <DialogDescription>Set a new password for {pod.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleResetPassword} 
              disabled={newPassword.length < 8 || resetPassword.isPending}
            >
              {resetPassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Retell Account Modal */}
      <Dialog open={retellAccountModalOpen} onOpenChange={setRetellAccountModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Retell Agent</DialogTitle>
            <DialogDescription>Configure a new Retell AI agent for this client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agent Label</Label>
              <Input
                placeholder="e.g., Main Inbound Agent"
                value={newRetellAccount.label}
                onChange={(e) => setNewRetellAccount({ ...newRetellAccount, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Retell API Key</Label>
              <Input
                type="password"
                placeholder="key_..."
                value={newRetellAccount.retell_api_key}
                onChange={(e) => setNewRetellAccount({ ...newRetellAccount, retell_api_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Retell Agent ID</Label>
              <Input
                placeholder="agent_..."
                value={newRetellAccount.retell_agent_id}
                onChange={(e) => setNewRetellAccount({ ...newRetellAccount, retell_agent_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Google Sheet URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={newRetellAccount.google_sheet_url}
                onChange={(e) => setNewRetellAccount({ ...newRetellAccount, google_sheet_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Link a Google Sheet for the client to view call logs</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetellAccountModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddRetellAccount}
              disabled={!newRetellAccount.label || !newRetellAccount.retell_api_key || !newRetellAccount.retell_agent_id || addRetellAccount.isPending}
            >
              {addRetellAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation */}
      <AlertDialog open={!!noteToDelete} onOpenChange={() => setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
