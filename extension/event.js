import { makeICS, providerURL, calendarURL } from './lib/calendar.mjs';
import { addToNextcloud } from './lib/caldav.mjs';

const $ = id => document.getElementById(id);
const formatDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const formatTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
let event, busy = false;
const selected = () => event.sessions.filter((_, i) => $(`session-${i}`).checked);

function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; $('status').hidden = !text; }

function renderProvider() {
  const provider = $('provider').value;
  const web = ['google', 'outlook-school', 'outlook-personal'].includes(provider);
  const outlookBatch = provider.startsWith('outlook') && selected().length > 1;
  $('reminder').disabled = web && !outlookBatch;
  $('provider-help').textContent = provider === 'nextcloud' ? 'Adds selected sessions to the calendar in Settings. Identical sessions already added by this extension are skipped.' : provider === 'ics' ? 'Import this file into Outlook, Apple Calendar, Thunderbird, Nextcloud, or another calendar app.' : 'Opens a prefilled event. Review it and click Save in your calendar. Set reminders there. For multiple sessions, open each one or import a single .ics file.';
  $('add').textContent = provider === 'ics' ? 'Download selected sessions' : provider === 'nextcloud' ? 'Add selected sessions' : 'Open in calendar';
  if (outlookBatch) {
    $('add').textContent = 'Download for Outlook';
    $('provider-help').textContent = 'Download the selected sessions together, then import the file once in Outlook.';
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
    status(`Calendar file prepared for ${sessions.length} session(s). Import it into your calendar to finish. Repeated imports may create duplicates.`);
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
    if (sessions.length !== 1) { status('Use each session’s Open link, or download all sessions as one .ics file.', true); return; }
    await chrome.tabs.create({ url: providerURL(provider, event, sessions[0]) });
    status('Opened your calendar. Review the event and save it there. The extension cannot confirm whether you saved it.');
    return;
  }
  busy = true; renderProvider();
  try {
    const { nextcloud } = await chrome.storage.local.get('nextcloud');
    if (!nextcloud?.appPassword) throw new Error('Connect your Nextcloud calendar in Settings first, then return here.');
    const origin = new URL(calendarURL(nextcloud.calendarUrl)).origin + '/*';
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error('Access to your Nextcloud server is missing. Reconnect it in Settings.');
    status('Adding sessions to Nextcloud…');
    const result = await addToNextcloud(nextcloud, event, selected(), Number($('reminder').value));
    status(`${result.added} added · ${result.existing} already present · ${result.failed} failed.${result.errors.length ? '\n' + result.errors.join('\n') + '\nYou can retry; successfully added sessions will be skipped.' : ''}`, result.failed > 0);
  } catch (error) { status(error.message, true); }
  finally { busy = false; renderProvider(); }
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  const draft = (await chrome.storage.session.get(`draft:${id}`))[`draft:${id}`];
  if (!draft || Date.now() - draft.created > 86400000) throw new Error('This preview has expired. Return to the source page and click Add to calendar again.');
  event = draft.event;
  const { preferences: prefs } = await chrome.storage.local.get('preferences');
  if (prefs && [...$('provider').options].some(option => option.value === prefs.provider)) $('provider').value = prefs.provider;
  if (prefs && [...$('reminder').options].some(option => option.value === String(prefs.reminder))) $('reminder').value = String(prefs.reminder);
  $('title').textContent = event.title;
  $('subtitle').textContent = `${event.sourceName || 'Calendar'} event ${event.code}`;
  $('count').textContent = String(event.sessions.length);
  $('description').textContent = event.description;
  for (const [index, session] of event.sessions.entries()) {
    const row = document.createElement('div'); row.className = 'session';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = true; check.id = `session-${index}`;
    const label = document.createElement('label'); label.htmlFor = check.id;
    const date = document.createElement('strong'); date.textContent = formatDate.format(new Date(session.start));
    const detail = document.createElement('span'); detail.textContent = `${formatTime.format(new Date(session.start))} – ${formatTime.format(new Date(session.end))}`;
    const venue = document.createElement('small'); venue.textContent = session.location || 'Venue not yet specified';
    label.append(date, detail, venue);
    const link = document.createElement('a'); link.id = `open-${index}`; link.textContent = 'Open this session ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => status('Review and save the event in the calendar tab. Reopening a session may create a duplicate.'));
    check.addEventListener('change', renderProvider);
    row.append(check, label, link); $('sessions').append(row);
  }
  $('provider').addEventListener('change', () => { $('outlook-import').hidden = true; renderProvider(); preferences().catch(error => status(error.message, true)); });
  $('reminder').addEventListener('change', () => preferences().catch(error => status(error.message, true)));
  $('download').addEventListener('click', download);
  $('add').addEventListener('click', () => add().catch(error => status(error.message, true)));
  $('content').hidden = false; renderProvider();
}
init().catch(error => { $('title').textContent = 'Could not open this event'; $('subtitle').hidden = true; $('fatal').textContent = error.message; $('fatal').hidden = false; });
