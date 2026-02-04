-- Create retell_accounts table for multiple Retell agents per pod
CREATE TABLE public.retell_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Main Agent',
  retell_api_key TEXT NOT NULL,
  retell_agent_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add retell_account_id to call_logs to track which agent handled the call
ALTER TABLE public.call_logs 
ADD COLUMN retell_account_id UUID REFERENCES public.retell_accounts(id) ON DELETE SET NULL;

-- Add summary column to call_logs for Retell call summaries
ALTER TABLE public.call_logs 
ADD COLUMN summary TEXT;

-- Enable RLS on retell_accounts
ALTER TABLE public.retell_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retell_accounts
CREATE POLICY "Admins can manage all retell accounts"
ON public.retell_accounts
FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read accessible retell accounts"
ON public.retell_accounts
FOR SELECT
USING (public.can_access_pod(auth.uid(), pod_id));

-- Create index for faster lookups
CREATE INDEX idx_retell_accounts_pod_id ON public.retell_accounts(pod_id);
CREATE INDEX idx_call_logs_retell_account_id ON public.call_logs(retell_account_id);