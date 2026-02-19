import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPod, PodWithSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarCheck } from 'lucide-react';

interface ViewAsClientContext {
  pod: PodWithSettings;
  isViewAsClient: boolean;
}

export default function Attendance() {
  const { userWithRole } = useAuth();
  const context = useOutletContext<ViewAsClientContext | null>();
  const isViewAsClient = context?.isViewAsClient;
  const viewAsPod = context?.pod;

  const { data: myPod, isLoading: podLoading } = useMyPod();
  const pod = isViewAsClient ? viewAsPod : myPod;

  if (podLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  // Zen Planner embed URL — uses the studio login page where members can check in
  // This can be customized per client if needed via pod_settings
  const zenPlannerUrl = 'https://studio.zenplanner.com/zenplanner/portal/member-profile.cfm';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">View your gym attendance and check-in history</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-lg overflow-hidden border border-border">
            <iframe
              src={zenPlannerUrl}
              title="Zen Planner Attendance"
              className="w-full border-0"
              style={{ minHeight: '700px', height: '80vh' }}
              allow="fullscreen"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Powered by Zen Planner. Log in with your member credentials to view your attendance history.
          </p>
        </CardContent>
      </Card>

      {/* Fallback if embed doesn't work */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-accent/10 p-3 h-fit">
              <CalendarCheck className="h-5 w-5 text-accent" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">Can't see the attendance tracker?</h4>
              <p className="text-sm text-muted-foreground">
                If the embedded view isn't loading, you can access your attendance directly at{' '}
                <a
                  href="https://studio.zenplanner.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  studio.zenplanner.com
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
