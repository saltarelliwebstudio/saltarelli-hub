import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { useMyPod, PodWithSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

interface ScheduleRow {
  id: string;
  class_name: string;
  day_of_week: number; // 0=Sun
  start_time: string;
  end_time: string;
  instructor: string | null;
  is_new: boolean;
}

interface ClassSession {
  name: string;
  time: string;
  instructor?: string;
  isNew?: boolean;
}

interface DaySchedule {
  day: string;
  shortDay: string;
  dayNum: number;
  classes: ClassSession[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr}:00 ${ampm}` : `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function buildSchedule(rows: ScheduleRow[]): DaySchedule[] {
  // Build Mon-Sun (reorder: 1,2,3,4,5,6,0)
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dayNum) => {
    const dayRows = rows
      .filter((r) => r.day_of_week === dayNum)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return {
      day: DAY_NAMES[dayNum],
      shortDay: SHORT_DAYS[dayNum],
      dayNum,
      classes: dayRows.map((r) => ({
        name: r.class_name,
        time: `${formatTime(r.start_time)} - ${formatTime(r.end_time)}`,
        instructor: r.instructor || undefined,
        isNew: r.is_new,
      })),
    };
  });
}

function getTodayIndex(schedule: DaySchedule[]): number {
  const today = new Date().getDay(); // 0=Sun
  return schedule.findIndex((d) => d.dayNum === today);
}

// Hardcoded fallback for Genius Fitness (used when no DB rows exist yet)
const FALLBACK_SCHEDULE: DaySchedule[] = [
  { day: 'Monday', shortDay: 'MON', dayNum: 1, classes: [
    { name: 'Circuit', time: '6:00 - 6:45 PM' },
    { name: 'Adv No-Gi Jiu-Jitsu', time: '7:00 - 8:30 PM' },
    { name: 'No-Gi Jiu-Jitsu Basics', time: '6:15 - 7:00 PM' },
  ]},
  { day: 'Tuesday', shortDay: 'TUE', dayNum: 2, classes: [
    { name: 'Champs Jiu-Jitsu', time: '5:00 - 5:30 PM' },
    { name: 'Kids Jiu-Jitsu', time: '5:30 - 6:15 PM' },
    { name: 'Striking Basics', time: '6:15 - 7:00 PM' },
    { name: 'Adv Striking', time: '7:00 - 8:30 PM' },
  ]},
  { day: 'Wednesday', shortDay: 'WED', dayNum: 3, classes: [
    { name: 'Circuit', time: '6:00 - 6:45 PM' },
    { name: 'Striking Basics', time: '6:15 - 7:00 PM', isNew: true },
    { name: 'Adv No-Gi Jiu-Jitsu', time: '7:00 - 8:30 PM' },
    { name: 'No-Gi Jiu-Jitsu Basics', time: '6:15 - 7:00 PM' },
  ]},
  { day: 'Thursday', shortDay: 'THU', dayNum: 4, classes: [
    { name: 'Champs Striking', time: '5:00 - 5:30 PM' },
    { name: 'Kids Striking', time: '5:30 - 6:15 PM' },
    { name: 'Striking Basics', time: '6:15 - 7:00 PM' },
    { name: 'Adv Striking', time: '7:00 - 8:00 PM' },
  ]},
  { day: 'Friday', shortDay: 'FRI', dayNum: 5, classes: [
    { name: 'Kids Competition Team', time: '6:00 - 7:00 PM' },
    { name: 'MMA (Invite Only)', time: '7:00 - 8:00 PM' },
  ]},
  { day: 'Saturday', shortDay: 'SAT', dayNum: 6, classes: [
    { name: 'Champs / Kids Jiu-Jitsu', time: '10:00 - 10:45 AM' },
    { name: 'Champs / Kids Striking', time: '10:45 - 11:15 AM' },
    { name: 'All Levels Striking', time: '11:30 AM - 12:30 PM' },
    { name: 'Sparring', time: '12:30 - 1:00 PM' },
  ]},
  { day: 'Sunday', shortDay: 'SUN', dayNum: 0, classes: [
    { name: 'Open Mat', time: '11:00 AM - 12:00 PM' },
  ]},
];

export default function Schedule() {
  const { userWithRole } = useAuth();
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;
  const { data: myPod } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;

  const { data: scheduleRows, isLoading } = useQuery({
    queryKey: ['zen-schedule', pod?.id],
    queryFn: async () => {
      if (!pod?.id) return [];
      const { data, error } = await supabase
        .from('zen_planner_schedule' as any)
        .select('*')
        .eq('pod_id', pod.id);
      if (error) throw error;
      return (data || []) as unknown as ScheduleRow[];
    },
    enabled: !!pod?.id,
  });

  const schedule = scheduleRows && scheduleRows.length > 0
    ? buildSchedule(scheduleRows)
    : FALLBACK_SCHEDULE;

  const todayIndex = getTodayIndex(schedule);
  const usingFallback = !scheduleRows || scheduleRows.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
        <p className="text-muted-foreground">
          {pod?.name ? `${pod.name} — Weekly Schedule` : 'Weekly Schedule'}
        </p>
      </div>

      {/* Mobile: card layout */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {schedule.map((day, i) => (
          <Card key={day.day} className={i === todayIndex ? 'ring-2 ring-accent' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-accent" />
                {day.day}
                {i === todayIndex && (
                  <Badge variant="default" className="ml-auto text-xs">Today</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {day.classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes</p>
              ) : (
                day.classes.map((cls, j) => (
                  <div key={j} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {cls.name}
                        {cls.isNew && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">NEW</Badge>
                        )}
                      </p>
                      {cls.instructor && (
                        <p className="text-xs text-muted-foreground">{cls.instructor}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {cls.time}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table layout */}
      <Card className="hidden lg:block overflow-x-auto">
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {schedule.map((day, i) => (
              <div
                key={day.shortDay}
                className={`p-3 text-center font-bold text-sm ${
                  i === todayIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {day.shortDay}
                {i === todayIndex && <span className="block text-[10px] font-normal">Today</span>}
              </div>
            ))}
            {schedule.map((day, i) => (
              <div
                key={`classes-${day.day}`}
                className={`p-2 space-y-1.5 min-h-[200px] ${i === todayIndex ? 'bg-accent/5' : 'bg-card'}`}
              >
                {day.classes.map((cls, j) => (
                  <div key={j} className="p-2 rounded-md bg-muted/60 hover:bg-muted transition-colors">
                    <p className="text-xs font-semibold leading-tight flex items-center gap-1">
                      {cls.name}
                      {cls.isNew && (
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 leading-tight">NEW</Badge>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{cls.time}</p>
                    {cls.instructor && (
                      <p className="text-[10px] text-muted-foreground">{cls.instructor}</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {usingFallback && (
        <p className="text-xs text-muted-foreground text-center">
          Showing saved schedule. Live sync from Zen Planner will update automatically.
        </p>
      )}
    </div>
  );
}
