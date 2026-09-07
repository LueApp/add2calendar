import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, makeICS, providerURL, calendarURL } from '../extension/lib/calendar.mjs';
import { seminar, series } from './fixtures.mjs';

test('PDC China time becomes an absolute instant, independent of machine timezone', async () => {
  const event = await normalizeEvent(seminar);
  assert.equal(event.sessions[0].start, '2026-09-10T06:30:00.000Z');
  assert.equal(event.sessions[0].end, '2026-09-10T08:00:00.000Z');
  const early = await normalizeEvent({ ...seminar, eventSchedules: [{ ...seminar.eventSchedules[0], hourBegin: 0, minuteBegin: 15, hourEnd: 1 }] });
  assert.equal(early.sessions[0].start, '2026-09-09T16:15:00.000Z');
});

test('multiweek schedules expand matching weekdays and preserve individual sessions', async () => {
  const event = await normalizeEvent(series);
  assert.deepEqual(event.sessions.map(s => s.start.slice(0, 10)), ['2026-09-07', '2026-09-09', '2026-09-14', '2026-09-16']);
  const flags = { ...series, eventSchedules: [{ ...series.eventSchedules[0], meetOnMon: 'N', meetOnWed: 'Y' }] };
  assert.equal((await normalizeEvent(flags)).sessions.length, 2);
});

test('ambiguous, impossible and missing dates/times are rejected instead of guessed', async () => {
  for (const patch of [
    { dateBegin: '2026-02-30' }, { dateEnd: '2026-09-09' }, { minuteBegin: null }, { hourBegin: 25 },
    { hourEnd: 13 }, { dateEnd: '2026-09-11' }
  ]) await assert.rejects(normalizeEvent({ ...seminar, eventSchedules: [{ ...seminar.eventSchedules[0], ...patch }] }));
  await assert.rejects(normalizeEvent({ ...seminar, eventSchedules: [] }));
});

test('duplicates collapse and IDs survive reordering and title changes', async () => {
  const event = await normalizeEvent(seminar);
  const repeated = await normalizeEvent({ ...seminar, description: 'Renamed', eventSchedules: [...seminar.eventSchedules, ...seminar.eventSchedules] });
  assert.equal(repeated.sessions.length, 1);
  assert.equal(repeated.sessions[0].uid, event.sessions[0].uid);
  const a = { ...seminar.eventSchedules[0], dateBegin: '2026-09-11', dateEnd: '2026-09-11' };
  const first = await normalizeEvent({ ...seminar, eventSchedules: [...seminar.eventSchedules, a] });
  const second = await normalizeEvent({ ...seminar, eventSchedules: [a, ...seminar.eventSchedules] });
  assert.deepEqual(first.sessions, second.sessions);
});

test('conflicting venues at the same time become user-selectable options', async () => {
  const event = await normalizeEvent({ ...seminar, eventSchedules: [...seminar.eventSchedules, { ...seminar.eventSchedules[0], venue: 'Different room' }] });
  assert.equal(event.sessions.length, 1);
  assert.deepEqual(event.sessions[0].locationOptions, ['Academic Building, Room 101', 'Different room']);
  assert.equal(event.sessions[0].location, 'Academic Building, Room 101 / Different room');
});

test('iCalendar escapes injected properties and folds Unicode at 75 octets with CRLF', async () => {
  const event = await normalizeEvent({ ...seminar, description: '研究;交流,分享\\test\nATTENDEE:bad@example.com ' + '学'.repeat(100) });
  const ics = makeICS(event, event.sessions, 30, new Date('2026-09-07T00:00:00Z'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!ics.includes('\r\nATTENDEE:'));
  assert.match(ics.replace(/\r\n /g, ''), /SUMMARY:研究\\;交流\\,分享\\\\test\\nATTENDEE/);
  assert.match(ics, /TRIGGER:-PT30M/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('multi-session exports include every selected occurrence, without meeting invitations', async () => {
  const event = await normalizeEvent(series);
  const ics = makeICS(event, event.sessions.slice(1), 0);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.ok(!/ATTENDEE:|ORGANIZER:|METHOD:REQUEST|VALARM/.test(ics));
});

test('provider links preserve punctuation, Unicode and absolute start/end times', async () => {
  const event = await normalizeEvent({ ...seminar, description: 'AI & 社会 + "research" #1' });
  for (const provider of ['outlook-school', 'outlook-personal', 'google']) {
    const url = new URL(providerURL(provider, event, event.sessions[0]));
    assert.equal(url.searchParams.get(provider === 'google' ? 'text' : 'subject'), event.title);
    if (provider !== 'google') assert.equal(new Date(url.searchParams.get('startdt')).toISOString(), event.sessions[0].start);
    else assert.equal(url.searchParams.get('dates'), '20260910T063000Z/20260910T080000Z');
  }
});

test('Nextcloud accepts a specific HTTPS calendar, rejects unrelated endpoints and embedded credentials', () => {
  assert.equal(calendarURL('https://cloud.example.com/remote.php/dav/calendars/alice/pdc'), 'https://cloud.example.com/remote.php/dav/calendars/alice/pdc/');
  for (const value of ['http://cloud.example.com/remote.php/dav/calendars/a/b/', 'https://u:p@cloud.example.com/remote.php/dav/calendars/a/b/', 'https://cloud.example.com/apps/calendar', 'https://cloud.example.com/remote.php/dav/calendars/a/b/?token=x', 'https://cloud.example.com/remote.php/dav/calendars/a/b/#x']) assert.throws(() => calendarURL(value));
});
