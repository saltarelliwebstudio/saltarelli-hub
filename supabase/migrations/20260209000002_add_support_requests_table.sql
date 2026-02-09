-- ============================================
-- Support Request Status Enum
-- ============================================
CREATE TYPE public.support_status AS ENUM ('open', 'in_progress', 'resolved');

-- ============================================
-- Support Requests Table
-- ============================================
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status support_status NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all support requests" ON public.support_requests
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can create support requests for their pod" ON public.support_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.can_access_pod(auth.uid(), pod_id));

CREATE POLICY "Users can read their own support requests" ON public.support_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_support_requests_pod_id ON public.support_requests(pod_id);
CREATE INDEX idx_support_requests_status ON public.support_requests(status);

-- Updated at trigger
CREATE TRIGGER update_support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
