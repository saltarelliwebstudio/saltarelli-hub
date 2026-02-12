-- ============================================
-- Add analytics_enabled to pod_settings
-- ============================================
ALTER TABLE public.pod_settings
  ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- Client Analytics Config Table
-- ============================================
CREATE TABLE public.client_analytics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('vercel', 'google_analytics', 'custom', 'manual')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.client_analytics_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all analytics config" ON public.client_analytics_config
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read their own analytics config" ON public.client_analytics_config
  FOR SELECT USING (client_id = auth.uid());

-- Indexes
CREATE INDEX idx_analytics_config_client ON public.client_analytics_config(client_id);

-- Updated at trigger
CREATE TRIGGER update_analytics_config_updated_at
  BEFORE UPDATE ON public.client_analytics_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Client Analytics Data Table (cached metrics)
-- ============================================
CREATE TABLE public.client_analytics_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.client_analytics_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all analytics data" ON public.client_analytics_data
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read their own analytics data" ON public.client_analytics_data
  FOR SELECT USING (client_id = auth.uid());

-- Indexes
CREATE INDEX idx_analytics_data_client ON public.client_analytics_data(client_id, period_start DESC);
CREATE INDEX idx_analytics_data_metric ON public.client_analytics_data(client_id, metric_name, period_start DESC);
