export const SOURCE = 'https://pdc.hkust-gz.edu.cn/enrollment-records';
const DAY = 86400000;
const WEEKDAYS = ['meetOnSun', 'meetOnMon', 'meetOnTue', 'meetOnWed', 'meetOnThu', 'meetOnFri', 'meetOnSat'];

export function cleanText(value, limit = 12000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, limit).trim();
}

function dayValue(value, sourceName = 'PDC') {
  const date = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})(?:$|T| )/)?.[1];
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!date || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date)
    throw new Error(`${sourceName} returned an invalid schedule date. Check the source schedule.`);
  return ms;
}

function clockMinutes(hour, minute, allowMidnight = false, sourceName = 'PDC') {
  if (hour === null || hour === undefined || hour === '' || minute === null || minute === undefined || minute === '')
    throw new Error(`${sourceName} has not supplied a complete start/end time.`);
  const h = Number(hour), m = Number(minute);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59 || h > 23 && !(allowMidnight && h === 24 && m === 0))
    throw new Error(`${sourceName} returned an invalid schedule time.`);
  return h * 60 + m;
}

function isYes(value) { return [true, 1, '1', 'Y', 'Yes', 'true'].includes(value); }

async function uidFor(code, start, end, namespace = 'pdc') {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([code, start, end])));
  const value = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return namespace === 'pdc' ? `pdc-${value}@pdc-calendar.local` : `${namespace}-${value}@add2calendar.local`;
}

export async function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('No calendar event was supplied.');
  const sourceName = cleanText(raw.sourceName || 'PDC', 50);
  const sourceUrl = cleanText(raw.sourceUrl || SOURCE, 1000);
  const uidNamespace = /^[a-z0-9-]{1,30}$/.test(raw.uidNamespace) ? raw.uidNamespace : 'pdc';
  let parsedSource;
  try { parsedSource = new URL(sourceUrl); } catch { throw new Error(`${sourceName} supplied an invalid source URL.`); }
  if (parsedSource.protocol !== 'https:') throw new Error(`${sourceName} supplied an invalid source URL.`);
  const code = cleanText(raw.activityEventCode, 200);
  const title = cleanText(raw.description || raw.title || raw.eventName, 500);
  if (!code || !title) throw new Error('The event code or title is missing.');
  if (!Array.isArray(raw.eventSchedules) || !raw.eventSchedules.length || raw.eventSchedules.length > 200)
    throw new Error(`This ${sourceName} entry has no usable schedule yet. Try again after the source publishes it.`);
  const sessions = [], seen = new Map();
  for (const schedule of raw.eventSchedules) {
    const first = dayValue(schedule.dateBegin, sourceName), last = schedule.dateEnd ? dayValue(schedule.dateEnd, sourceName) : first;
    if (last < first || last - first > 732 * DAY) throw new Error(`The event date range needs to be checked in ${sourceName}.`);
    const startMinute = clockMinutes(schedule.hourBegin, schedule.minuteBegin, false, sourceName);
    const endMinute = clockMinutes(schedule.hourEnd, schedule.minuteEnd, true, sourceName);
    if (endMinute <= startMinute) throw new Error(`The end time is not after the start time. Check this schedule in ${sourceName}.`);
    const days = WEEKDAYS.map(key => isYes(schedule[key]));
    if (last !== first && !days.some(Boolean)) throw new Error('This event spans several dates without meeting weekdays. Its sessions cannot be inferred safely.');
    for (let date = first; date <= last; date += DAY) {
      if (last !== first && !days[new Date(date).getUTCDay()]) continue;
      const start = new Date(date + (startMinute - 480) * 60000).toISOString();
      const end = new Date(date + (endMinute - 480) * 60000).toISOString();
      const identity = `${start}/${end}`;
      const location = cleanText(schedule.venue, 1000);
      if (seen.has(identity)) {
        const existing = seen.get(identity);
        const locations = [...new Set([...(existing.locationOptions || [existing.location]), location].filter(Boolean))];
        existing.location = locations.join(' / ');
        if (locations.length > 1) existing.locationOptions = locations;
        continue;
      }
      const session = { uid: await uidFor(code, start, end, uidNamespace), start, end, location };
      seen.set(identity, session);
      sessions.push(session);
      if (sessions.length > 500) throw new Error('This event has too many sessions to export at once.');
    }
  }
  if (!sessions.length) throw new Error('No meeting dates match this event’s schedule.');
  sessions.sort((a, b) => a.start.localeCompare(b.start));
  const instructors = Array.isArray(raw.eventInstructors) ? raw.eventInstructors.map(i => cleanText(i.name, 200)).filter(Boolean).join(', ') : '';
  const description = [
    `${sourceName} event: ${code}`,
    instructors && `Instructor: ${instructors}`,
    raw.enquiryEmail && `Enquiries: ${cleanText(raw.enquiryEmail, 500)}`,
    cleanText(raw.remarks),
    `Source: ${parsedSource.href}`,
    `Added from ${sourceName}. Check ${sourceName} for later schedule changes or cancellations.`
  ].filter(Boolean).join('\n\n');
  return { code, title, description, url: parsedSource.href, sourceName, sessions };
}

export function escapeICS(value) {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function foldLine(line) {
  const encoder = new TextEncoder();
  let out = '', length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { out += '\r\n '; length = 1; }
    out += char; length += bytes;
  }
  return out;
}

export function compactDate(value) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

export function makeICS(event, sessions = event.sessions, reminder = 15, now = new Date()) {
  return makeCalendarICS([{ event, sessions }], reminder, now);
}

export function makeCalendarICS(entries, reminder = 15, now = new Date()) {
  if (!entries.some(entry => entry.sessions.length)) throw new Error('Select at least one session.');
  if (![0, 5, 15, 30, 60, 1440].includes(Number(reminder))) throw new Error('Invalid reminder.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Add2Calendar//EN', 'CALSCALE:GREGORIAN'];
  const seen = new Set();
  for (const { event, sessions } of entries) {
  for (const session of sessions) {
    if (seen.has(session.uid)) continue;
    seen.add(session.uid);
    lines.push('BEGIN:VEVENT', `UID:${session.uid}`, `DTSTAMP:${compactDate(now)}`, `DTSTART:${compactDate(session.start)}`, `DTEND:${compactDate(session.end)}`,
      `SUMMARY:${escapeICS(event.title)}`, `DESCRIPTION:${escapeICS(event.description)}`, `LOCATION:${escapeICS(session.location)}`,
      `URL:${escapeICS(event.url || SOURCE)}`, 'STATUS:CONFIRMED', 'TRANSP:OPAQUE');
    if (Number(reminder)) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${Number(reminder)}M`, `DESCRIPTION:${escapeICS(event.title)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function providerURL(provider, event, session) {
  let url;
  if (provider === 'google') {
    url = new URL('https://calendar.google.com/calendar/render');
    url.search = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${compactDate(session.start)}/${compactDate(session.end)}`, details: event.description, location: session.location, ctz: 'Asia/Shanghai' });
  } else if (provider === 'outlook-school' || provider === 'outlook-personal') {
    url = new URL(provider === 'outlook-school' ? 'https://outlook.office.com/calendar/0/deeplink/compose' : 'https://outlook.live.com/calendar/0/deeplink/compose');
    url.search = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, startdt: session.start, enddt: session.end, body: event.description, location: session.location, allday: 'false' });
  } else throw new Error('Unknown calendar provider.');
  return url.href;
}

export function calendarURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter the full private CalDAV calendar URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('Use an HTTPS calendar URL without embedded credentials, query parameters, or fragments.');
  if (!/\/remote\.php\/dav\/calendars\/[^/]+\/[^/]+\/?$/.test(url.pathname))
    throw new Error('Copy the private link for a specific Nextcloud calendar (…/remote.php/dav/calendars/user/calendar/).');
  url.pathname = url.pathname.replace(/\/?$/, '/');
  return url.href;
}
