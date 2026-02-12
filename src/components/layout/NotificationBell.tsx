import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnreadMessageCount, useUnreadMessageSubscription } from '@/hooks/useSupabaseData';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { data: unreadCount = 0 } = useUnreadMessageCount();
  const navigate = useNavigate();

  // Subscribe to realtime updates
  useUnreadMessageSubscription();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      onClick={() => navigate('/admin/messages')}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
