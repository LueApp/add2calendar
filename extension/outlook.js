import { authorizationUrl, createPkce, deleteEvents, eventRisk, exchangeCode, loadCalendars, loadEvents } from './lib/outlook.mjs';

const { t, localizeDocument } = globalThis.Add2CalendarI18n;
localizeDocument();
const $ = id => document.getElementById(id);
const locale = chrome.i18n.getUILanguage();
const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
let config, accessToken = '', expiresAt = 0, calendars = [], events = [], selected = new Set(), busy = false;

function status(message, error = false) {
  $('cleanup-status').textContent = message;
  $('cleanup-status').className = error ? 'error' : '';
  $('cleanup-status').hidden = !message;
}

function dateAt(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function connected() { return accessToken && Date.now() < expiresAt - 30_000; }

function clearEvents() {
  events = [];
  selected.clear();
  $('event-panel').hidden = true;
  $('outlook-events').replaceChildren();
}

function eventSearchText(event) {
  return [event.subject, event.location?.displayName, event.organizer?.emailAddress?.name, event.organizer?.emailAddress?.address].filter(Boolean).join(' ').toLowerCase();
}

function visibleEvents() {
  const query = $('event-search').value.trim().toLowerCase();
  return query ? events.filter(event => eventSearchText(event).includes(query)) : events;
}

function formatGraphDate(value) {
  if (!value?.dateTime) return t('unknownTime');
  const raw = value.dateTime.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value.dateTime) ? value.dateTime : value.dateTime + 'Z';
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? dateTime.format(date) : t('unknownTime');
}

function badge(label, risk = false) {
  const item = document.createElement('span'); item.className = `event-badge${risk ? ' risk' : ''}`; item.textContent = label; return item;
}

function renderEvents() {
  const list = visibleEvents();
  $('outlook-events').replaceChildren();
  for (const event of list) {
    const row = document.createElement('article'); row.className = 'cleanup-event';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(event.id); check.setAttribute('aria-label', t('selectOutlookEvent', event.subject || t('untitledEvent')));
    check.addEventListener('change', () => { check.checked ? selected.add(event.id) : selected.delete(event.id); updateSelection(); });
    const main = document.createElement('div'); main.className = 'cleanup-event-main';
    const title = document.createElement('strong'); title.textContent = event.subject || t('untitledEvent');
    const meta = document.createElement('div'); meta.className = 'cleanup-event-meta';
    const range = document.createElement('span'); range.textContent = `${formatGraphDate(event.start)} – ${formatGraphDate(event.end)}`;
    const location = document.createElement('span'); location.textContent = event.location?.displayName || t('venueNotSpecified');
    const organizer = document.createElement('span'); organizer.textContent = event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || t('organizerUnknown');
    meta.append(range, location, organizer); main.append(title, meta);
    if (event.webLink) { const open = document.createElement('a'); open.href = event.webLink; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = t('openInOutlook'); main.append(open); }
    const flags = document.createElement('div'); flags.className = 'event-badges';
    const risk = eventRisk(event);
    flags.append(badge(risk.meeting ? t('meeting') : t('appointment')));
    if (risk.organizer) flags.append(badge(t('youOrganize'), true));
    else if (risk.meeting) flags.append(badge(t('invitation'), true));
    if (risk.recurring) flags.append(badge(t('recurring'), true));
    if (event.isCancelled) flags.append(badge(t('cancelled'), true));
    if (event.sensitivity && event.sensitivity !== 'normal') flags.append(badge(t('privateEvent'), true));
    row.append(check, main, flags); $('outlook-events').append(row);
  }
  $('event-summary').textContent = t('eventsShown', [String(list.length), String(events.length)]);
  updateSelection();
}

function updateSelection() {
  $('cleanup-selection').textContent = t('outlookSelected', String(selected.size));
  $('review-delete').disabled = busy || !selected.size;
}

async function connect() {
  if (busy) return;
  busy = true; $('connect-outlook').disabled = true; status(t('connectingMicrosoft'));
  try {
    const redirectUri = chrome.identity.getRedirectURL('outlook');
    const { verifier, challenge } = await createPkce();
    const state = crypto.randomUUID();
    const finalUrl = await chrome.identity.launchWebAuthFlow({ url: authorizationUrl({ clientId: config.clientId, redirectUri, state, challenge }), interactive: true });
    if (!finalUrl) throw new Error(t('microsoftSignInCancelled'));
    const result = new URL(finalUrl);
    if (result.searchParams.get('state') !== state) throw new Error(t('microsoftStateMismatch'));
    if (result.searchParams.get('error')) throw new Error(result.searchParams.get('error_description') || result.searchParams.get('error'));
    const code = result.searchParams.get('code');
    if (!code) throw new Error(t('microsoftNoCode'));
    ({ accessToken, expiresAt } = await exchangeCode({ clientId: config.clientId, redirectUri, code, verifier }));
    calendars = await loadCalendars(accessToken);
    if (!calendars.length) throw new Error(t('noWritableCalendars'));
    $('outlook-calendar').replaceChildren(...calendars.map(calendar => new Option(`${calendar.name}${calendar.isDefaultCalendar ? ` · ${t('defaultCalendar')}` : ''}`, calendar.id)));
    $('connect-panel').hidden = true; $('browser-panel').hidden = false; status(t('outlookConnected', String(calendars.length)));
  } catch (error) {
    accessToken = ''; expiresAt = 0; status(error.message || t('microsoftConnectionFailed'), true);
  } finally { busy = false; $('connect-outlook').disabled = false; }
}

async function load() {
  if (busy) return;
  if (!connected()) { disconnect(); status(t('microsoftSessionExpired'), true); return; }
  busy = true; $('load-outlook-events').disabled = true; status(t('loadingOutlookEvents'));
  try {
    const result = await loadEvents({ calendarId: $('outlook-calendar').value, startDate: $('range-start').value, endDate: $('range-end').value, token: accessToken });
    events = result.events.filter(event => !event.isCancelled).map(({ attendees, ...event }) => ({ ...event, attendeeCount: Array.isArray(attendees) ? attendees.length : 0 }));
    selected.clear(); $('event-panel').hidden = false; renderEvents();
    status(result.truncated ? t('eventsTruncated', String(events.length)) : events.length ? t('eventsLoaded', String(events.length)) : t('noOutlookEvents'));
  } catch (error) { status(error.message, true); }
  finally { busy = false; $('load-outlook-events').disabled = false; updateSelection(); }
}

function disconnect() {
  accessToken = ''; expiresAt = 0; calendars = []; clearEvents();
  $('browser-panel').hidden = true; $('connect-panel').hidden = false; status(t('outlookDisconnected'));
}

function reviewDeletion() {
  const chosen = events.filter(event => selected.has(event.id));
  if (!chosen.length) return;
  $('delete-summary').textContent = t('deleteSummary', String(chosen.length));
  const risks = chosen.map(eventRisk), organizerCount = risks.filter(risk => risk.organizer).length, recurringCount = risks.filter(risk => risk.recurring).length;
  const riskMessages = [];
  if (organizerCount) riskMessages.push(t('organizerDeleteRisk', String(organizerCount)));
  if (recurringCount) riskMessages.push(t('recurringDeleteRisk', String(recurringCount)));
  $('delete-risk').textContent = riskMessages.join('\n'); $('delete-risk').hidden = !riskMessages.length;
  $('delete-preview').replaceChildren(...chosen.slice(0, 12).map(event => { const item = document.createElement('li'); item.textContent = `${event.subject || t('untitledEvent')} · ${formatGraphDate(event.start)}`; return item; }));
  if (chosen.length > 12) { const item = document.createElement('li'); item.textContent = t('moreEvents', String(chosen.length - 12)); $('delete-preview').append(item); }
  $('confirm-delete').checked = false; $('delete-events').disabled = true; $('delete-dialog').showModal();
}

async function removeSelected() {
  if (busy || !$('confirm-delete').checked) return;
  const chosen = events.filter(event => selected.has(event.id));
  busy = true; $('delete-events').disabled = true; status(t('deletingEvents', String(chosen.length)));
  try {
    const results = await deleteEvents(chosen, accessToken);
    const removed = new Set(results.filter(result => result.ok).map(result => result.event.id));
    const failures = results.filter(result => !result.ok);
    events = events.filter(event => !removed.has(event.id)); selected = new Set(failures.map(result => result.event.id));
    $('delete-dialog').close(); renderEvents();
    status(t('deletionResult', [String(removed.size), String(failures.length)]), failures.length > 0);
    if (failures.length) status(`${t('deletionResult', [String(removed.size), String(failures.length)])}\n${[...new Set(failures.map(result => result.message || `HTTP ${result.status}`))].join('\n')}`, true);
  } catch (error) { status(error.message, true); }
  finally { busy = false; updateSelection(); }
}

async function init() {
  const data = await chrome.storage.local.get('outlookCleanup'); config = data.outlookCleanup;
  if (!config?.enabled || !config?.clientId) { $('connect-outlook').disabled = true; status(t('cleanupNotActivated'), true); return; }
  $('range-start').value = dateAt(-30); $('range-end').value = dateAt(180);
  $('connect-outlook').addEventListener('click', connect);
  $('disconnect-outlook').addEventListener('click', disconnect);
  $('load-outlook-events').addEventListener('click', load);
  $('event-search').addEventListener('input', renderEvents);
  $('select-visible').addEventListener('click', () => { visibleEvents().forEach(event => selected.add(event.id)); renderEvents(); });
  $('clear-outlook-selection').addEventListener('click', () => { selected.clear(); renderEvents(); });
  $('review-delete').addEventListener('click', reviewDeletion);
  $('confirm-delete').addEventListener('change', () => { $('delete-events').disabled = !$('confirm-delete').checked || busy; });
  $('delete-events').addEventListener('click', removeSelected);
}

init().catch(error => status(error.message, true));
