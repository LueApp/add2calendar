import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendarICS } from '../extension/lib/calendar.mjs';
import { normalizeBatch, selectSessions } from '../extension/lib/batch.mjs';
import { seminar, series } from './fixtures.mjs';

test('one batch calendar keeps each event’s own title, venue, description and stable identifiers', async () => {
  const { events } = await normalizeBatch([seminar, series]);
  const text = makeCalendarICS(events.map(event => ({ event, sessions: event.sessions })), 15).replace(/\r\n /g, '');
  assert.equal((text.match(/BEGIN:VCALENDAR/g) || []).length, 1);
  assert.equal((text.match(/END:VCALENDAR/g) || []).length, 1);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 5);
  const records = text.split('BEGIN:VEVENT\r\n').slice(1);
  for (const event of events) {
    for (const session of event.sessions) {
      const record = records.find(value => value.includes(`UID:${session.uid}\r\n`));
      assert.ok(record);
      assert.ok(record.includes(`SUMMARY:${event.title.replace(/,/g, '\\,')}\r\n`));
      assert.ok(record.includes(`LOCATION:${session.location.replace(/,/g, '\\,')}\r\n`));
      assert.ok(record.includes(event.code));
    }
  }
});

test('batch export respects event/session selection and does not repeat a selected UID', async () => {
  const { events } = await normalizeBatch([seminar, series]);
  const event = events.find(value => value.code === series.activityEventCode);
  const entries = [{ event, sessions: event.sessions.slice(0, 2) }];
  assert.equal((makeCalendarICS([...entries, ...entries]).match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.throws(() => makeCalendarICS([{ event, sessions: [] }]), /Select at least one/);
});

test('invalid schedules are reported individually while valid enrolled events remain usable', async () => {
  const { events, errors } = await normalizeBatch([seminar, { ...series, eventSchedules: [] }]);
  assert.equal(events.length, 1); assert.equal(events[0].code, seminar.activityEventCode);
  assert.equal(errors.length, 1); assert.equal(errors[0].code, series.activityEventCode);
  assert.match(errors[0].message, /schedule/);
});

test('duplicate enrollment codes collapse and empty batches are rejected', async () => {
  assert.equal((await normalizeBatch([seminar, seminar])).events.length, 1);
  await assert.rejects(normalizeBatch([]), /No enrolled events/);
});

test('upcoming selection excludes ended sessions and keeps sessions still in progress', async () => {
  const { events } = await normalizeBatch([seminar, series]);
  const now = Date.parse('2026-09-10T07:00:00Z');
  assert.equal(selectSessions(events, 'all', now).size, 5);
  assert.equal(selectSessions(events, 'upcoming', now).size, 3);
  assert.equal(selectSessions(events, 'none', now).size, 0);
});
