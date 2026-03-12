/**
 * Saltarelli Web Studio – SMS Drip Sequence Server
 * ─────────────────────────────────────────────────
 * Listens for new leads inserted into admin_leads via Supabase Realtime,
 * immediately fires Day 0 SMS, and schedules the full 45-day drip sequence.
 *
 * A cron job runs every hour to process any leads whose next scheduled
 * message is due, ensuring reliable delivery even across restarts.
 *
 * Edge cases handled:
 *   • No phone number          → skip silently
 *   • do_not_contact status    → skip / pause
 *   • sms_opt_out flag         → skip / pause
 *   • Already in sequence      → skip (idempotency)
 *   • Day already sent         → skip (idempotency)
 *   • OpenPhone send failure   → log as 'failed', retry in 1 hour
 *   • Server restart           → cron picks up any missed sends on boot
 */

import 'dotenv/config';
import cron from 'node-cron';
import { getSupabase } from './db.js';
import { enrollLead, processDueMessages } from './processor.js';

// ── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY;
const OPENPHONE_KEY    = process.env.OPENPHONE_API_KEY;
const OPENPHONE_FROM   = process.env.OPENPHONE_FROM_NUMBER;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENPHONE_KEY || !OPENPHONE_FROM) {
  console.error('Missing required environment variables. Check your .env file.');
  process.exit(1);
}

const supabase = getSupabase(SUPABASE_URL, SUPABASE_KEY);

// ── Startup banner ─────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Saltarelli Web Studio – SMS Drip Sequence Server        ║');
console.log('║  45-day automated SMS follow-up via OpenPhone            ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`Started at: ${new Date().toISOString()}`);
console.log(`Supabase:   ${SUPABASE_URL}`);
console.log(`OpenPhone:  ${OPENPHONE_FROM}`);
console.log('');

// ── Supabase Realtime – listen for new leads ────────────────────────────────

function startRealtimeListener() {
  console.log('[Realtime] Subscribing to admin_leads INSERT events...');

  const channel = supabase
    .channel('admin_leads_inserts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_leads',
      },
      async (payload) => {
        const lead = payload.new;
        console.log(`\n[Realtime] New lead detected: "${lead.name}" (id: ${lead.id})`);

        try {
          await enrollLead(supabase, lead, OPENPHONE_KEY, OPENPHONE_FROM);
        } catch (err) {
          console.error(`[Realtime] Error enrolling lead ${lead.id}:`, err.message);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✓ Subscribed – listening for new leads');
      } else if (status === 'CLOSED') {
        console.warn('[Realtime] Channel closed – will attempt reconnect...');
        setTimeout(startRealtimeListener, 5000);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error – will attempt reconnect...');
        setTimeout(startRealtimeListener, 10000);
      } else {
        console.log(`[Realtime] Status: ${status}`);
      }
    });

  return channel;
}

// ── Cron job – process due messages every hour ─────────────────────────────

function startCronScheduler() {
  // Run at the top of every hour
  cron.schedule('0 * * * *', async () => {
    console.log(`\n[Cron] Running scheduled check at ${new Date().toISOString()}`);
    try {
      await processDueMessages(supabase, OPENPHONE_KEY, OPENPHONE_FROM);
    } catch (err) {
      console.error('[Cron] Error processing due messages:', err.message);
    }
  });

  console.log('[Cron] ✓ Scheduler started – checks run at the top of every hour');
}

// ── Boot-time catch-up – process any missed messages on startup ─────────────

async function runBootCatchup() {
  console.log('[Boot] Running catch-up check for any missed messages...');
  try {
    await processDueMessages(supabase, OPENPHONE_KEY, OPENPHONE_FROM);
  } catch (err) {
    console.error('[Boot] Catch-up error:', err.message);
  }
}

// ── Health check endpoint (optional, for monitoring) ───────────────────────

import http from 'http';

const PORT = parseInt(process.env.PORT || '3099', 10);

const healthServer = http.createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/') {
    // Quick DB connectivity check
    const { error } = await supabase.from('admin_leads').select('id').limit(1);
    const dbOk = !error;

    const status = dbOk ? 200 : 503;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'connected' : `error: ${error?.message}`,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'saltarelli-sms-drip-server',
    }));
  } else if (req.url === '/stats') {
    // Return sequence statistics
    const { data: activeLeads } = await supabase
      .from('admin_leads')
      .select('id', { count: 'exact' })
      .eq('sms_sequence_status', 'active');

    const { data: completedLeads } = await supabase
      .from('admin_leads')
      .select('id', { count: 'exact' })
      .eq('sms_sequence_status', 'completed');

    const { data: recentLogs } = await supabase
      .from('sms_drip_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(10);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeSequences: activeLeads?.length ?? 0,
      completedSequences: completedLeads?.length ?? 0,
      recentMessages: recentLogs ?? [],
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(PORT, () => {
  console.log(`[Health] ✓ HTTP server listening on port ${PORT}`);
  console.log(`         GET http://localhost:${PORT}/health`);
  console.log(`         GET http://localhost:${PORT}/stats`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('\n[Shutdown] SIGTERM received – shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[Shutdown] SIGINT received – shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err);
  // Don't exit – keep the server running
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled promise rejection:', reason);
  // Don't exit – keep the server running
});

// ── Start everything ────────────────────────────────────────────────────────

startRealtimeListener();
startCronScheduler();
runBootCatchup();
