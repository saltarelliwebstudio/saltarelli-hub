import { useMemo } from 'react';
import { BarChart3, Phone, Zap, ContactRound, Users, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAdminStats, usePods, useAllCallLogs, useAllAutomationLogs } from '@/hooks/useSupabaseData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch aggregated lead counts
function useAllLeadStats() {
  return useQuery({
    queryKey: ['all-lead-stats'],
    queryFn: async () => {
      const [totalResult, newResult, qualifiedResult] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
      ]);
      return {
        total: totalResult.count || 0,
        new: newResult.count || 0,
        qualified: qualifiedResult.count || 0,
      };
    },
  });
}

// Fetch per-pod call/automation counts
function usePerPodStats() {
  return useQuery({
    queryKey: ['per-pod-stats'],
    queryFn: async () => {
      const { data: pods, error: podsError } = await supabase
        .from('pods')
        .select('id, name, company_name')
        .order('created_at', { ascending: false });

      if (podsError) throw podsError;
      if (!pods) return [];

      const stats = await Promise.all(
        pods.map(async (pod) => {
          const [callsResult, automationsResult, leadsResult] = await Promise.all([
            supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id),
            supabase.from('automation_logs').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id),
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id),
          ]);
          return {
            podId: pod.id,
            name: pod.company_name || pod.name,
            calls: callsResult.count || 0,
            automations: automationsResult.count || 0,
            leads: leadsResult.count || 0,
          };
        })
      );

      return stats.sort((a, b) => b.calls - a.calls);
    },
  });
}

// Fetch support request counts
function useSupportStats() {
  return useQuery({
    queryKey: ['support-stats'],
    queryFn: async () => {
      const [totalResult, openResult] = await Promise.all([
        supabase.from('support_requests').select('id', { count: 'exact', head: true }),
        supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return {
        total: totalResult.count || 0,
        open: openResult.count || 0,
      };
    },
  });
}

export default function AdminAnalytics() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: leadStats, isLoading: leadsLoading } = useAllLeadStats();
  const { data: podStats, isLoading: podStatsLoading } = usePerPodStats();
  const { data: supportStats, isLoading: supportLoading } = useSupportStats();
  const { data: recentCalls } = useAllCallLogs({ limit: 100 });

  // Call status breakdown
  const callBreakdown = useMemo(() => {
    if (!recentCalls) return { completed: 0, missed: 0, failed: 0, voicemail: 0 };
    return {
      completed: recentCalls.filter((c: any) => c.call_status === 'completed').length,
      missed: recentCalls.filter((c: any) => c.call_status === 'missed').length,
      failed: recentCalls.filter((c: any) => c.call_status === 'failed').length,
      voicemail: recentCalls.filter((c: any) => c.call_status === 'voicemail').length,
    };
  }, [recentCalls]);

  const isLoading = statsLoading || leadsLoading || supportLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Aggregated stats across all clients</p>
      </div>

      {/* Top-level stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
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
              variant="accent"
            />
            <StatCard
              title="Total Leads"
              value={(leadStats?.total || 0).toLocaleString()}
              icon={ContactRound}
              variant="success"
            />
            <StatCard
              title="Automations Run"
              value={(stats?.totalAutomations || 0).toLocaleString()}
              icon={Zap}
              variant="warning"
            />
          </>
        )}
      </div>

      {/* Secondary stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadStats?.new || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting contact</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualified Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{leadStats?.qualified || 0}</div>
            <p className="text-xs text-muted-foreground">Ready to close</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Support Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{supportStats?.open || 0}</div>
            <p className="text-xs text-muted-foreground">of {supportStats?.total || 0} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Call Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            Call Status Breakdown
          </CardTitle>
          <CardDescription>Last 100 calls across all clients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 text-center">
              <p className="text-2xl font-bold text-green-500">{callBreakdown.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
              <p className="text-2xl font-bold text-yellow-500">{callBreakdown.missed}</p>
              <p className="text-sm text-muted-foreground">Missed</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 text-center">
              <p className="text-2xl font-bold text-red-500">{callBreakdown.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 text-center">
              <p className="text-2xl font-bold text-blue-500">{callBreakdown.voicemail}</p>
              <p className="text-sm text-muted-foreground">Voicemail</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Client Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Per-Client Breakdown
          </CardTitle>
          <CardDescription>Activity by client</CardDescription>
        </CardHeader>
        <CardContent>
          {podStatsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !podStats || podStats.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No clients yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Automations</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {podStats.map((pod) => (
                  <TableRow key={pod.podId}>
                    <TableCell className="font-medium">{pod.name}</TableCell>
                    <TableCell className="text-right">{pod.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{pod.automations.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{pod.leads.toLocaleString()}</TableCell>
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
