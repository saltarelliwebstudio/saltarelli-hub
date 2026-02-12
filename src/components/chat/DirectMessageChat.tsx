import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useDirectMessages,
  useSendDirectMessage,
  useMarkMessagesAsRead,
  useDirectMessageSubscription,
} from '@/hooks/useSupabaseData';
import { format } from 'date-fns';

interface DirectMessageChatProps {
  currentUserId: string;
  otherUserId: string;
  podId: string;
  otherUserName?: string;
  className?: string;
}

export function DirectMessageChat({
  currentUserId,
  otherUserId,
  podId,
  otherUserName = 'Adam',
  className,
}: DirectMessageChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useDirectMessages(podId, otherUserId);
  const sendMessage = useSendDirectMessage();
  const markAsRead = useMarkMessagesAsRead();

  // Realtime subscription
  useDirectMessageSubscription(podId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when conversation is visible
  useEffect(() => {
    if (messages.length > 0 && otherUserId) {
      const hasUnread = messages.some(m => m.sender_id === otherUserId && !m.read);
      if (hasUnread) {
        markAsRead.mutate({ podId, senderId: otherUserId });
      }
    }
  }, [messages, otherUserId, podId]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    setInput('');
    try {
      await sendMessage.mutateAsync({
        recipient_id: otherUserId,
        pod_id: podId,
        content: trimmed,
      });
    } catch {
      setInput(trimmed);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="relative">
          <div className="rounded-full bg-accent/20 h-10 w-10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
        </div>
        <div>
          <p className="font-semibold text-sm">Chat with {otherUserName}</p>
          <p className="text-xs text-muted-foreground">Direct message</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: '300px', maxHeight: '45vh' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet. Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn('flex gap-2.5', isOwn ? 'justify-end' : 'justify-start')}
              >
                {!isOwn && (
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="rounded-full bg-accent/15 h-7 w-7 flex items-center justify-center ring-1 ring-accent/20">
                      <User className="h-3.5 w-3.5 text-accent" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[78%]">
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      isOwn
                        ? 'gradient-orange text-white rounded-br-md'
                        : 'bg-muted/70 border border-border/50 rounded-bl-md'
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className={cn('text-[10px] text-muted-foreground', isOwn && 'text-right')}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </span>
                </div>
                {isOwn && (
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="rounded-full bg-accent/10 h-7 w-7 flex items-center justify-center ring-1 ring-border">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border bg-muted/20">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sendMessage.isPending}
            className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={sendMessage.isPending || !input.trim()}
            className="gradient-orange text-white shadow-glow-orange rounded-full h-10 w-10 p-0 flex-shrink-0"
            size="icon"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
