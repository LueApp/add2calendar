import { makeCalendarICS, calendarURL } from './lib/calendar.mjs';
import { selectSessions } from './lib/batch.mjs';
import { addToNextcloud } from './lib/caldav.mjs';

const $ = id => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
let events = [], busy = false;
const sessionBoxes = new Map(), eventBoxes = new Map();
const selected = () => events.map(event => ({ event, sessions: event.sessions.filter(session => sessionBoxes.get(session.uid).checked) })).filter(entry => entry.sessions.length);
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; $('status').hidden = !message; }

function update() {
  const entries = selected(), count = entries.reduce((total, entry) => total + entry.sessions.length, 0);
  const provider = $('provider').value;
  $('selection-count').textContent = `${entries.length} event(s) · ${count} session(s) selected`;
  $('add').textContent = provider === 'nextcloud' ? 'Add batch to Nextcloud' : provider.startsWith('outlook') ? 'Download for Outlook' : provider === 'google' ? 'Download for Google Calendar' : 'Download calendar file';
  $('add').disabled = busy || count === 0;
  $('provider-help').textContent = provider === 'nextcloud' ? 'Adds the selected sessions directly to your configured calendar. Previously added identical sessions are skipped.' : provider.startsWith('outlook') ? 'One .ics file for every selected event. In Outlook, import that file once to add the whole batch.' : provider === 'google' ? 'One .ics file for the selected events. Import it once in Google Calendar’s settings.' : 'One .ics file for all selected sessions, ready to import into your calendar app.';
  $('provider').disabled = busy;
  $('reminder').disabled = busy;
  for (const id of ['select-upcoming', 'select-all', 'select-none']) $(id).disabled = busy;
  for (const box of sessionBoxes.values()) box.disabled = busy;
  for (const event of events) {
    const box = eventBoxes.get(event.code), checked = event.sessions.filter(session => sessionBoxes.get(session.uid).checked).length;
    box.checked = checked === event.sessions.length;
    box.indeterminate = checked > 0 && checked < event.sessions.length;
    box.disabled = busy;
  }
}

function selectMode(mode) {
  const ids = selectSessions(events, mode);
  for (const [uid, box] of sessionBoxes) box.checked = ids.has(uid);
  update();
}

function showImportGuide(provider) {
  $('import-guide').hidden = !provider.startsWith('outlook') && provider !== 'google';
  if (provider.startsWith('outlook')) {
    $('import-title').textContent = 'Import this batch once in Outlook';
    $('import-steps').textContent = 'Calendar → Add calendar → Upload from file → choose the downloaded .ics file → select your calendar → Import (or Import and Save). All selected sessions are included in that one import.';
    $('open-calendar').textContent = 'Open Outlook ↗';
    $('open-calendar').href = provider === 'outlook-school' ? 'https://outlook.office.com/calendar/' : 'https://outlook.live.com/calendar/';
  } else if (provider === 'google') {
    $('import-title').textContent = 'Import this batch once in Google Calendar';
    $('import-steps').textContent = 'Settings → Import & export → choose the downloaded .ics file → select your calendar → Import.';
    $('open-calendar').textContent = 'Open Google Calendar ↗';
    $('open-calendar').href = 'https://calendar.google.com/calendar/u/0/r/settings/export';
  }
}

async function add() {
  const entries = selected();
  if (!entries.length) return;
  const provider = $('provider').value, reminder = Number($('reminder').value);
  if (provider !== 'nextcloud') {
    const count = entries.reduce((n, entry) => n + entry.sessions.length, 0);
    const url = URL.createObjectURL(new Blob([makeCalendarICS(entries, reminder)], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `PDC-events-${new Date().toISOString().slice(0, 10)}.ics`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status(`File prepared: ${entries.length} event(s), ${count} session(s). Import it into your calendar to finish.`);
    showImportGuide(provider);
    return;
  }
  busy = true; update();
  try {
    const { nextcloud } = await chrome.storage.local.get('nextcloud');
    if (!nextcloud?.appPassword) throw new Error('Connect your Nextcloud calendar in Settings first, then return here.');
    const origin = new URL(calendarURL(nextcloud.calendarUrl)).origin + '/*';
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error('Access to your Nextcloud server is missing. Reconnect it in Settings.');
    const total = { added: 0, existing: 0, failed: 0 }, errors = new Set();
    for (const [index, { event, sessions }] of entries.entries()) {
      status(`Adding event ${index + 1} of ${entries.length}…`);
      const result = await addToNextcloud(nextcloud, event, sessions, reminder);
      for (const key of Object.keys(total)) total[key] += result[key];
      for (const error of result.errors) errors.add(error);
      if (result.stop) {
        total.failed += entries.slice(index + 1).reduce((count, entry) => count + entry.sessions.length, 0);
        break;
      }
    }
    status(`${total.added} added · ${total.existing} already present · ${total.failed} failed.${errors.size ? '\n' + [...errors].join('\n') + '\nRetrying skips sessions already added.' : ''}`, total.failed > 0);
  } catch (error) { status(error.message, true); }
  finally { busy = false; update(); }
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  const draft = (await chrome.storage.session.get(`draft:${id}`))[`draft:${id}`];
  if (!draft?.events || Date.now() - draft.created > 86400000) throw new Error('This batch preview has expired. Return to PDC and click Add multiple events again.');
  events = draft.events;
  const { preferences: prefs } = await chrome.storage.local.get('preferences');
  if (prefs && [...$('provider').options].some(option => option.value === prefs.provider)) $('provider').value = prefs.provider;
  if (prefs && [...$('reminder').options].some(option => option.value === String(prefs.reminder))) $('reminder').value = String(prefs.reminder);
  $('subtitle').textContent = `${events.length} enrolled event(s) available across all PDC enrollment pages.`;
  for (const [index, event] of events.entries()) {
    const section = document.createElement('section'); section.className = 'batch-event';
    const header = document.createElement('div'); header.className = 'batch-event-header';
    const check = document.createElement('input'); check.type = 'checkbox'; check.id = `event-${index}`; eventBoxes.set(event.code, check);
    const label = document.createElement('label'); label.htmlFor = check.id;
    const title = document.createElement('strong'); title.textContent = event.title;
    const code = document.createElement('small'); code.textContent = `${event.code} · ${event.sessions.length} session(s)`;
    label.append(title, code); header.append(check, label); section.append(header);
    check.addEventListener('change', () => { for (const session of event.sessions) sessionBoxes.get(session.uid).checked = check.checked; update(); });
    for (const [sessionIndex, session] of event.sessions.entries()) {
      const row = document.createElement('div'); row.className = 'session';
      const input = document.createElement('input'); input.type = 'checkbox'; input.id = `session-${index}-${sessionIndex}`; sessionBoxes.set(session.uid, input);
      const sessionLabel = document.createElement('label'); sessionLabel.htmlFor = input.id;
      const date = document.createElement('strong'); date.textContent = dateFormat.format(new Date(session.start));
      const time = document.createElement('span'); time.textContent = `${timeFormat.format(new Date(session.start))} – ${timeFormat.format(new Date(session.end))}`;
      const venue = document.createElement('small'); venue.textContent = session.location || 'Venue not yet specified';
      sessionLabel.append(date, time, venue); row.append(input, sessionLabel); section.append(row);
      input.addEventListener('change', update);
    }
    $('events').append(section);
  }
  for (const error of draft.errors || []) {
    const item = document.createElement('li'); item.textContent = `${error.title || error.code || 'Unnamed event'}: ${error.message}`; $('errors').append(item);
  }
  $('unavailable').hidden = !draft.errors?.length;
  for (const mode of ['upcoming', 'all', 'none']) $(`select-${mode}`).addEventListener('click', () => selectMode(mode));
  $('provider').addEventListener('change', () => { $('import-guide').hidden = true; update(); });
  $('add').addEventListener('click', () => add().catch(error => status(error.message, true)));
  $('content').hidden = false; selectMode('upcoming');
}
init().catch(error => { $('fatal').textContent = error.message; $('fatal').hidden = false; });
