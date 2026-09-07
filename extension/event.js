import { makeICS, providerURL, calendarURL } from './lib/calendar.mjs';
import { addToNextcloud } from './lib/caldav.mjs';
const { t, localizeDocument } = globalThis.Add2CalendarI18n;
localizeDocument();

const $ = id => document.getElementById(id);
const locale = chrome.i18n.getUILanguage();
const formatDate = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Shanghai', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const formatTime = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
let event, busy = false;
const selected = () => event.sessions.filter((_, i) => $(`session-${i}`).checked);

function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; $('status').hidden = !text; }

function venueChoice(session, id) {
  if (!Array.isArray(session.locationOptions) || session.locationOptions.length < 2) return null;
  const wrap = document.createElement('div'); wrap.className = 'venue-choice';
  const warning = document.createElement('strong'); warning.textContent = t('multipleVenues');
  const select = document.createElement('select'); select.id = id; select.setAttribute('aria-label', t('chooseVenue'));
  const combined = session.locationOptions.join(' / ');
  select.append(new Option(t('combineVenues', combined), combined));
  for (const location of session.locationOptions) select.append(new Option(location, location));
  select.value = combined;
  select.addEventListener('change', () => { session.location = select.value; });
  wrap.append(warning, select);
  return wrap;
}

function renderProvider() {
  const provider = $('provider').value;
  const web = ['google', 'outlook-school', 'outlook-personal'].includes(provider);
  const outlookBatch = provider.startsWith('outlook') && selected().length > 1;
  $('reminder').disabled = web && !outlookBatch;
  $('provider-help').textContent = provider === 'nextcloud' ? t('providerNextcloudHelp') : provider === 'ics' ? t('providerIcsHelp') : t('providerWebHelp');
  $('add').textContent = provider === 'ics' ? t('downloadSelectedSessions') : provider === 'nextcloud' ? t('addSelectedSessions') : t('openInCalendar');
  if (outlookBatch) {
    $('add').textContent = t('downloadForOutlook');
    $('provider-help').textContent = t('outlookMultipleHelp');
  }
  $('add').disabled = busy || selected().length === 0 || (web && selected().length !== 1 && !outlookBatch);
  $('download').disabled = busy || selected().length === 0;
  for (const [index, session] of event.sessions.entries()) {
    const link = $(`open-${index}`);
    link.hidden = !web;
    if (web) link.href = providerURL(provider, event, session);
  }
}

async function preferences() {
  await chrome.storage.local.set({ preferences: { provider: $('provider').value, reminder: Number($('reminder').value) } });
}

function download() {
  try {
    const sessions = selected();
    const url = URL.createObjectURL(new Blob([makeICS(event, sessions, Number($('reminder').value))], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.sourceName || 'Add2Calendar'}-${event.code.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status(t('calendarFilePrepared', String(sessions.length)));
    if ($('provider').value.startsWith('outlook')) {
      $('open-outlook').href = $('provider').value === 'outlook-school' ? 'https://outlook.office.com/calendar/' : 'https://outlook.live.com/calendar/';
      $('outlook-import').hidden = false;
    }
  } catch (error) { status(error.message, true); }
}

async function add() {
  const provider = $('provider').value;
  if (provider === 'ics') { download(); return; }
  if (provider.startsWith('outlook') && selected().length > 1) { download(); return; }
  if (provider !== 'nextcloud') {
    const sessions = selected();
    if (sessions.length !== 1) { status(t('openEachSession'), true); return; }
    await chrome.tabs.create({ url: providerURL(provider, event, sessions[0]) });
    status(t('calendarOpened'));
    return;
  }
  busy = true; renderProvider();
  try {
    const { nextcloud } = await chrome.storage.local.get('nextcloud');
    if (!nextcloud?.appPassword) throw new Error(t('connectNextcloudFirst'));
    const origin = new URL(calendarURL(nextcloud.calendarUrl)).origin + '/*';
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error(t('nextcloudAccessMissing'));
    status(t('addingToNextcloud'));
    const result = await addToNextcloud(nextcloud, event, selected(), Number($('reminder').value));
    status(`${t('nextcloudResult', [String(result.added), String(result.existing), String(result.failed)])}${result.errors.length ? '\n' + result.errors.join('\n') + '\n' + t('retrySkipsAdded') : ''}`, result.failed > 0);
  } catch (error) { status(error.message, true); }
  finally { busy = false; renderProvider(); }
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  const draft = (await chrome.storage.session.get(`draft:${id}`))[`draft:${id}`];
  if (!draft || Date.now() - draft.created > 86400000) throw new Error(t('previewExpired'));
  event = draft.event;
  const { preferences: prefs } = await chrome.storage.local.get('preferences');
  if (prefs && [...$('provider').options].some(option => option.value === prefs.provider)) $('provider').value = prefs.provider;
  if (prefs && [...$('reminder').options].some(option => option.value === String(prefs.reminder))) $('reminder').value = String(prefs.reminder);
  $('title').textContent = event.title;
  $('subtitle').textContent = t('sourceEvent', [event.sourceName || t('calendar'), event.code]);
  $('count').textContent = String(event.sessions.length);
  $('description').textContent = event.description;
  for (const [index, session] of event.sessions.entries()) {
    const row = document.createElement('div'); row.className = 'session';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = true; check.id = `session-${index}`;
    const label = document.createElement('label'); label.htmlFor = check.id;
    const date = document.createElement('strong'); date.textContent = formatDate.format(new Date(session.start));
    const detail = document.createElement('span'); detail.textContent = `${formatTime.format(new Date(session.start))} – ${formatTime.format(new Date(session.end))}`;
    const venue = document.createElement('small'); venue.textContent = session.locationOptions?.length > 1 ? t('chooseVenueHint') : session.location || t('venueNotSpecified');
    label.append(date, detail, venue);
    const link = document.createElement('a'); link.id = `open-${index}`; link.textContent = t('openThisSession'); link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => status(t('reviewSaveReminder')));
    check.addEventListener('change', renderProvider);
    row.append(check, label);
    const choice = venueChoice(session, `venue-${index}`); if (choice) row.append(choice);
    row.append(link); $('sessions').append(row);
  }
  $('provider').addEventListener('change', () => { $('outlook-import').hidden = true; renderProvider(); preferences().catch(error => status(error.message, true)); });
  $('reminder').addEventListener('change', () => preferences().catch(error => status(error.message, true)));
  $('download').addEventListener('click', download);
  $('add').addEventListener('click', () => add().catch(error => status(error.message, true)));
  $('content').hidden = false; renderProvider();
}
init().catch(error => { $('title').textContent = t('couldNotOpenEvent'); $('subtitle').hidden = true; $('fatal').textContent = error.message; $('fatal').hidden = false; });
