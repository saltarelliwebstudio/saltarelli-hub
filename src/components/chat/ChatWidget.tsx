import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  userId: string;
  podId?: string;
  className?: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm the Saltarelli Web Studio support assistant. Ask me anything about your dashboard, voice agents, automations, or website.",
};

const COOLDOWN_MS = 2000;

export function ChatWidget({ userId, podId, className }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const now = Date.now();
    if (now - lastSentAt < COOLDOWN_MS) return;
    setLastSentAt(now);

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Skip welcome message for API context
      const messagesToSend = updatedMessages[0] === WELCOME_MESSAGE
        ? updatedMessages.slice(1)
        : updatedMessages;

      const { data, error } = await supabase.functions.invoke('chat-support', {
        body: {
          messages: messagesToSend,
          user_id: userId,
          pod_id: podId,
        },
      });

      if (error) {
        console.error('Function invoke error:', error);
      }

      const responseText = data?.response || "I'm having trouble right now. Please try again, or contact Adam at saltarelliwebstudio@gmail.com.";

      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment, or reach out to Adam directly at saltarelliwebstudio@gmail.com.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
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
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
        </div>
        <div>
          <p className="font-semibold text-sm">SWS Support Assistant</p>
          <p className="text-xs text-muted-foreground">Powered by AI &middot; Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ minHeight: '350px', maxHeight: '55vh' }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2.5',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="rounded-full bg-accent/15 h-7 w-7 flex items-center justify-center ring-1 ring-accent/20">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
              </div>
            )}
            <div
              className={cn(
                'rounded-2xl px-4 py-2.5 max-w-[78%] text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'gradient-orange text-white rounded-br-md'
                  : 'bg-muted/70 border border-border/50 rounded-bl-md'
              )}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="rounded-full bg-accent/10 h-7 w-7 flex items-center justify-center ring-1 ring-border">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex-shrink-0 mt-0.5">
              <div className="rounded-full bg-accent/15 h-7 w-7 flex items-center justify-center ring-1 ring-accent/20">
                <Bot className="h-3.5 w-3.5 text-accent" />
              </div>
            </div>
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted/70 border border-border/50">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
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
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="gradient-orange text-white shadow-glow-orange rounded-full h-10 w-10 p-0 flex-shrink-0"
            size="icon"
          >
            {isLoading ? (
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
