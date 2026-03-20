-- Website analytics: event tracking (clicks, conversions, scroll, engagement)
CREATE TABLE IF NOT EXISTS public.site_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL, -- 'audit_start', 'audit_complete', 'calendly_click', 'scroll_section', 'heartbeat'
  path TEXT,
  metadata JSONB, -- flexible: { section: 'audit', score: 7, scroll_pct: 75, seconds: 30 }
  session_id TEXT,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_events_created_at ON public.site_events(created_at DESC);
CREATE INDEX idx_site_events_event ON public.site_events(event);
CREATE INDEX idx_site_events_session ON public.site_events(session_id);

ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert site events"
  ON public.site_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read site events"
  ON public.site_events FOR SELECT
  USING (public.is_admin());
