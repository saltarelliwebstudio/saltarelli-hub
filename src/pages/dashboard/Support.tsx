import { useState } from 'react';
import { LifeBuoy, Send, Clock, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPod, useSupportRequests, useCreateSupportRequest } from '@/hooks/useSupabaseData';
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
  const createRequest = useCreateSupportRequest();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const isLoading = podLoading || requestsLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pod || !userWithRole) return;

    createRequest.mutate(
      {
        pod_id: pod.id,
        user_id: userWithRole.id,
        subject,
        message,
      },
      {
        onSuccess: () => {
          setSubject('');
          setMessage('');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">Get help or submit a request</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Submit Request Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-accent" />
              <CardTitle>Submit a Request</CardTitle>
            </div>
            <CardDescription>
              Describe what you need help with and we'll get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us more about what you need..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-orange text-white shadow-glow-orange"
                disabled={createRequest.isPending}
              >
                {createRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-accent" />
              <CardTitle>Contact Us</CardTitle>
            </div>
            <CardDescription>Other ways to reach Saltarelli Web Studio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">support@saltarelliwebstudio.com</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Response Time</p>
              <p className="text-sm text-muted-foreground">We typically respond within 24 hours on business days.</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
