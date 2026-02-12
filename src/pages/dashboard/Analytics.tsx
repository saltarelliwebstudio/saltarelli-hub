import { useState, useMemo } from 'react';
import { BarChart3, Eye, Users, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPod, useAnalyticsData, useSyncAnalytics } from '@/hooks/useSupabaseData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';

type DateRangeOption = '7d' | '30d' | '90d';

const DATE_RANGES: { label: string; value: DateRangeOption; days: number }[] = [
  { label: '7 Days', value: '7d', days: 7 },
  { label: '30 Days', value: '30d', days: 30 },
  { label: '90 Days', value: '90d', days: 90 },
];

export default function Analytics() {
  const { userWithRole } = useAuth();
  const { data: pod, isLoading: podLoading } = useMyPod();
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const syncAnalytics = useSyncAnalytics();

  const selectedRange = DATE_RANGES.find((r) => r.value === dateRange)!;
  const startDate = subDays(new Date(), selectedRange.days);
  const endDate = new Date();

  const { data: analyticsData, isLoading: dataLoading } = useAnalyticsData(
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

  const hasData = analyticsData && analyticsData.length > 0;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Website traffic and performance metrics</p>
        </div>
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

      {!hasData ? (
        /* Empty state */
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
    </div>
  );
}
