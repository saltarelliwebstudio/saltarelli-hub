import { Users, Phone, Zap } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { ActivityFeed, ActivityItem } from '@/components/ui/activity-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats, useAllCallLogs, useAllAutomationLogs } from '@/hooks/useSupabaseData';
import { formatDistanceToNow } from 'date-fns';

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: recentCalls, isLoading: callsLoading } = useAllCallLogs({ limit: 5 });
  const { data: recentAutomations, isLoading: automationsLoading } = useAllAutomationLogs({ limit: 5 });

  // Combine and sort recent activity
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
      podName: (call as any).pods?.name || (call as any).pods?.company_name,
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
      podName: (auto as any).pods?.name || (auto as any).pods?.company_name,
    })) || []),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all client activity and system status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsLoading ? (
          <>
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[120px] rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Clients"
              value={stats?.totalClients || 0}
              icon={Users}
            />
            <StatCard
              title="Total Calls"
              value={(stats?.totalCalls || 0).toLocaleString()}
              icon={Phone}
            />
            <StatCard
              title="Automation Events"
              value={(stats?.totalAutomations || 0).toLocaleString()}
              icon={Zap}
            />
          </>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events across all client pods</CardDescription>
        </CardHeader>
        <CardContent>
          {callsLoading || automationsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No activity yet. Create your first client to get started.</p>
            </div>
          ) : (
            <ActivityFeed items={recentActivity} showPodName />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
