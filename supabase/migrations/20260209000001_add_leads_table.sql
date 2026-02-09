-- ============================================
-- Lead Status Enum
-- ============================================
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'closed');

-- ============================================
-- Leads Table
-- ============================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  source TEXT DEFAULT 'voice_agent',
  notes TEXT,
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all leads" ON public.leads
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Pod owners can manage their leads" ON public.leads
  FOR ALL USING (public.is_pod_owner(auth.uid(), pod_id));

CREATE POLICY "Pod members can read leads" ON public.leads
  FOR SELECT USING (public.is_pod_member(auth.uid(), pod_id));

-- Indexes
CREATE INDEX idx_leads_pod_id ON public.leads(pod_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);

-- Updated at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
