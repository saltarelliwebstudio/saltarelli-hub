/**
 * 45-Day SMS Drip Sequence Configuration
 * All messages for the Saltarelli Web Studio lead nurture campaign.
 *
 * Template variables:
 *   [Name]  → lead.name
 *   [trade] → lead.service_interest (or "trades" as fallback)
 */

export const DRIP_SEQUENCE = [
  {
    day: 0,
    label: 'Day 0 – Initial outreach',
    template: `Hey [Name], Adam from Saltarelli Web Studio here in Niagara. I recently helped Zach Melnyk at Melnyk Concrete get back 5+ hours a week with a simple AI automation. Worth a quick chat?`,
  },
  {
    day: 3,
    label: 'Day 3 – Soft follow-up',
    template: `Hey [Name], just following up — I know you're busy on the tools. If you ever want to see how other [trade] businesses are saving 5+ hours a week on admin, I'm happy to show you a quick demo. No pressure.`,
  },
  {
    day: 7,
    label: 'Day 7 – Missed calls angle',
    template: `Hey [Name], quick thought — what if every missed call turned into a booked job automatically? That's what we set up for trades businesses like yours. Want me to show you how it works? Takes 10 min.`,
  },
  {
    day: 14,
    label: 'Day 14 – Check-in',
    template: `Hey [Name], Adam here. Just wanted to check in — still happy to show you how we help [trade] businesses cut their admin time in half. Let me know if you'd like a quick walkthrough.`,
  },
  {
    day: 21,
    label: 'Day 21 – Social proof',
    template: `Hey [Name], one more thought — we just helped a concrete company in Niagara automate their entire quote follow-up process. Saved them hours every week. If that sounds useful, I'd love to chat.`,
  },
  {
    day: 30,
    label: 'Day 30 – Timing nudge',
    template: `Hey [Name], Adam from Saltarelli Web Studio. I know timing is everything — whenever you're ready to look at automating some of the admin side of your business, I'm here. Just reply and we'll set something up.`,
  },
  {
    day: 45,
    label: 'Day 45 – Final message',
    template: `Hey [Name], last note from me — if you ever want to explore how apps and automations can help your business run smoother, my door's always open. All the best! - Adam, Saltarelli Web Studio`,
  },
];

/**
 * Build the personalised message text for a given sequence step and lead.
 * @param {object} step  - One entry from DRIP_SEQUENCE
 * @param {object} lead  - Row from admin_leads
 * @returns {string}
 */
export function buildMessage(step, lead) {
  const firstName = (lead.name || 'there').split(' ')[0].trim();

  // Derive a friendly trade label from service_interest
  let trade = 'trades';
  if (lead.service_interest) {
    const si = lead.service_interest.toLowerCase();
    if (si.includes('concrete') || si.includes('paving') || si.includes('masonry')) {
      trade = 'concrete';
    } else if (si.includes('landscap')) {
      trade = 'landscaping';
    } else if (si.includes('plumb')) {
      trade = 'plumbing';
    } else if (si.includes('electr')) {
      trade = 'electrical';
    } else if (si.includes('hvac') || si.includes('heat') || si.includes('cool')) {
      trade = 'HVAC';
    } else if (si.includes('roofing') || si.includes('roof')) {
      trade = 'roofing';
    } else if (si.includes('paint')) {
      trade = 'painting';
    } else if (si.includes('clean')) {
      trade = 'cleaning';
    } else if (si.includes('construct')) {
      trade = 'construction';
    } else if (si.includes('fitness') || si.includes('gym')) {
      trade = 'fitness';
    } else if (si.includes('restaurant') || si.includes('food')) {
      trade = 'restaurant';
    } else {
      // Use the raw value trimmed to a reasonable length
      trade = lead.service_interest.split(',')[0].trim().toLowerCase();
    }
  }

  return step.template
    .replace(/\[Name\]/g, firstName)
    .replace(/\[trade\]/g, trade);
}

/**
 * Normalise a phone number to E.164 format (+1XXXXXXXXXX for North American numbers).
 * Returns null if the number cannot be normalised.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalisePhone(raw) {
  if (!raw) return null;
  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return null; // international – skip for now
  return null;
}
