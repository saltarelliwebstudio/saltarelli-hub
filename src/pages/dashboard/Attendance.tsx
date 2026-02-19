import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMyPod, PodWithSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarCheck, Users, TrendingUp, Clock } from 'lucide-react';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

interface AttendanceRow {
  id: string;
  member_name: string;
  class_name: string;
  check_in_at: string;
}

export default function Attendance() {
  const { userWithRole } = useAuth();
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;
  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['zen-attendance', pod?.id],
    queryFn: async () => {
      if (!pod?.id) return [];
      const { data, error } = await supabase
        .from('zen_planner_attendance' as any)
        .select('*')
        .eq('pod_id', pod.id)
        .order('check_in_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as AttendanceRow[];
    },
    enabled: !!pod?.id,
  });

  const isLoading = podLoading || attendanceLoading;

  // Compute stats
  const totalCheckins = attendance?.length || 0;
  const uniqueMembers = new Set(attendance?.map((a) => a.member_name) || []).size;

  // Group by date for recent activity
  const byDate: Record<string, AttendanceRow[]> = {};
  (attendance || []).forEach((a) => {
    const date = new Date(a.check_in_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(a);
  });

  // Top classes
  const classCounts: Record<string, number> = {};
  (attendance || []).forEach((a) => {
    classCounts[a.class_name] = (classCounts[a.class_name] || 0) + 1;
  });
  const topClasses = Object.entries(classCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const hasData = totalCheckins > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          {pod?.name ? `${pod.name} — Check-in history` : 'Check-in history'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-accent/10 p-3">
                <CalendarCheck className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCheckins}</p>
                <p className="text-sm text-muted-foreground">Total Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-accent/10 p-3">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueMembers}</p>
                <p className="text-sm text-muted-foreground">Unique Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-accent/10 p-3">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{topClasses[0]?.[0] || '—'}</p>
                <p className="text-sm text-muted-foreground">Most Popular Class</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CalendarCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No attendance data yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Attendance data syncs automatically from Zen Planner throughout the day.
                Check back soon!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top classes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Classes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topClasses.map(([cls, count], i) => (
                <div key={cls} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs w-6 justify-center">
                      {i + 1}
                    </Badge>
                    <span className="text-sm font-medium">{cls}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent check-ins */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {Object.entries(byDate).slice(0, 10).map(([date, records]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold">{date}</h4>
                      <Badge variant="secondary" className="text-xs">{records.length}</Badge>
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-border">
                      {records.slice(0, 10).map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-1">
                          <span className="text-sm">{r.member_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{r.class_name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(r.check_in_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                      {records.length > 10 && (
                        <p className="text-xs text-muted-foreground py-1">
                          +{records.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
