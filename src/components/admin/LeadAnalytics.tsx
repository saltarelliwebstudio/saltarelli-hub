import { TrendingUp, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminLead } from '@/hooks/useSupabaseData';

interface LeadAnalyticsProps {
  leads: AdminLead[];
}

export function LeadAnalytics({ leads }: LeadAnalyticsProps) {
  const clientCount = leads.filter(l => l.status === 'client').length;
  const total = leads.length;
  const conversionRate = total > 0 ? ((clientCount / total) * 100).toFixed(1) : 'N/A';

  const closedLeads = leads.filter(l => l.status === 'client' && l.closed_at);
  let avgDays: string;
  if (closedLeads.length === 0) {
    avgDays = 'N/A';
  } else {
    const totalDays = closedLeads.reduce((sum, l) => {
      return sum + differenceInDays(new Date(l.closed_at!), new Date(l.created_at));
    }, 0);
    avgDays = `${Math.round(totalDays / closedLeads.length)}d`;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Conversion Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {conversionRate === 'N/A' ? conversionRate : `${conversionRate}%`}
          </div>
          <p className="text-xs text-muted-foreground">
            {clientCount} converted / {total} total
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Avg Time to Close
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgDays}</div>
          <p className="text-xs text-muted-foreground">
            Based on {closedLeads.length} converted lead{closedLeads.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
