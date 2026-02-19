import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Eye, Users, TrendingDown, RefreshCw, Loader2, Phone, Clock, PhoneOff, CalendarCheck, UserCheck, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPod, useAnalyticsData, useSyncAnalytics, useClientStats, useClientMonthlyStats, useZenPlannerAttendance, PodWithSettings } from '@/hooks/useSupabaseData';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';

type DateRangeOption = '7d' | '30d' | '90d';

const DATE_RANGES: { label: string; value: DateRangeOption; days: number }[] = [
  { label: '7 Days', value: '7d', days: 7 },
  { label: '30 Days', value: '30d', days: 30 },
  { label: '90 Days', value: '90d', days: 90 },
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

export default function Analytics() {
  const { userWithRole } = useAuth();
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;

  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;
  const podId = pod?.id;

  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const syncAnalytics = useSyncAnalytics();

  const selectedRange = DATE_RANGES.find((r) => r.value === dateRange)!;
  const startDate = subDays(new Date(), selectedRange.days);
  const endDate = new Date();

  const { data: analyticsData, isLoading: dataLoading } = useAnalyticsData(
    pod?.owner_id,
    { start: startDate, end: endDate }
  );

  // Voice agent data
  const voiceEnabled = pod?.pod_settings?.voice_enabled;
  const websiteEnabled = pod?.pod_settings?.website_enabled || pod?.pod_settings?.analytics_enabled;
  const zenPlannerEnabled = pod?.pod_settings?.zen_planner_enabled;
  const { data: clientStats, isLoading: clientStatsLoading } = useClientStats(podId);
  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useClientMonthlyStats(podId);
  const { data: zenPlannerData, isLoading: zenPlannerLoading } = useZenPlannerAttendance(
    pod?.owner_id,
    { start: startDate, end: endDate }
  );

  const isLoading = podLoading || dataLoading;

  // Parse metrics from analytics data
  const metrics = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return { pageViews: 0, uniqueVisitors: 0, bounceRate: 0, topPages: [], chartData: [] };
    }

    let pageViews = 0;
    let uniqueVisitors = 0;
    let bounceRate = 0;
    const topPages: { page: string; views: number }[] = [];
    const chartData: { date: string; views: number; visitors: number }[] = [];

    for (const row of analyticsData) {
      const val = row.metric_value as any;
      switch (row.metric_name) {
        case 'page_views':
          pageViews += typeof val === 'number' ? val : (val?.count || 0);
          break;
        case 'unique_visitors':
          uniqueVisitors += typeof val === 'number' ? val : (val?.count || 0);
          break;
        case 'bounce_rate':
          bounceRate = typeof val === 'number' ? val : (val?.rate || 0);
          break;
        case 'top_pages':
          if (Array.isArray(val)) {
            topPages.push(...val);
          }
          break;
        case 'daily_stats':
          if (val?.date && val?.views !== undefined) {
            chartData.push({
              date: val.date,
              views: val.views || 0,
              visitors: val.visitors || 0,
            });
          }
          break;
      }
    }

    // Sort chart data by date
    chartData.sort((a, b) => a.date.localeCompare(b.date));

    return { pageViews, uniqueVisitors, bounceRate, topPages, chartData };
  }, [analyticsData]);

  const lastSynced = analyticsData && analyticsData.length > 0
    ? analyticsData.reduce((latest, row) => {
        const synced = new Date(row.synced_at);
        return synced > latest ? synced : latest;
      }, new Date(0))
    : null;

  const hasWebsiteData = analyticsData && analyticsData.length > 0;

  // Parse Zen Planner attendance metrics
  const attendanceMetrics = useMemo(() => {
    if (!zenPlannerData || zenPlannerData.length === 0) {
      return { totalCheckins: 0, activeMembers: 0, topClass: '—', dailyData: [], classSummary: [] };
    }

    let totalCheckins = 0;
    let activeMembers = 0;
    let topClass = '—';
    const dailyMap: Record<string, number> = {};
    const classMap: Record<string, number> = {};

    for (const row of zenPlannerData) {
      const val = row.metric_value as any;
      switch (row.metric_name) {
        case 'daily_checkins':
          if (val?.date && typeof val?.count === 'number') {
            dailyMap[val.date] = (dailyMap[val.date] || 0) + val.count;
            totalCheckins += val.count;
          }
          break;
        case 'total_active_members':
          if (typeof val === 'number') activeMembers = val;
          else if (typeof val?.count === 'number') activeMembers = val.count;
          break;
        case 'attendance_by_class':
          if (Array.isArray(val)) {
            for (const entry of val) {
              if (entry.class && typeof entry.count === 'number') {
                classMap[entry.class] = (classMap[entry.class] || 0) + entry.count;
              }
            }
          }
          break;
      }
    }

    const dailyData = Object.entries(dailyMap)
      .map(([date, checkins]) => ({ date, checkins }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const classSummary = Object.entries(classMap)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);

    if (classSummary.length > 0) topClass = classSummary[0].className;

    return { totalCheckins, activeMembers, topClass, dailyData, classSummary };
  }, [zenPlannerData]);

  // Determine default tab
  const defaultTab = voiceEnabled ? 'voice' : 'website';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Performance metrics and insights</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          {voiceEnabled && <TabsTrigger value="voice">Voice Agent</TabsTrigger>}
          <TabsTrigger value="website">Website</TabsTrigger>
          {zenPlannerEnabled && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
        </TabsList>

        {/* Voice Agent Tab */}
        {voiceEnabled && (
          <TabsContent value="voice" className="space-y-6">
            {/* Voice Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clientStatsLoading ? (
                <>
                  <Skeleton className="h-[120px] rounded-xl" />
                  <Skeleton className="h-[120px] rounded-xl" />
                  <Skeleton className="h-[120px] rounded-xl" />
                </>
              ) : (
                <>
                  <StatCard
                    title="Total Calls"
                    value={clientStats?.totalCalls || 0}
                    icon={Phone}
                  />
                  <StatCard
                    title="Avg Duration"
                    value={formatDuration(clientStats?.avgDuration || 0)}
                    icon={Clock}
                  />
                  <StatCard
                    title="Missed Calls"
                    value={clientStats?.missedCalls || 0}
                    icon={PhoneOff}
                    variant={clientStats?.missedCalls && clientStats.missedCalls > 0 ? 'warning' : 'default'}
                  />
                </>
              )}
            </div>

            {/* Monthly Bar Chart */}
            {monthlyStatsLoading ? (
              <Skeleton className="h-[340px] rounded-xl" />
            ) : monthlyStats && monthlyStats.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Monthly Call Volume
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
            ) : (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No call data available yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Website Tab */}
        <TabsContent value="website" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {/* Date range toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {DATE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setDateRange(range.value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      dateRange === range.value
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pod?.owner_id && syncAnalytics.mutate(pod.owner_id)}
                disabled={syncAnalytics.isPending}
              >
                {syncAnalytics.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {lastSynced && (
            <p className="text-xs text-muted-foreground">
              Last synced: {format(lastSynced, 'MMM d, yyyy h:mm a')}
            </p>
          )}

          {!hasWebsiteData ? (
            <Card className="py-16">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Analytics are being set up for your account</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Contact support if you have questions about when your analytics will be available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Page Views"
                  value={metrics.pageViews.toLocaleString()}
                  icon={Eye}
                />
                <StatCard
                  title="Unique Visitors"
                  value={metrics.uniqueVisitors.toLocaleString()}
                  icon={Users}
                />
                <StatCard
                  title="Bounce Rate"
                  value={`${metrics.bounceRate}%`}
                  icon={TrendingDown}
                />
              </div>

              {/* Traffic chart */}
              {metrics.chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Traffic Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={metrics.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="views"
                          stroke="hsl(var(--accent))"
                          strokeWidth={2}
                          name="Page Views"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="visitors"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={2}
                          name="Visitors"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Top pages table */}
              {metrics.topPages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Pages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.topPages.slice(0, 10).map((page, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <span className="text-sm font-medium truncate max-w-[70%]">{page.page}</span>
                          <span className="text-sm text-muted-foreground">{page.views.toLocaleString()} views</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Attendance Tab */}
        {zenPlannerEnabled && (
          <TabsContent value="attendance" className="space-y-6">
            {/* Date range toggle */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {DATE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setDateRange(range.value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      dateRange === range.value
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {zenPlannerLoading ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-[120px] rounded-xl" />
                  <Skeleton className="h-[120px] rounded-xl" />
                  <Skeleton className="h-[120px] rounded-xl" />
                </div>
                <Skeleton className="h-[340px] rounded-xl" />
              </>
            ) : zenPlannerData && zenPlannerData.length > 0 ? (
              <>
                {/* Stat cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard
                    title="Total Check-ins"
                    value={attendanceMetrics.totalCheckins.toLocaleString()}
                    icon={CalendarCheck}
                  />
                  <StatCard
                    title="Active Members"
                    value={attendanceMetrics.activeMembers.toLocaleString()}
                    icon={UserCheck}
                  />
                  <StatCard
                    title="Top Class"
                    value={attendanceMetrics.topClass}
                    icon={Trophy}
                  />
                </div>

                {/* Daily attendance bar chart */}
                {attendanceMetrics.dailyData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-accent" />
                        Daily Attendance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={attendanceMetrics.dailyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="checkins" name="Check-ins" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Attendance by class */}
                {attendanceMetrics.classSummary.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Attendance by Class</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {attendanceMetrics.classSummary.slice(0, 10).map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium truncate max-w-[70%]">{item.className}</span>
                            <span className="text-sm text-muted-foreground">{item.count.toLocaleString()} check-ins</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="py-16">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No attendance data yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Attendance data will appear here once the Zen Planner sync has run.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
