import { normalizeEvent } from './lib/calendar.mjs';
import { normalizeBatch } from './lib/batch.mjs';

const storageReady = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
]);

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['PDC_OPEN_EVENT', 'PDC_OPEN_BATCH'].includes(message?.type)) return;
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || new URL(sender.url || 'about:blank').origin !== 'https://pdc.hkust-gz.edu.cn') {
    respond({ error: 'This action is only available on the PDC website.' });
    return;
  }
  (async () => {
    await storageReady;
    const batch = message.type === 'PDC_OPEN_BATCH';
    const draft = batch ? await normalizeBatch(message.events) : { event: await normalizeEvent(message.event) };
    const id = crypto.randomUUID();
    const stored = await chrome.storage.session.get(null);
    const stale = Object.entries(stored).filter(([key, value]) => key.startsWith('draft:') && Date.now() - value.created > 86400000).map(([key]) => key);
    if (stale.length) await chrome.storage.session.remove(stale);
    await chrome.storage.session.set({ [`draft:${id}`]: { ...draft, created: Date.now() } });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`${batch ? 'batch' : 'event'}.html?id=${id}`) });
    respond({ ok: true });
  })().catch(error => respond({ error: error.message || 'Could not prepare the calendar event.' }));
  return true;
});
