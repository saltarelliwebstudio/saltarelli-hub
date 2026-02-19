import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useMyPod, useStrikingProgress, useStrikingAttendanceLog, PodWithSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Flame, Target, Swords, CalendarCheck, TrendingUp } from 'lucide-react';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

const TIER_CONFIG = {
  basics: {
    label: 'Basics',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: Target,
    gradient: 'from-blue-600 to-blue-400',
    nextTier: 'Advanced Striking',
    classesNeeded: 20,
  },
  advanced: {
    label: 'Advanced Striking',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: Swords,
    gradient: 'from-orange-600 to-amber-400',
    nextTier: 'Sparring Eligible',
    classesNeeded: 30,
  },
  sparring: {
    label: 'Sparring Eligible',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: Trophy,
    gradient: 'from-red-600 to-rose-400',
    nextTier: null,
    classesNeeded: null,
  },
};

export default function Attendance() {
  const { userWithRole } = useAuth();
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;
  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;

  const userId = pod?.owner_id || userWithRole?.id;
  const { data: progress, isLoading: progressLoading } = useStrikingProgress(pod?.id, userId);
  const { data: attendanceLog, isLoading: logLoading } = useStrikingAttendanceLog(pod?.id, userId);

  const isLoading = podLoading || progressLoading || logLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  // No progress record yet
  if (!progress) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground">Your striking progression journey</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-gradient-to-br from-blue-600 to-blue-400 p-5 mb-6 shadow-lg shadow-blue-500/20">
                <Target className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Welcome to Striking!</h3>
              <p className="text-muted-foreground max-w-md text-base">
                Your progression tracking starts once your coach marks your first class.
                Keep showing up — every class counts toward your next tier!
              </p>
              <div className="flex gap-6 mt-8">
                {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex flex-col items-center gap-2">
                    <div className={`rounded-full p-3 bg-gradient-to-br ${cfg.gradient} shadow-md`}>
                      <cfg.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = (progress.current_tier as keyof typeof TIER_CONFIG) || 'basics';
  const tierCfg = TIER_CONFIG[tier];
  const TierIcon = tierCfg.icon;
  const classesAttended = progress.striking_classes_attended || 0;
  const currentStreak = progress.current_streak || 0;
  const longestStreak = progress.longest_streak || 0;

  // Progress to next tier
  let progressPercent = 100;
  let progressLabel = 'Max tier reached!';
  if (tierCfg.classesNeeded) {
    progressPercent = Math.min((classesAttended / tierCfg.classesNeeded) * 100, 100);
    progressLabel = `${classesAttended} / ${tierCfg.classesNeeded} classes to ${tierCfg.nextTier}`;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          {pod?.name ? `${pod.name} — Striking progression` : 'Your striking progression'}
        </p>
      </div>

      {/* Tier Hero Card */}
      <Card className="overflow-hidden border-0">
        <div className={`bg-gradient-to-r ${tierCfg.gradient} p-6 sm:p-8`}>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-white/20 backdrop-blur-sm p-4 shadow-lg">
              <TierIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Current Tier</p>
              <h2 className="text-3xl font-bold text-white">{tierCfg.label}</h2>
              {progress.tier_override && (
                <Badge variant="outline" className="mt-1 border-white/30 text-white/80 text-xs">
                  Coach Override
                </Badge>
              )}
            </div>
          </div>
          {tierCfg.classesNeeded && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-white/80 mb-2">
                <span>{progressLabel}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-accent/10 p-3">
                <CalendarCheck className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classesAttended}</p>
                <p className="text-sm text-muted-foreground">Classes Attended</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-orange-500/10 p-3">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentStreak} <span className="text-base font-normal text-muted-foreground">wk</span></p>
                <p className="text-sm text-muted-foreground">Current Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-500/10 p-3">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{longestStreak} <span className="text-base font-normal text-muted-foreground">wk</span></p>
                <p className="text-sm text-muted-foreground">Longest Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {(!attendanceLog || attendanceLog.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No attendance records yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {attendanceLog.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-accent/10 p-2">
                      <CalendarCheck className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.class_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.attended_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
