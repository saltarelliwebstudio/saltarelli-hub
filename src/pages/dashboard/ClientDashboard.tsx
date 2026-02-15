import { Phone, Clock, Zap, CheckCircle, XCircle, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { StatCard } from '@/components/ui/stat-card';
import { ActivityFeed, ActivityItem } from '@/components/ui/activity-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPod, useClientStats, useCallLogs, useAutomationLogs, useRetellGoogleSheets, PodWithSettings } from '@/hooks/useSupabaseData';
import { Button } from '@/components/ui/button';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

export default function ClientDashboard() {
  // Check if we're in "View as Client" mode
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;

  // If not in view-as mode, get the user's own pod
  const { data: myPod, isLoading: podLoading } = useMyPod();
  
  const pod = isViewAsClient ? viewAsPod : myPod;
  const podId = pod?.id;

  const { data: stats, isLoading: statsLoading } = useClientStats(podId);
  const { data: recentCalls } = useCallLogs(podId, { limit: 5 });
  const { data: recentAutomations } = useAutomationLogs(podId, { limit: 5 });
  const { data: googleSheets } = useRetellGoogleSheets(podId);

  const voiceEnabled = pod?.pod_settings?.voice_enabled;
  const automationsEnabled = pod?.pod_settings?.automations_enabled;

  // Combine recent activity
  const recentActivity: ActivityItem[] = [
    ...(recentCalls?.map(call => ({
      id: call.id,
      type: 'call' as const,
      title: call.call_status === 'missed' ? 'Missed call' : 
             call.call_status === 'completed' ? 'Call completed' : 
             `Call ${call.call_status}`,
      description: `${call.direction === 'inbound' ? 'From' : 'To'} ${call.caller_number || call.called_number || 'Unknown'}`,
      status: call.call_status === 'completed' ? 'success' as const : 
              call.call_status === 'missed' || call.call_status === 'failed' ? 'failed' as const : 
              'pending' as const,
      timestamp: new Date(call.call_started_at || call.created_at),
    })) || []),
    ...(recentAutomations?.map(auto => ({
      id: auto.id,
      type: 'automation' as const,
      title: auto.event_label || auto.event_type,
      description: `${auto.module_type} • ${auto.status}`,
      status: auto.status === 'success' ? 'success' as const : 
              auto.status === 'failed' ? 'failed' as const : 
              'pending' as const,
      timestamp: new Date(auto.created_at),
    })) || []),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

  // Helper to format duration
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (podLoading && !isViewAsClient) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!pod) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">No workspace found. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {pod.company_name || pod.name}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your activity this month
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statsLoading ? (
          <>
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[120px] rounded-xl" />
          </>
        ) : (
          <>
            {voiceEnabled && (
              <>
                <StatCard
                  title="Total Calls"
                  value={stats?.totalCalls || 0}
                  icon={Phone}
                />
                <StatCard
                  title="Avg Duration"
                  value={formatDuration(stats?.avgDuration || 0)}
                  icon={Clock}
                />
                <StatCard
                  title="Missed Calls"
                  value={stats?.missedCalls || 0}
                  icon={Phone}
                  variant={stats?.missedCalls && stats.missedCalls > 0 ? 'warning' : 'default'}
                />
              </>
            )}
            {automationsEnabled && (
              <>
                <StatCard
                  title="Total Events"
                  value={stats?.totalAutomations || 0}
                  icon={Zap}
                />
                <StatCard
                  title="Successful"
                  value={stats?.successfulAutomations || 0}
                  icon={CheckCircle}
                />
                <StatCard
                  title="Failed"
                  value={stats?.failedAutomations || 0}
                  icon={XCircle}
                  variant={stats?.failedAutomations && stats.failedAutomations > 0 ? 'warning' : 'default'}
                />
              </>
            )}
            {!voiceEnabled && !automationsEnabled && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <p>No modules are currently enabled for your account.</p>
                <p className="text-sm">Contact your administrator to enable features.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Call Log Sheets */}
      {googleSheets && googleSheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
              Call Log Sheets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {googleSheets.map((sheet) => (
                <a
                  key={sheet.id}
                  href={sheet.google_sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {sheet.label}
                  </Button>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest calls and automation events</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Your dashboard will populate as data comes in. Sit tight!</p>
            </div>
          ) : (
            <ActivityFeed items={recentActivity} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
