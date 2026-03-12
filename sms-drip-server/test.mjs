/**
 * End-to-end test suite for the SMS Drip Sequence Server
 * Tests: message building, phone normalisation, DB operations, OpenPhone API
 *
 * Run: node test.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DRIP_SEQUENCE, buildMessage, normalisePhone } from './drip-sequence.js';
import { sendSms } from './openphone.js';
import { getSupabase, isDaySent, logSmsSend, updateLeadSmsStatus, getDueLeads } from './db.js';
import { enrollLead } from './processor.js';

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const OPENPHONE_KEY  = process.env.OPENPHONE_API_KEY;
const OPENPHONE_FROM = process.env.OPENPHONE_FROM_NUMBER;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✓ ${name}`);
    passed++;
  }).catch(err => {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ── Test 1: Drip sequence configuration ────────────────────────────────────

console.log('\n[1] Drip sequence configuration');

await test('Has 7 messages', async () => {
  assert(DRIP_SEQUENCE.length === 7, `Expected 7, got ${DRIP_SEQUENCE.length}`);
});

await test('Days are [0, 3, 7, 14, 21, 30, 45]', async () => {
  const days = DRIP_SEQUENCE.map(s => s.day);
  assert(JSON.stringify(days) === JSON.stringify([0, 3, 7, 14, 21, 30, 45]),
    `Got: ${JSON.stringify(days)}`);
});

await test('All templates contain [Name]', async () => {
  for (const step of DRIP_SEQUENCE) {
    assert(step.template.includes('[Name]'), `Day ${step.day} missing [Name]`);
  }
});

// ── Test 2: Phone normalisation ─────────────────────────────────────────────

console.log('\n[2] Phone number normalisation');

await test('10-digit number', async () => {
  assert(normalisePhone('2896901714') === '+12896901714');
});

await test('Formatted (905) 774-4556', async () => {
  assert(normalisePhone('(905) 774-4556') === '+19057744556');
});

await test('Already E.164 +12895551234', async () => {
  assert(normalisePhone('+12895551234') === '+12895551234');
});

await test('11-digit with country code 12895551234', async () => {
  assert(normalisePhone('12895551234') === '+12895551234');
});

await test('Null returns null', async () => {
  assert(normalisePhone(null) === null);
});

await test('Empty string returns null', async () => {
  assert(normalisePhone('') === null);
});

// ── Test 3: Message building ────────────────────────────────────────────────

console.log('\n[3] Message building');

const mockLead = {
  name: 'John Smith',
  service_interest: 'Concrete & Paving',
  phone: '2895551234',
};

await test('Day 0 replaces [Name] correctly', async () => {
  const msg = buildMessage(DRIP_SEQUENCE[0], mockLead);
  assert(msg.includes('John'), `Message: ${msg}`);
  assert(!msg.includes('[Name]'), 'Still contains [Name]');
});

await test('Day 3 replaces [trade] correctly', async () => {
  const msg = buildMessage(DRIP_SEQUENCE[1], mockLead);
  assert(!msg.includes('[trade]'), `Still contains [trade]: ${msg}`);
  assert(msg.includes('concrete'), `Expected 'concrete' in: ${msg}`);
});

await test('Fallback name "there" when name is empty', async () => {
  const msg = buildMessage(DRIP_SEQUENCE[0], { name: '', service_interest: null });
  assert(msg.includes('there'), `Expected 'there' in: ${msg}`);
});

await test('Day 45 final message is correct length', async () => {
  const msg = buildMessage(DRIP_SEQUENCE[6], mockLead);
  assert(msg.length > 50 && msg.length < 500, `Unexpected length: ${msg.length}`);
});

// ── Test 4: Supabase connectivity ───────────────────────────────────────────

console.log('\n[4] Supabase connectivity');

const supabase = getSupabase(SUPABASE_URL, SUPABASE_KEY);

await test('Can query admin_leads', async () => {
  const { data, error } = await supabase.from('admin_leads').select('id').limit(1);
  assert(!error, `Supabase error: ${error?.message}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('sms_drip_log table exists', async () => {
  const { data, error } = await supabase.from('sms_drip_log').select('id').limit(1);
  assert(!error, `sms_drip_log error: ${error?.message}`);
});

await test('admin_leads has sms_sequence_status column', async () => {
  const { data, error } = await supabase
    .from('admin_leads')
    .select('sms_sequence_status')
    .limit(1);
  assert(!error, `Column error: ${error?.message}`);
});

await test('admin_leads has sms_next_send_date column', async () => {
  const { data, error } = await supabase
    .from('admin_leads')
    .select('sms_next_send_date')
    .limit(1);
  assert(!error, `Column error: ${error?.message}`);
});

// ── Test 5: getDueLeads returns correct results ─────────────────────────────

console.log('\n[5] getDueLeads query');

await test('getDueLeads returns array', async () => {
  const leads = await getDueLeads(supabase);
  assert(Array.isArray(leads), 'Expected array');
  console.log(`     (${leads.length} leads currently due)`);
});

// ── Test 6: OpenPhone API connectivity ─────────────────────────────────────

console.log('\n[6] OpenPhone API');

await test('API key is configured', async () => {
  assert(OPENPHONE_KEY && OPENPHONE_KEY.length > 10, 'API key missing or too short');
});

await test('From number is E.164 format', async () => {
  assert(OPENPHONE_FROM && OPENPHONE_FROM.startsWith('+'), `Invalid from: ${OPENPHONE_FROM}`);
});

// Test with a deliberately invalid number to verify API connectivity without sending a real SMS
await test('API rejects invalid phone number (connectivity check)', async () => {
  const result = await sendSms('+10000000000', 'Test', OPENPHONE_KEY, OPENPHONE_FROM);
  // We expect either success (unlikely) or a structured error response
  // Either way, if we get a response object back, the API is reachable
  assert(typeof result === 'object', 'Expected result object');
  assert('success' in result, 'Expected success field');
  console.log(`     (API responded with success=${result.success}, status=${result.statusCode})`);
});

// ── Test 7: Enrolment guard – no phone number ───────────────────────────────

console.log('\n[7] Enrolment guards');

await test('Skips lead with no phone number (no DB write)', async () => {
  const noPhoneLead = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test No Phone',
    phone: null,
    status: 'cold',
    sms_sequence_status: 'none',
    sms_opt_out: false,
    service_interest: 'Website',
  };
  // enrollLead should return without throwing and without writing to DB
  await enrollLead(supabase, noPhoneLead, OPENPHONE_KEY, OPENPHONE_FROM);
  // Verify nothing was written
  const { data } = await supabase
    .from('sms_drip_log')
    .select('id')
    .eq('lead_id', noPhoneLead.id);
  assert(!data || data.length === 0, 'Should not have logged anything for no-phone lead');
});

await test('Skips do_not_contact lead', async () => {
  const dncLead = {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Test DNC',
    phone: '2895551234',
    status: 'do_not_contact',
    sms_sequence_status: 'none',
    sms_opt_out: false,
    service_interest: 'Website',
  };
  await enrollLead(supabase, dncLead, OPENPHONE_KEY, OPENPHONE_FROM);
  const { data } = await supabase
    .from('sms_drip_log')
    .select('id')
    .eq('lead_id', dncLead.id);
  assert(!data || data.length === 0, 'Should not have logged anything for DNC lead');
});

await test('Skips lead already in sequence', async () => {
  const activeLead = {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Test Active',
    phone: '2895551234',
    status: 'cold',
    sms_sequence_status: 'active',
    sms_opt_out: false,
    service_interest: 'Website',
  };
  await enrollLead(supabase, activeLead, OPENPHONE_KEY, OPENPHONE_FROM);
  const { data } = await supabase
    .from('sms_drip_log')
    .select('id')
    .eq('lead_id', activeLead.id);
  assert(!data || data.length === 0, 'Should not have logged anything for already-active lead');
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('⚠️  Some tests failed – review errors above');
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
}
