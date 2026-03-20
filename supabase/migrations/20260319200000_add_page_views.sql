-- Website analytics: page view tracking
CREATE TABLE IF NOT EXISTS public.page_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  device TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  country TEXT,
  session_id TEXT, -- hashed daily visitor ID (privacy-friendly)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views(path);
CREATE INDEX idx_page_views_session ON public.page_views(session_id);

-- RLS: allow anonymous inserts (tracking), admin reads
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read page views"
  ON public.page_views FOR SELECT
  USING (public.is_admin(auth.uid()));
