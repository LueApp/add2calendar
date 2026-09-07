import test from 'node:test';
import assert from 'node:assert/strict';
import { addToNextcloud, basicAuth } from '../extension/lib/caldav.mjs';
import { normalizeEvent } from '../extension/lib/calendar.mjs';
import { series } from './fixtures.mjs';
const config = { calendarUrl: 'https://cloud.example.com/remote.php/dav/calendars/alice/pdc/', username: 'alice', appPassword: 'example-test-password' };

test('creates use conditional PUT; repeat clicks cannot overwrite existing calendar entries', async () => {
  const event = await normalizeEvent(series), stored = new Map();
  const server = async (url, options) => {
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['If-None-Match'], '*');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.equal((options.body.match(/BEGIN:VEVENT/g) || []).length, 1);
    if (stored.has(url)) return { status: 412 };
    stored.set(url, options.body); return { status: 201 };
  };
  assert.deepEqual(await addToNextcloud(config, event, event.sessions, 15, server), { added: 4, existing: 0, failed: 0, errors: [] });
  assert.deepEqual(await addToNextcloud(config, event, event.sessions, 15, server), { added: 0, existing: 4, failed: 0, errors: [] });
  assert.equal(stored.size, 4);
});

test('partial failure is reported accurately and retries recover without duplicate events', async () => {
  const event = await normalizeEvent(series), stored = new Set();
  let fail = true;
  const server = async url => {
    if (url.includes(encodeURIComponent(event.sessions[1].uid)) && fail) throw new TypeError('Network error');
    if (stored.has(url)) return { status: 412 };
    stored.add(url); return { status: 201 };
  };
  const first = await addToNextcloud(config, event, event.sessions, 0, server);
  assert.equal(first.added, 3); assert.equal(first.failed, 1);
  fail = false;
  const retry = await addToNextcloud(config, event, event.sessions, 0, server);
  assert.equal(retry.added, 1); assert.equal(retry.existing, 3); assert.equal(retry.failed, 0);
});

test('invalid credentials stop further writes and report remaining sessions as failed', async () => {
  const event = await normalizeEvent(series); let calls = 0;
  const result = await addToNextcloud(config, event, event.sessions, 15, async () => { calls++; return { status: 401 }; });
  assert.equal(calls, 1); assert.equal(result.failed, 4); assert.match(result.errors[0], /password/);
});

test('Basic authentication handles UTF-8 and disallows colon in username', () => {
  assert.equal(Buffer.from(basicAuth('同学', '密码').slice(6), 'base64').toString('utf8'), '同学:密码');
  assert.throws(() => basicAuth('a:b', 'password'));
});
