import { calendarURL } from './lib/calendar.mjs';
import { basicAuth } from './lib/caldav.mjs';
const { t, localizeDocument } = globalThis.Add2CalendarI18n;
localizeDocument();
const $ = id => document.getElementById(id);
let saved;
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; $('status').hidden = !text; }

async function load() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const data = await chrome.storage.local.get(['preferences', 'nextcloud']);
  saved = data.nextcloud;
  if (data.preferences) {
    if ([...$('provider').options].some(o => o.value === data.preferences.provider)) $('provider').value = data.preferences.provider;
    if ([...$('reminder').options].some(o => o.value === String(data.preferences.reminder))) $('reminder').value = String(data.preferences.reminder);
  }
  $('calendar-url').value = saved?.calendarUrl || '';
  $('username').value = saved?.username || '';
  $('app-password').value = '';
  $('password-help').textContent = saved?.appPassword ? t('savedAppPassword') : t('separateAppPassword');
  $('disconnect').disabled = !saved;
}

$('save-preferences').addEventListener('click', async () => {
  try { await chrome.storage.local.set({ preferences: { provider: $('provider').value, reminder: Number($('reminder').value) } }); status(t('preferencesSaved')); }
  catch (error) { status(error.message, true); }
});

$('nextcloud-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const url = calendarURL($('calendar-url').value.trim());
    const username = $('username').value.trim();
    const sameAccount = saved && new URL(saved.calendarUrl).origin === new URL(url).origin && saved.username === username;
    const appPassword = $('app-password').value || (sameAccount ? saved.appPassword : '');
    basicAuth(username, appPassword);
    // Request directly from this user gesture, before any asynchronous storage calls.
    const granted = await chrome.permissions.request({ origins: [new URL(url).origin + '/*'] });
    if (!granted) throw new Error(t('accessNotGranted'));
    const previous = saved;
    await chrome.storage.local.set({ nextcloud: { calendarUrl: url, username, appPassword } });
    if (previous && new URL(previous.calendarUrl).origin !== new URL(url).origin)
      await chrome.permissions.remove({ origins: [new URL(previous.calendarUrl).origin + '/*'] });
    await load();
    status(t('connectionSaved'));
  } catch (error) { status(error.message, true); }
});

$('disconnect').addEventListener('click', async () => {
  try {
    const previous = saved;
    await chrome.storage.local.remove('nextcloud');
    if (previous) await chrome.permissions.remove({ origins: [new URL(previous.calendarUrl).origin + '/*'] });
    await load();
    status(t('connectionForgotten'));
  } catch (error) { status(error.message, true); }
});
load().catch(error => status(error.message, true));
