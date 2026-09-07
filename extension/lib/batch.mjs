import { normalizeEvent, cleanText } from './calendar.mjs';

export async function normalizeBatch(rawEvents) {
  if (!Array.isArray(rawEvents) || !rawEvents.length) throw new Error('No enrolled events are available to add.');
  if (rawEvents.length > 500) throw new Error('This batch contains more than 500 enrolled events. Use individual event buttons instead.');
  const events = [], errors = [], seen = new Set();
  let sessions = 0;
  for (const raw of rawEvents) {
    try {
      const event = await normalizeEvent(raw);
      if (seen.has(event.code)) continue;
      seen.add(event.code);
      sessions += event.sessions.length;
      if (sessions > 5000) throw new RangeError('This batch contains more than 5,000 sessions. Use individual event buttons instead.');
      events.push(event);
    } catch (error) {
      if (error instanceof RangeError) throw error;
      errors.push({ code: cleanText(raw?.activityEventCode, 200), title: cleanText(raw?.description, 500), message: error.message });
    }
  }
  events.sort((a, b) => a.sessions[0].start.localeCompare(b.sessions[0].start));
  return { events, errors };
}

export function selectSessions(events, mode, now = Date.now()) {
  if (!['all', 'upcoming', 'none'].includes(mode)) throw new Error('Unknown session selection.');
  return new Set(events.flatMap(event => event.sessions.filter(session => mode === 'all' || mode === 'upcoming' && Date.parse(session.end) > now).map(session => session.uid)));
}
