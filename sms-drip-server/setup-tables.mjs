// Setup script: Creates the sms_drip_log table and adds SMS columns to admin_leads
// Uses supabase-js service role to create tables via REST API workaround

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://veyhxazlqekiweynjxhf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleWh4YXpscWVraXdleW5qeGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwNTYwNSwiZXhwIjoyMDg2MTgxNjA1fQ.JCslH8SIyCp4yZ2DmtZlANB92ReCnuTBEag5zY55FOM';

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

// Alternative: use the Supabase Management API
async function executeSqlViaManagement(sql) {
  const projectRef = 'veyhxazlqekiweynjxhf';
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  console.log(`Status: ${response.status}, Response: ${text.substring(0, 200)}`);
  return response;
}

async function main() {
  console.log('Attempting to create tables via Management API...');
  
  const sql = `
    ALTER TABLE public.admin_leads ADD COLUMN IF NOT EXISTS sms_sequence_status TEXT DEFAULT 'none';
    ALTER TABLE public.admin_leads ADD COLUMN IF NOT EXISTS sms_sequence_day INTEGER DEFAULT 0;
    ALTER TABLE public.admin_leads ADD COLUMN IF NOT EXISTS sms_next_send_date TIMESTAMPTZ;
    ALTER TABLE public.admin_leads ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT false;

    CREATE TABLE IF NOT EXISTS public.sms_drip_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES public.admin_leads(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      message_content TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'sent',
      openphone_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_sms_drip_log_lead_id ON public.sms_drip_log(lead_id);
    CREATE INDEX IF NOT EXISTS idx_sms_drip_log_day ON public.sms_drip_log(day_number);
    CREATE INDEX IF NOT EXISTS idx_admin_leads_sms_status ON public.admin_leads(sms_sequence_status);
    CREATE INDEX IF NOT EXISTS idx_admin_leads_sms_next ON public.admin_leads(sms_next_send_date);
    
    ALTER TABLE public.sms_drip_log ENABLE ROW LEVEL SECURITY;
  `;

  await executeSqlViaManagement(sql);
}

main().catch(console.error);
