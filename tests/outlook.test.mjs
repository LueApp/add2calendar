import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizationUrl, calendarViewUrl, createPkce, deleteEvents, eventRisk, exchangeCode, loadEvents, validateClientId, validateTenant } from '../extension/lib/outlook.mjs';

const clientId = '12345678-1234-4123-8123-123456789abc';

test('Outlook OAuth uses PKCE, the exact redirect, and calendar-only access', async () => {
  assert.equal(validateClientId(clientId), clientId);
  assert.equal(validateTenant('COMMON'), 'common');
  assert.equal(validateTenant('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.throws(() => validateTenant('not/a/tenant'));
  assert.throws(() => validateClientId('not-an-app'));
  const pkce = await createPkce();
  assert.match(pkce.verifier, /^[A-Za-z0-9_-]{80,90}$/);
  assert.match(pkce.challenge, /^[A-Za-z0-9_-]{43}$/);
  const url = new URL(authorizationUrl({ clientId, redirectUri: 'https://example.chromiumapp.org/outlook', state: 'state-1', challenge: pkce.challenge }));
  assert.equal(url.hostname, 'login.microsoftonline.com');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.chromiumapp.org/outlook');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'openid profile https://graph.microsoft.com/Calendars.ReadWrite');
  let tokenBody;
  const token = await exchangeCode({ clientId, redirectUri: 'https://example.chromiumapp.org/outlook', code: 'code', verifier: pkce.verifier }, async (target, options) => {
    assert.match(target, /login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/token$/);
    tokenBody = new URLSearchParams(options.body);
    return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(token.accessToken, 'token');
  assert.equal(tokenBody.get('code_verifier'), pkce.verifier);
  assert.equal(tokenBody.get('scope'), 'openid profile https://graph.microsoft.com/Calendars.ReadWrite');
  const tenantUrl = new URL(authorizationUrl({ clientId, tenant: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', redirectUri: 'https://example.chromiumapp.org/outlook', state: 'state-2', challenge: pkce.challenge }));
  assert.match(tenantUrl.pathname, /^\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\/oauth2\/v2\.0\/authorize$/);
});

test('Outlook calendar ranges use China-day boundaries and reject invalid input', () => {
  const url = new URL(calendarViewUrl('calendar/id', '2026-09-01', '2026-12-31'));
  assert.match(url.pathname, /calendar%2Fid\/calendarView$/);
  assert.equal(url.searchParams.get('startDateTime'), '2026-08-31T16:00:00.000Z');
  assert.equal(url.searchParams.get('endDateTime'), '2026-12-31T15:59:59.000Z');
  assert.throws(() => calendarViewUrl('', '2026-09-01', '2026-12-31'));
  assert.throws(() => calendarViewUrl('id', '2027-01-01', '2026-12-31'));
});

test('Outlook event loading follows only Graph pagination and enforces its limit', async () => {
  let calls = 0;
  const fetcher = async url => {
    calls++;
    const page = new URL(url).searchParams.get('page');
    return new Response(JSON.stringify(page ? { value: [{ id: '2' }, { id: '3' }] } : { value: [{ id: '1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/events?page=2' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await loadEvents({ calendarId: 'id', startDate: '2026-09-01', endDate: '2026-12-31', token: 'token', limit: 2 }, fetcher);
  assert.deepEqual(result.events.map(event => event.id), ['1', '2']);
  assert.equal(result.truncated, true);
  assert.equal(calls, 2);
  const malicious = async () => new Response(JSON.stringify({ value: [], '@odata.nextLink': 'https://example.com/events' }), { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => loadEvents({ calendarId: 'id', startDate: '2026-09-01', endDate: '2026-12-31', token: 'token' }, malicious), /unexpected link/);
});

test('Outlook deletion batches arbitrary selected events in groups of twenty', async () => {
  const events = Array.from({ length: 45 }, (_, index) => ({ id: `event/${index}`, subject: `Event ${index}` }));
  const batches = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://graph.microsoft.com/v1.0/$batch');
    const body = JSON.parse(options.body); batches.push(body.requests);
    return new Response(JSON.stringify({ responses: body.requests.map((request, index) => ({ id: request.id, status: batches.length === 2 && index === 0 ? 403 : 204, ...(batches.length === 2 && index === 0 ? { body: { error: { message: 'Denied' } } } : {}) })) }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await deleteEvents(events, 'token', fetcher);
  assert.deepEqual(batches.map(batch => batch.length), [20, 20, 5]);
  assert.ok(batches.flat().every(request => request.method === 'DELETE' && request.url.startsWith('/me/events/event%2F')));
  assert.equal(result.filter(item => item.ok).length, 44);
  assert.equal(result.find(item => !item.ok).message, 'Denied');
});

test('Outlook cleanup flags organizer meetings and recurring entries', () => {
  assert.deepEqual(eventRisk({ attendees: [], isOrganizer: true, type: 'singleInstance' }), { meeting: false, organizer: false, recurring: false });
  assert.deepEqual(eventRisk({ attendees: [{}], isOrganizer: true, type: 'occurrence' }), { meeting: true, organizer: true, recurring: true });
});
