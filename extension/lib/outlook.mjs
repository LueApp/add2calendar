import { t } from './i18n.mjs';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'openid profile https://graph.microsoft.com/Calendars.ReadWrite';
const CLIENT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const TENANT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateClientId(value) {
  const clientId = String(value || '').trim();
  if (!CLIENT_ID.test(clientId)) throw new Error(t('invalidMicrosoftClientId', undefined, 'Enter a valid Microsoft application client ID.'));
  return clientId;
}

export function validateTenant(value = 'common') {
  const tenant = String(value || '').trim().toLowerCase();
  if (!TENANT_ID.test(tenant) && !['common', 'organizations', 'consumers'].includes(tenant))
    throw new Error(t('invalidMicrosoftTenant', undefined, 'Enter a Directory (tenant) ID, common, organizations, or consumers.'));
  return tenant;
}

function loginRoot(tenant) {
  return `https://login.microsoftonline.com/${encodeURIComponent(validateTenant(tenant))}/oauth2/v2.0`;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkce() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const verifier = base64url(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function authorizationUrl({ clientId, tenant = 'common', redirectUri, state, challenge }) {
  const url = new URL(`${loginRoot(tenant)}/authorize`);
  url.search = new URLSearchParams({
    client_id: validateClientId(clientId), response_type: 'code', redirect_uri: redirectUri,
    response_mode: 'query', scope: SCOPES, state,
    code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account'
  });
  return url.href;
}

export async function exchangeCode({ clientId, tenant = 'common', redirectUri, code, verifier }, fetcher = fetch) {
  const response = await fetcher(`${loginRoot(tenant)}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: validateClientId(clientId), grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier, scope: SCOPES }),
    credentials: 'omit', redirect: 'error', cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || t('microsoftTokenHttp', String(response.status), `Microsoft sign-in returned HTTP ${response.status}.`));
  return { accessToken: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000 };
}

function graphUrl(value) {
  const url = new URL(value, GRAPH_ROOT + '/');
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) throw new Error(t('unexpectedGraphLink', undefined, 'Microsoft Graph returned an unexpected link.'));
  return url;
}

export async function graphRequest(path, token, options = {}, fetcher = fetch) {
  if (!token) throw new Error(t('connectOutlookFirst', undefined, 'Connect to Outlook first.'));
  const url = graphUrl(path);
  const response = await fetcher(url.href, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.headers || {}) },
    credentials: 'omit', redirect: 'error', cache: 'no-store'
  });
  if (response.status === 401) throw new Error(t('graphSessionExpired', undefined, 'Your Microsoft session expired. Connect again.'));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || t('graphHttp', String(response.status), `Microsoft Graph returned HTTP ${response.status}.`));
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function loadCalendars(token, fetcher = fetch) {
  const data = await graphRequest(`${GRAPH_ROOT}/me/calendars?$select=id,name,color,isDefaultCalendar,canEdit&$top=100`, token, {}, fetcher);
  return Array.isArray(data?.value) ? data.value.filter(calendar => calendar.canEdit !== false) : [];
}

export function calendarViewUrl(calendarId, startDate, endDate) {
  if (!calendarId || !DATE.test(startDate) || !DATE.test(endDate) || startDate > endDate) throw new Error(t('invalidCalendarRange', undefined, 'Choose a valid calendar and date range.'));
  const start = new Date(`${startDate}T00:00:00+08:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59+08:00`).toISOString();
  const url = new URL(`${GRAPH_ROOT}/me/calendars/${encodeURIComponent(calendarId)}/calendarView`);
  url.search = new URLSearchParams({ startDateTime: start, endDateTime: end, '$select': 'id,subject,start,end,location,organizer,type,isOrganizer,isCancelled,webLink,seriesMasterId,attendees,sensitivity', '$top': '100' });
  return url.href;
}

export async function loadEvents({ calendarId, startDate, endDate, token, limit = 2000 }, fetcher = fetch) {
  const events = [];
  let next = calendarViewUrl(calendarId, startDate, endDate);
  let truncated = false;
  while (next && events.length < limit) {
    const data = await graphRequest(next, token, {}, fetcher);
    if (Array.isArray(data?.value)) {
      const remaining = limit - events.length;
      if (data.value.length > remaining) truncated = true;
      events.push(...data.value.slice(0, remaining));
    }
    next = data?.['@odata.nextLink'] || '';
    if (next) graphUrl(next);
  }
  return { events, truncated: truncated || !!next };
}

export function eventRisk(event) {
  const meeting = Number(event?.attendeeCount) > 0 || Array.isArray(event?.attendees) && event.attendees.length > 0;
  return { meeting, organizer: meeting && event?.isOrganizer === true, recurring: ['occurrence', 'exception', 'seriesMaster'].includes(event?.type) };
}

export async function deleteEvents(events, token, fetcher = fetch) {
  if (!Array.isArray(events) || !events.length) throw new Error(t('selectOutlookFirst', undefined, 'Select at least one Outlook event.'));
  const unique = [...new Map(events.filter(event => event?.id).map(event => [event.id, event])).values()];
  const results = [];
  for (let offset = 0; offset < unique.length; offset += 20) {
    const chunk = unique.slice(offset, offset + 20);
    const requests = chunk.map((event, index) => ({ id: String(index + 1), method: 'DELETE', url: `/me/events/${encodeURIComponent(event.id)}` }));
    const data = await graphRequest(`${GRAPH_ROOT}/$batch`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) }, fetcher);
    const byId = new Map((data?.responses || []).map(response => [response.id, response]));
    chunk.forEach((event, index) => {
      const response = byId.get(String(index + 1));
      results.push({ event, ok: response?.status === 204, status: response?.status || 0, message: response?.body?.error?.message || '' });
    });
  }
  return results;
}
