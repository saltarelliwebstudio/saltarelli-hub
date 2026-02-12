-- ============================================
-- Chat Logs Table
-- ============================================
CREATE TABLE public.chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all chat logs" ON public.chat_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read their own chat logs" ON public.chat_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chat logs" ON public.chat_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Service role can always insert (for edge function)
CREATE POLICY "Service role can insert chat logs" ON public.chat_logs
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_chat_logs_user ON public.chat_logs(user_id, created_at DESC);
CREATE INDEX idx_chat_logs_pod ON public.chat_logs(pod_id, created_at DESC);
