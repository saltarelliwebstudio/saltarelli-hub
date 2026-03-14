/**
 * SMS Drip Processor
 * Core logic for enrolling new leads and processing due messages.
 */

import { DRIP_SEQUENCE, buildMessage, normalisePhone } from './drip-sequence.js';
import { sendSms } from './openphone.js';
import {
  isDaySent,
  logSmsSend,
  updateLeadSmsStatus,
  getDueLeads,
  markSequenceCompleted,
} from './db.js';

/**
 * Enrol a new lead in the drip sequence and immediately send Day 0.
 *
 * @param {object} supabase   - Supabase client
 * @param {object} lead       - Row from admin_leads
 * @param {string} apiKey     - OpenPhone API key
 * @param {string} fromNumber - OpenPhone sender number
 */
export async function enrollLead(supabase, lead, apiKey, fromNumber) {
  const tag = `[Enrol ${lead.id}]`;

  // --- Guard: no phone number ---
  const phone = normalisePhone(lead.phone);
  if (!phone) {
    console.log(`${tag} Skipped – no valid phone number (raw: "${lead.phone}")`);
    return;
  }

  // --- Guard: do_not_contact status ---
  if (lead.status === 'do_not_contact') {
    console.log(`${tag} Skipped – lead status is do_not_contact`);
    return;
  }

  // --- Guard: SMS opt-out ---
  if (lead.sms_opt_out) {
    console.log(`${tag} Skipped – lead has opted out of SMS`);
    return;
  }

  // --- Guard: already in sequence ---
  if (lead.sms_sequence_status && lead.sms_sequence_status !== 'none') {
    console.log(`${tag} Skipped – already in sequence (status: ${lead.sms_sequence_status})`);
    return;
  }

  // --- Guard: Day 0 already sent ---
  const alreadySent = await isDaySent(supabase, lead.id, 0);
  if (alreadySent) {
    console.log(`${tag} Skipped – Day 0 already sent`);
    return;
  }

  console.log(`${tag} Enrolling lead "${lead.name}" (${phone}) in 45-day SMS sequence`);

  // Send Day 0 immediately
  const day0 = DRIP_SEQUENCE[0];
  const message = buildMessage(day0, lead);

  const result = await sendSms(phone, message, apiKey, fromNumber);

  // Log the send attempt
  await logSmsSend(supabase, {
    leadId: lead.id,
    dayNumber: 0,
    messageContent: message,
    status: result.success ? 'sent' : 'failed',
    openphoneResponse: result.data,
    errorMessage: result.error,
  });

  if (result.success) {
    console.log(`${tag} ✓ Day 0 SMS sent to ${phone}`);
  } else {
    console.error(`${tag} ✗ Day 0 SMS failed: ${result.error}`);
  }

  // Calculate the next send date (Day 3 from now)
  const nextStep = DRIP_SEQUENCE[1]; // Day 3
  const nextSendDate = addDays(new Date(), nextStep.day);

  // Update lead sequence status
  await updateLeadSmsStatus(supabase, lead.id, {
    smsSequenceStatus: 'active',
    smsSequenceDay: 0,
    smsNextSendDate: nextSendDate.toISOString(),
  });

  console.log(`${tag} Sequence activated. Next message (Day ${nextStep.day}) scheduled for ${nextSendDate.toISOString()}`);
}

/**
 * Process all leads that are due for their next SMS in the sequence.
 * Called by the cron job every hour.
 *
 * @param {object} supabase   - Supabase client
 * @param {string} apiKey     - OpenPhone API key
 * @param {string} fromNumber - OpenPhone sender number
 */
export async function processDueMessages(supabase, apiKey, fromNumber) {
  const dueLeads = await getDueLeads(supabase);

  if (dueLeads.length === 0) {
    console.log(`[Processor] No leads due for SMS at ${new Date().toISOString()}`);
    return;
  }

  console.log(`[Processor] Processing ${dueLeads.length} due lead(s)...`);

  for (let i = 0; i < dueLeads.length; i++) {
    await processLeadNextMessage(supabase, dueLeads[i], apiKey, fromNumber);
    // Rate limit: 10-second gap between sends to avoid triggering spam filters
    if (i < dueLeads.length - 1) {
      await sleep(10000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send the next due message for a single lead and advance the sequence.
 */
async function processLeadNextMessage(supabase, lead, apiKey, fromNumber) {
  const tag = `[Lead ${lead.id}]`;

  // --- Guard: do_not_contact (may have changed since enrolment) ---
  if (lead.status === 'do_not_contact') {
    console.log(`${tag} Pausing sequence – status changed to do_not_contact`);
    await updateLeadSmsStatus(supabase, lead.id, { smsSequenceStatus: 'paused' });
    return;
  }

  // --- Guard: opted out ---
  if (lead.sms_opt_out) {
    console.log(`${tag} Pausing sequence – lead opted out`);
    await updateLeadSmsStatus(supabase, lead.id, { smsSequenceStatus: 'opted_out' });
    return;
  }

  const phone = normalisePhone(lead.phone);
  if (!phone) {
    console.log(`${tag} Pausing sequence – phone number no longer valid`);
    await updateLeadSmsStatus(supabase, lead.id, { smsSequenceStatus: 'paused' });
    return;
  }

  // Determine which day to send next
  // The current sms_sequence_day is the last day sent; find the next step
  const currentDay = lead.sms_sequence_day ?? 0;
  const nextStepIndex = DRIP_SEQUENCE.findIndex(s => s.day > currentDay);

  if (nextStepIndex === -1) {
    // No more steps – sequence complete
    console.log(`${tag} Sequence already completed for "${lead.name}"`);
    await markSequenceCompleted(supabase, lead.id);
    return;
  }

  const step = DRIP_SEQUENCE[nextStepIndex];

  // Idempotency check: skip if already sent
  const alreadySent = await isDaySent(supabase, lead.id, step.day);
  if (alreadySent) {
    console.log(`${tag} Day ${step.day} already sent – advancing to next step`);
    await advanceToNextStep(supabase, lead, nextStepIndex);
    return;
  }

  const message = buildMessage(step, lead);

  console.log(`${tag} Sending Day ${step.day} SMS to "${lead.name}" (${phone})`);

  const result = await sendSms(phone, message, apiKey, fromNumber);

  await logSmsSend(supabase, {
    leadId: lead.id,
    dayNumber: step.day,
    messageContent: message,
    status: result.success ? 'sent' : 'failed',
    openphoneResponse: result.data,
    errorMessage: result.error,
  });

  if (result.success) {
    console.log(`${tag} ✓ Day ${step.day} SMS sent to ${phone}`);
  } else {
    console.error(`${tag} ✗ Day ${step.day} SMS failed: ${result.error}`);
    // On failure, retry in 1 hour by not advancing the sequence
    const retryDate = addDays(new Date(), 0, 1); // +1 hour
    await updateLeadSmsStatus(supabase, lead.id, {
      smsSequenceDay: currentDay, // keep current day
      smsNextSendDate: retryDate.toISOString(),
    });
    return;
  }

  // Advance to the next step
  await advanceToNextStep(supabase, lead, nextStepIndex);
}

/**
 * After successfully sending a step, update the lead's sequence position
 * and schedule the next message (or mark complete if done).
 */
async function advanceToNextStep(supabase, lead, justSentIndex) {
  const tag = `[Lead ${lead.id}]`;
  const justSentStep = DRIP_SEQUENCE[justSentIndex];
  const nextIndex = justSentIndex + 1;

  if (nextIndex >= DRIP_SEQUENCE.length) {
    // This was the last message (Day 45)
    await markSequenceCompleted(supabase, lead.id);
    console.log(`${tag} ✓ Sequence completed for "${lead.name}" after Day ${justSentStep.day}`);
    return;
  }

  const nextStep = DRIP_SEQUENCE[nextIndex];
  // Calculate days remaining until next step from the sequence start
  // We use relative days from now, based on the gap between steps
  const daysUntilNext = nextStep.day - justSentStep.day;
  const nextSendDate = addDays(new Date(), daysUntilNext);

  await updateLeadSmsStatus(supabase, lead.id, {
    smsSequenceDay: justSentStep.day,
    smsNextSendDate: nextSendDate.toISOString(),
  });

  console.log(`[Lead ${lead.id}] Next message (Day ${nextStep.day}) scheduled for ${nextSendDate.toISOString()}`);
}

/**
 * Add days (and optionally hours) to a Date object.
 */
function addDays(date, days, hours = 0) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(result.getHours() + hours);
  return result;
}
