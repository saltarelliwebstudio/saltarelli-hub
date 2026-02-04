import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Zap, CreditCard, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: 'call' | 'automation' | 'payment' | 'error';
  title: string;
  description?: string;
  status?: 'success' | 'failed' | 'pending';
  timestamp: Date;
  podName?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
  showPodName?: boolean;
}

const typeIcons = {
  call: Phone,
  automation: Zap,
  payment: CreditCard,
  error: AlertCircle,
};

const statusColors = {
  success: 'text-success',
  failed: 'text-destructive',
  pending: 'text-warning',
};

export function ActivityFeed({ items, className, showPodName = false }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {items.map((item) => {
        const Icon = typeIcons[item.type];
        const StatusIcon = item.status === 'success' ? CheckCircle : item.status === 'failed' ? XCircle : null;
        
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              <div className="rounded-full bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {StatusIcon && (
                  <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusColors[item.status!])} />
                )}
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </span>
                {showPodName && item.podName && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{item.podName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
