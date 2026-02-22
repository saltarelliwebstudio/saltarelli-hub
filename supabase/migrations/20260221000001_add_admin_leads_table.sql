CREATE TYPE public.admin_lead_status AS ENUM (
  'cold', 'warm', 'hot', 'followed_up', 'closed', 'client'
);

CREATE TABLE public.admin_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  service_interest TEXT,
  status admin_lead_status NOT NULL DEFAULT 'cold',
  notes TEXT,
  last_contacted_date DATE,
  next_followup_date DATE,
  followup_date DATE,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin leads"
  ON public.admin_leads FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_admin_leads_status ON public.admin_leads(status);
CREATE INDEX idx_admin_leads_next_followup ON public.admin_leads(next_followup_date);
CREATE INDEX idx_admin_leads_date_added ON public.admin_leads(date_added);
