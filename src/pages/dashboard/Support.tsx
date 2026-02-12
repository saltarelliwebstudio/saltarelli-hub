import { Clock, CheckCircle, Loader2, MessageSquare, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPod, useSupportRequests, useAdminUserId } from '@/hooks/useSupabaseData';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { DirectMessageChat } from '@/components/chat/DirectMessageChat';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: <Loader2 className="h-3 w-3" /> },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: <CheckCircle className="h-3 w-3" /> },
};

export default function Support() {
  const { userWithRole } = useAuth();
  const { data: pod, isLoading: podLoading } = useMyPod();
  const { data: requests, isLoading: requestsLoading } = useSupportRequests(pod?.id);
  const { data: adminUserId } = useAdminUserId();

  const isLoading = podLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">Chat with our AI assistant or reach out directly</p>
      </div>

      {/* AI Chat Widget */}
      {userWithRole && (
        <ChatWidget
          userId={userWithRole.id}
          podId={pod?.id}
          className="min-h-[500px]"
        />
      )}

      {/* Direct Message Chat with Adam */}
      {userWithRole && pod?.id && adminUserId && (
        <DirectMessageChat
          currentUserId={userWithRole.id}
          otherUserId={adminUserId}
          podId={pod.id}
          otherUserName="Adam"
          className="min-h-[400px]"
        />
      )}

      {/* Direct Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Need to talk to a human?</CardTitle>
          <CardDescription>
            If the AI assistant can't help, reach out to Adam directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href="mailto:saltarelliwebstudio@gmail.com" className="text-sm text-accent hover:underline">
                saltarelliwebstudio@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href="tel:+12899314142" className="text-sm text-accent hover:underline">
                289-931-4142
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Requests */}
      {requests && requests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-accent" />
              <CardTitle>Your Requests</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.map((req: any) => {
              const status = STATUS_STYLES[req.status] || STATUS_STYLES.open;

              return (
                <div key={req.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{req.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(req.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <Badge variant="outline" className={status.color}>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{req.message}</p>
                  {req.admin_reply && (
                    <div className="mt-3 p-3 rounded bg-accent/5 border border-accent/10">
                      <p className="text-xs font-medium text-accent mb-1">Reply from Saltarelli Web Studio</p>
                      <p className="text-sm">{req.admin_reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
