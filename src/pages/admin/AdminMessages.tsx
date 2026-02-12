import { useState } from 'react';
import { ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DirectMessageChat } from '@/components/chat/DirectMessageChat';
import { useAdminConversations } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function AdminMessages() {
  const { userWithRole } = useAuth();
  const { data: conversations, isLoading } = useAdminConversations();
  const [selectedConversation, setSelectedConversation] = useState<{
    podId: string;
    otherUserId: string;
    podName: string;
  } | null>(null);

  if (selectedConversation && userWithRole) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{selectedConversation.podName}</h1>
            <p className="text-sm text-muted-foreground">Direct message conversation</p>
          </div>
        </div>

        <DirectMessageChat
          currentUserId={userWithRole.id}
          otherUserId={selectedConversation.otherUserId}
          podId={selectedConversation.podId}
          otherUserName={selectedConversation.podName}
          className="min-h-[500px]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Direct messages from clients</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground/60">Messages from clients will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.podId}
              onClick={() => setSelectedConversation({
                podId: conv.podId,
                otherUserId: conv.otherUserId,
                podName: conv.podName,
              })}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-accent/30 hover:bg-muted/30 transition-all text-left"
            >
              <div className="rounded-full bg-accent/15 h-10 w-10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{conv.podName}</p>
                  {conv.unreadCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {format(new Date(conv.lastMessageAt), 'MMM d, h:mm a')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
