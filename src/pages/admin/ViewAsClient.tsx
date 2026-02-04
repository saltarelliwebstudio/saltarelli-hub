import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { usePod } from '@/hooks/useSupabaseData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// This component wraps the client dashboard when an admin is viewing as a client
export default function ViewAsClient() {
  const { podId } = useParams<{ podId: string }>();
  const navigate = useNavigate();
  const { data: pod, isLoading } = usePod(podId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!pod) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground mb-4">Client not found</p>
        <Button onClick={() => navigate('/admin/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* View As Client Banner */}
      <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <p className="text-sm font-medium text-warning-foreground">
            You are viewing as <strong>{pod.name}</strong>
            {pod.company_name && ` — ${pod.company_name}`}
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/admin/clients/${podId}`)}
            className="border-warning/20 hover:bg-warning/10"
          >
            <X className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </div>
      </div>

      {/* Render the client dashboard with this pod's context */}
      <Outlet context={{ pod, isViewAsClient: true }} />
    </div>
  );
}
