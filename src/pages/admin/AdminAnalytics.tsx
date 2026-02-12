import { useState, useMemo } from 'react';
import { BarChart3, Phone, Zap, ContactRound, Users, TrendingUp, Search, Calendar } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MonthPicker } from '@/components/ui/month-picker';
import {
  useAdminStats,
  useCallVolumeStats,
  useAdminStatsForMonth,
  useAllLeadStatsForMonth,
  useSupportStatsForMonth,
  usePerPodStatsForMonth,
  useAllCallLogsForMonth,
  useMonthlyHistorySummaries,
} from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function AdminAnalytics() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [historySearch, setHistorySearch] = useState('');

  // All-time stats (for total clients count)
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  // Call volume stats (pinned to current period)
  const { data: volumeStats, isLoading: volumeLoading } = useCallVolumeStats();

  // Monthly-scoped stats
  const { data: monthStats, isLoading: monthStatsLoading } = useAdminStatsForMonth(selectedMonth.month, selectedMonth.year);
  const { data: monthLeadStats, isLoading: monthLeadsLoading } = useAllLeadStatsForMonth(selectedMonth.month, selectedMonth.year);
  const { data: monthSupportStats, isLoading: monthSupportLoading } = useSupportStatsForMonth(selectedMonth.month, selectedMonth.year);
  const { data: monthPodStats, isLoading: monthPodStatsLoading } = usePerPodStatsForMonth(selectedMonth.month, selectedMonth.year);
  const { data: monthCallLogs } = useAllCallLogsForMonth(selectedMonth.month, selectedMonth.year);

  // Monthly history
  const { data: historySummaries, isLoading: historyLoading } = useMonthlyHistorySummaries();

  // Call status breakdown for selected month
  const callBreakdown = useMemo(() => {
    if (!monthCallLogs) return { completed: 0, missed: 0, failed: 0, voicemail: 0 };
    return {
      completed: monthCallLogs.filter((c: any) => c.call_status === 'completed').length,
      missed: monthCallLogs.filter((c: any) => c.call_status === 'missed').length,
      failed: monthCallLogs.filter((c: any) => c.call_status === 'failed').length,
      voicemail: monthCallLogs.filter((c: any) => c.call_status === 'voicemail').length,
    };
  }, [monthCallLogs]);

  // Filter history summaries by search
  const filteredHistory = useMemo(() => {
    if (!historySummaries) return [];
    if (!historySearch.trim()) return historySummaries;
    const q = historySearch.toLowerCase();
    return historySummaries.filter(s =>
      MONTH_NAMES[s.month].toLowerCase().includes(q) ||
      s.year.toString().includes(q)
    );
  }, [historySummaries, historySearch]);

  const isMonthLoading = monthStatsLoading || monthLeadsLoading || monthSupportLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Aggregated stats across all clients</p>
      </div>

      {/* Call Volume Stats - pinned to current period */}
      <div className="grid gap-4 md:grid-cols-2">
        {volumeLoading ? (
          <>
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[120px] rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Calls This Week"
              value={volumeStats?.thisWeek || 0}
              icon={Phone}
              variant="accent"
              trend={volumeStats ? {
                value: Math.abs(volumeStats.weekTrend),
                isPositive: volumeStats.weekTrend >= 0,
              } : undefined}
            />
            <StatCard
              title="Calls This Month"
              value={volumeStats?.thisMonth || 0}
              icon={TrendingUp}
              variant="accent"
              trend={volumeStats ? {
                value: Math.abs(volumeStats.monthTrend),
                isPositive: volumeStats.monthTrend >= 0,
              } : undefined}
            />
          </>
        )}
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-3">
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        <span className="text-sm text-muted-foreground">
          Showing stats for {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}
        </span>
      </div>

      {/* Monthly stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(isMonthLoading || statsLoading) ? (
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
              title="Calls"
              value={(monthStats?.totalCalls || 0).toLocaleString()}
              icon={Phone}
              variant="accent"
            />
            <StatCard
              title="Leads"
              value={(monthLeadStats?.total || 0).toLocaleString()}
              icon={ContactRound}
              variant="success"
            />
            <StatCard
              title="Automations"
              value={(monthStats?.totalAutomations || 0).toLocaleString()}
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
            <div className="text-2xl font-bold">{monthLeadStats?.new || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting contact</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualified Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{monthLeadStats?.qualified || 0}</div>
            <p className="text-xs text-muted-foreground">Ready to close</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Support Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{monthSupportStats?.open || 0}</div>
            <p className="text-xs text-muted-foreground">open of {monthSupportStats?.total || 0} total</p>
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
          <CardDescription>{MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}</CardDescription>
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
          <CardDescription>{MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthPodStatsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !monthPodStats || monthPodStats.length === 0 ? (
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
                {monthPodStats.map((pod) => (
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

      {/* Monthly History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                Monthly History
              </CardTitle>
              <CardDescription>Click a month to view its stats</CardDescription>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search months..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : filteredHistory.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No matching months found.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filteredHistory.map((s) => {
                const isSelected = s.month === selectedMonth.month && s.year === selectedMonth.year;
                const hasData = s.calls > 0 || s.automations > 0 || s.leads > 0;

                return (
                  <button
                    key={`${s.year}-${s.month}`}
                    onClick={() => setSelectedMonth({ month: s.month, year: s.year })}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all hover:shadow-md',
                      isSelected
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-border hover:border-accent/30',
                      !hasData && 'opacity-60',
                    )}
                  >
                    <p className="font-medium text-sm">{SHORT_MONTHS[s.month]} {s.year}</p>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>{s.calls} calls</span>
                      <span>{s.automations} auto</span>
                      <span>{s.leads} leads</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
