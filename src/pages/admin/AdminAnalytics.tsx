import { useState, useMemo } from 'react';
import { BarChart3, Phone, Zap, ContactRound, Users, TrendingUp, Search, Calendar, Globe, Eye, Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react';
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
  useAdminLeads,
  usePageViewStats,
} from '@/hooks/useSupabaseData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadAnalytics } from '@/components/admin/LeadAnalytics';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DEVICE_ICONS: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export default function AdminAnalytics() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [historySearch, setHistorySearch] = useState('');
  const [webDays, setWebDays] = useState('30');

  // All-time stats (for total clients count)
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  // Admin leads (for lead analytics)
  const { data: adminLeads } = useAdminLeads();

  // Website analytics
  const { data: webStats, isLoading: webLoading } = usePageViewStats(Number(webDays));

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

      {/* ── Website Traffic ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-accent" />
              Website Traffic — saltarelliwebstudio.ca
            </CardTitle>
            <Select value={webDays} onValueChange={setWebDays}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {webLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[80px] rounded-lg" />)}
            </div>
          ) : !webStats || webStats.totalViews === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No page views recorded yet. Data will appear once visitors start hitting the site.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Stat summary */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                  <Eye className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-500">{webStats.totalViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Page Views</p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 text-center">
                  <Users className="h-4 w-4 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-500">{webStats.uniqueVisitors.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Unique Visitors</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 text-center">
                  <p className="text-2xl font-bold text-purple-500">
                    {webStats.uniqueVisitors > 0
                      ? (webStats.totalViews / webStats.uniqueVisitors).toFixed(1)
                      : '0'}
                  </p>
                  <p className="text-xs text-muted-foreground">Pages / Visitor</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/10 text-center">
                  <p className="text-2xl font-bold text-orange-500">
                    {webStats.dailyViews.length > 0
                      ? Math.round(webStats.totalViews / webStats.dailyViews.length)
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Daily Views</p>
                </div>
              </div>

              {/* Daily chart (simple bar visualization) */}
              {webStats.dailyViews.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Daily Traffic</p>
                  <div className="flex items-end gap-1 h-32">
                    {webStats.dailyViews.map((d) => {
                      const maxViews = Math.max(...webStats.dailyViews.map(v => v.views));
                      const height = maxViews > 0 ? (d.views / maxViews) * 100 : 0;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className="w-full bg-primary/60 rounded-t hover:bg-primary transition-colors min-h-[2px]"
                            style={{ height: `${height}%` }}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap shadow-md z-10">
                            {d.date.slice(5)}: {d.views} views, {d.visitors} visitors
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{webStats.dailyViews[0]?.date.slice(5)}</span>
                    <span className="text-[10px] text-muted-foreground">{webStats.dailyViews[webStats.dailyViews.length - 1]?.date.slice(5)}</span>
                  </div>
                </div>
              )}

              {/* Details grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Top Pages */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Top Pages</p>
                  <div className="space-y-1.5">
                    {webStats.topPages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between text-sm">
                        <span className="truncate text-foreground">{p.path === '/' ? 'Home' : p.path}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0">{p.views}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Referrers */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Referrers</p>
                  <div className="space-y-1.5">
                    {webStats.topReferrers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">All direct traffic</p>
                    ) : (
                      webStats.topReferrers.map((r) => (
                        <div key={r.referrer} className="flex items-center justify-between text-sm">
                          <span className="truncate text-foreground flex items-center gap-1">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {r.referrer}
                          </span>
                          <Badge variant="secondary" className="ml-2 shrink-0">{r.views}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Devices */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Devices</p>
                  <div className="space-y-1.5">
                    {webStats.devices.map((d) => {
                      const Icon = DEVICE_ICONS[d.device] || Monitor;
                      const pct = webStats.totalViews > 0 ? Math.round((d.views / webStats.totalViews) * 100) : 0;
                      return (
                        <div key={d.device} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 capitalize text-foreground">
                            <Icon className="h-3.5 w-3.5" />
                            {d.device}
                          </span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Browsers */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Browsers</p>
                  <div className="space-y-1.5">
                    {webStats.browsers.map((b) => {
                      const pct = webStats.totalViews > 0 ? Math.round((b.views / webStats.totalViews) * 100) : 0;
                      return (
                        <div key={b.browser} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{b.browser}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Lead Analytics */}
      {adminLeads && <LeadAnalytics leads={adminLeads} />}

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
            <div className="overflow-x-auto">
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
            </div>
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
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
