/**
 * Database helper module
 * All Supabase read/write operations for the SMS drip system.
 */

import { createClient } from '@supabase/supabase-js';

let _supabase = null;

export function getSupabase(url, key) {
  if (!_supabase) {
    _supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

/**
 * Fetch a single lead by ID.
 */
export async function getLead(supabase, leadId) {
  const { data, error } = await supabase
    .from('admin_leads')
    .select('*')
    .eq('id', leadId)
    .single();
  if (error) throw new Error(`getLead(${leadId}): ${error.message}`);
  return data;
}

/**
 * Check whether a specific day has already been sent to a lead.
 * Returns true if a 'sent' or 'delivered' log entry exists.
 */
export async function isDaySent(supabase, leadId, dayNumber) {
  const { data, error } = await supabase
    .from('sms_drip_log')
    .select('id')
    .eq('lead_id', leadId)
    .eq('day_number', dayNumber)
    .in('status', ['sent', 'delivered'])
    .limit(1);
  if (error) throw new Error(`isDaySent: ${error.message}`);
  return data && data.length > 0;
}

/**
 * Log an SMS send attempt to sms_drip_log.
 */
export async function logSmsSend(supabase, { leadId, dayNumber, messageContent, status, openphoneResponse, errorMessage }) {
  const { error } = await supabase
    .from('sms_drip_log')
    .insert({
      lead_id: leadId,
      day_number: dayNumber,
      message_content: messageContent,
      status,
      openphone_response: openphoneResponse || null,
      error_message: errorMessage || null,
      sent_at: new Date().toISOString(),
    });
  if (error) throw new Error(`logSmsSend: ${error.message}`);
}

/**
 * Update the lead's SMS sequence tracking columns.
 */
export async function updateLeadSmsStatus(supabase, leadId, { smsSequenceStatus, smsSequenceDay, smsNextSendDate }) {
  const updates = {};
  if (smsSequenceStatus !== undefined) updates.sms_sequence_status = smsSequenceStatus;
  if (smsSequenceDay !== undefined) updates.sms_sequence_day = smsSequenceDay;
  if (smsNextSendDate !== undefined) updates.sms_next_send_date = smsNextSendDate;

  const { error } = await supabase
    .from('admin_leads')
    .update(updates)
    .eq('id', leadId);
  if (error) throw new Error(`updateLeadSmsStatus: ${error.message}`);
}

/**
 * Fetch all leads that are due for their next SMS send.
 * Returns leads where:
 *   - sms_sequence_status = 'active'
 *   - sms_next_send_date <= now
 *   - status != 'do_not_contact'
 *   - sms_opt_out = false
 */
export async function getDueLeads(supabase) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('admin_leads')
    .select('*')
    .eq('sms_sequence_status', 'active')
    .lte('sms_next_send_date', now)
    .neq('status', 'do_not_contact')
    .or('sms_opt_out.eq.false,sms_opt_out.is.null');
  if (error) throw new Error(`getDueLeads: ${error.message}`);
  return data || [];
}

/**
 * Mark a lead's SMS sequence as completed.
 */
export async function markSequenceCompleted(supabase, leadId) {
  await updateLeadSmsStatus(supabase, leadId, {
    smsSequenceStatus: 'completed',
    smsNextSendDate: null,
  });
}
