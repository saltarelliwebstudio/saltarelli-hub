/**
 * Daily status report builder
 * Gathers stats from Supabase and formats a Telegram-friendly message.
 */

/**
 * Build a daily status message string.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string>} Formatted status message
 */
export async function buildDailyStatus(supabase) {
  // ── Sequence counts ───────────────────────────────────────────────────
  const { count: activeCount } = await supabase
    .from('admin_leads')
    .select('id', { count: 'exact', head: true })
    .eq('sms_sequence_status', 'active');

  const { count: completedCount } = await supabase
    .from('admin_leads')
    .select('id', { count: 'exact', head: true })
    .eq('sms_sequence_status', 'completed');

  const { count: pausedCount } = await supabase
    .from('admin_leads')
    .select('id', { count: 'exact', head: true })
    .in('sms_sequence_status', ['paused', 'opted_out']);

  // ── Last 24 hours of messages ─────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: sentCount } = await supabase
    .from('sms_drip_log')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', since)
    .in('status', ['sent', 'delivered']);

  const { count: failCount } = await supabase
    .from('sms_drip_log')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', since)
    .eq('status', 'failed');

  // ── Uptime ────────────────────────────────────────────────────────────
  const uptimeSec = process.uptime();
  const days  = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const mins  = Math.floor((uptimeSec % 3600) / 60);
  const uptimeStr = `${days}d ${hours}h ${mins}m`;

  // ── Health indicator ──────────────────────────────────────────────────
  const health = (failCount ?? 0) === 0
    ? '✅ All systems running'
    : `⚠️ ${failCount} failure(s) in last 24h`;

  // ── Format message ────────────────────────────────────────────────────
  return [
    '📊 *Saltarelli SMS Drip — Daily Status*',
    '',
    health,
    '',
    `Active sequences: ${activeCount ?? 0}`,
    `Completed: ${completedCount ?? 0}`,
    `Paused/Opted out: ${pausedCount ?? 0}`,
    '',
    '*Last 24h:*',
    `• Messages sent: ${sentCount ?? 0}`,
    `• Failures: ${failCount ?? 0}`,
    '',
    `Server uptime: ${uptimeStr}`,
  ].join('\n');
}
