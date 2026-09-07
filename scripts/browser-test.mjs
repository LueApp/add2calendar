import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seminar, series } from '../tests/fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results');
await mkdir(output, { recursive: true });
const extension = process.env.PDC_TEST_EXTENSION_PATH || path.join(root, 'extension');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1200, height: 1000 },
  ...(process.env.PDC_TEST_CHROMIUM_PATH ? { executablePath: process.env.PDC_TEST_CHROMIUM_PATH } : {}),
  timezoneId: 'America/New_York',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
context.setDefaultTimeout(12000);
const errors = [], writes = [], unexpected = [];
let enrolled = [seminar], denyPdc = false, denyNextcloud = false, readRequests = 0;
const stored = new Set();
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const row = (event, registered) => `<tr data-row-key="${event.activityEventCode}"><td>${event.description}</td><td>10 Sep 2026</td><td>14:30 – 16:00</td><td><button class="enroll" ${registered ? 'disabled' : ''}>Enroll</button><button class="drop" ${registered ? '' : 'disabled'}>Drop</button></td></tr><tr data-row-key="${event.activityEventCode}-remark-row"><td colspan="4">Remarks</td></tr>`;
const html = () => `<!doctype html><html><head><title>PDC test fixture</title><style>body{font:14px system-ui;margin:40px}td{padding:20px;border-bottom:1px solid #ddd}table{width:100%;border-collapse:collapse}button{margin:4px}</style></head><body><h1>Enrollment Records — synthetic test data</h1><table><tbody>${row(seminar, true)}${row(series, enrolled.length > 1)}</tbody></table><script>sessionStorage.setItem('auth-token','synthetic-test-token');</script></body></html>`;
const sisCourse = {
  classId: 'SYNTHETIC-CLASS-101', classNbr: '1234', classSection: 'L1', subjectArea: 'COMP', catalogNbr: '5001',
  crseShortDesc: 'Synthetic Systems Seminar', enrollmentStatus: 'enrolSuccess', enrollmentStatusEnDesc: 'Enrolled',
  meetingInfoList: [{ startDate: '2026-09-07', endDate: '2026-09-18', weekDay: '1,3', meetingStartTime: '10:00', meetingEndTime: '11:30', facilityName: 'Synthetic Room 101', instructorList: [{ instructorName: 'Dr. Example', instructorRoleInd: 'PI' }] }]
};
const sisHtml = `<!doctype html><html><head><title>SIS test fixture</title></head><body><main><h1>My Class Schedule</h1></main><script>fetch('/api/student/queryMyClassSchedulePage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({synthetic:true})});</script></body></html>`;

await context.route('https://**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.hostname === 'pdc.hkust-gz.edu.cn') {
    if (url.pathname === '/api/pdc-student/user-event-enrollment/page') {
      readRequests++;
      assert.equal(request.method(), 'POST');
      assert.equal(request.headers().authorization, 'Bearer synthetic-test-token');
      if (denyPdc) { await route.fulfill({ status: 401, json: { error: 'expired' } }); return; }
      const { pagination } = request.postDataJSON();
      // Force real pagination: the server returns one enrollment per page.
      const records = enrolled.slice(pagination.current - 1, pagination.current).map(event => ({ activityEventCode: event.activityEventCode, event, userEmpId: 'MUST-NOT-LEAVE-CONTENT-SCRIPT' }));
      await route.fulfill({ json: { code: 200, data: { userEventEnrollments: records, pagination: { current: pagination.current, pageSize: 1, total: enrolled.length } } } });
      return;
    }
    if (['/enrollment-records', '/event-enrollment'].includes(url.pathname)) { await route.fulfill({ contentType: 'text/html', body: html() }); return; }
    if (url.pathname === '/favicon.ico') { await route.fulfill({ status: 204 }); return; }
  }
  if (url.hostname === 'sisn.hkust-gz.edu.cn') {
    if (url.pathname === '/classes/my-class-schedule') { await route.fulfill({ contentType: 'text/html', body: sisHtml }); return; }
    if (url.pathname === '/api/student/queryMyClassSchedulePage') {
      assert.equal(request.method(), 'POST');
      await route.fulfill({ json: { code: '0', data: [sisCourse, { ...sisCourse, classId: 'WAITLISTED', enrollmentStatus: 'waitlistSuccess', enrollmentStatusEnDesc: 'Waitlisted' }] } });
      return;
    }
    if (url.pathname === '/favicon.ico') { await route.fulfill({ status: 204 }); return; }
  }
  if (['outlook.office.com', 'outlook.live.com', 'calendar.google.com'].includes(url.hostname)) {
    await route.fulfill({ contentType: 'text/html', body: '<h1>Calendar provider test destination</h1>' }); return;
  }
  if (url.hostname === 'cloud.example.com') {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,content-type,if-none-match' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    assert.equal(request.method(), 'PUT');
    assert.equal(request.headers()['if-none-match'], '*');
    assert.equal(request.headers().authorization, 'Basic ' + Buffer.from('test:synthetic-password').toString('base64'));
    writes.push(request.postData());
    if (denyNextcloud) { await route.fulfill({ status: 401, headers }); return; }
    const status = stored.has(url.href) ? 412 : 201;
    stored.add(url.href);
    await route.fulfill({ status, headers }); return;
  }
  unexpected.push(url.href); await route.abort();
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const pdc = await context.newPage();
  await pdc.goto('https://pdc.hkust-gz.edu.cn/enrollment-records');
  await pdc.locator('.pdc-calendar-action').first().waitFor();
  assert.equal(await pdc.locator('.pdc-calendar-action').count(), 1);
  assert.equal(await pdc.locator('tr[data-row-key$="-remark-row"] .pdc-calendar-action').count(), 0);
  console.log('PASS: actual content script adds buttons only to enrolled event rows');

  const opened = context.waitForEvent('page');
  await pdc.locator('.pdc-calendar-action').first().click();
  const preview = await opened;
  await preview.locator('#content:not([hidden])').waitFor();
  assert.equal(await preview.locator('h1').textContent(), seminar.description);
  assert.match(await preview.locator('#sessions').textContent(), /14:30 – 16:00/);
  assert.equal(await preview.locator('.session').count(), 1);
  const drafts = await worker.evaluate(() => chrome.storage.session.get(null));
  assert.ok(!JSON.stringify(drafts).includes('MUST-NOT-LEAVE'));
  assert.ok(!JSON.stringify(drafts).includes('synthetic-test-token'));
  await preview.screenshot({ path: path.join(output, 'event-preview.png'), fullPage: true });
  console.log('PASS: authenticated read → background validation → real extension preview; China times remain correct in a US browser timezone');

  const downloadEvent = preview.waitForEvent('download');
  await preview.locator('#download').click();
  const download = await downloadEvent;
  const file = path.join(output, download.suggestedFilename());
  await download.saveAs(file);
  const ics = await readFile(file, 'utf8');
  assert.match(ics, /DTSTART:20260910T063000Z/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  console.log('PASS: .ics download contains the selected event with absolute times');

  // tabs.create can navigate a new target before Playwright attaches its routes.
  // Capture provider handoffs at the Chrome API boundary to keep tests offline.
  await preview.evaluate(() => { chrome.tabs.create = async options => { globalThis.calendarHandoff = options.url; return { id: 999 }; }; });
  for (const [provider, host] of [['outlook-school', 'outlook.office.com'], ['outlook-personal', 'outlook.live.com'], ['google', 'calendar.google.com']]) {
    await preview.selectOption('#provider', provider);
    await preview.evaluate(() => { globalThis.calendarHandoff = null; });
    await preview.locator('#add').click();
    await preview.waitForFunction(() => !!globalThis.calendarHandoff);
    const target = new URL(await preview.evaluate(() => globalThis.calendarHandoff));
    assert.equal(target.host, host);
    assert.equal(target.searchParams.get(provider === 'google' ? 'text' : 'subject'), seminar.description);
  }
  console.log('PASS: school Outlook, personal Outlook and Google hand off distinct prefilled URLs (tab API captured)');

  await preview.selectOption('#provider', 'nextcloud');
  await preview.locator('#add').click();
  await preview.waitForFunction(() => document.getElementById('status').textContent.includes('Settings first'));
  assert.equal(writes.length, 0);
  console.log('PASS: Nextcloud requires setup before attempting any calendar writes');

  await preview.evaluate(async () => {
    await chrome.storage.local.set({ nextcloud: { calendarUrl: 'https://cloud.example.com/remote.php/dav/calendars/test/pdc/', username: 'test', appPassword: 'synthetic-password' } });
    // Mock only the permission decision. All serialization and HTTP calls use production code.
    chrome.permissions.contains = async () => true;
  });
  await preview.locator('#add').click();
  await preview.waitForFunction(() => document.getElementById('status').textContent.includes('1 added'));
  await preview.locator('#add').click();
  await preview.waitForFunction(() => document.getElementById('status').textContent.includes('1 already present'));
  assert.equal(stored.size, 1);
  assert.ok(writes.every(body => !body.includes('synthetic-password') && !body.includes('synthetic-test-token')));
  console.log('PASS: Nextcloud preview sends conditional CalDAV writes and repeated clicks skip existing sessions (mock server/permission)');

  // Simulate a successful new enrollment using the same table updates PDC renders.
  enrolled = [seminar, series];
  await pdc.locator(`tr[data-row-key="${series.activityEventCode}"] .enroll`).evaluate(button => button.disabled = true);
  await pdc.locator(`tr[data-row-key="${series.activityEventCode}"] .drop`).evaluate(button => button.disabled = false);
  await pdc.waitForFunction(() => document.querySelectorAll('.pdc-calendar-action').length === 2);
  const seriesOpened = context.waitForEvent('page');
  await pdc.locator(`tr[data-row-key="${series.activityEventCode}"] .pdc-calendar-action`).click();
  const multi = await seriesOpened;
  await multi.locator('#content:not([hidden])').waitFor();
  assert.equal(await multi.locator('.session').count(), 4);
  await multi.selectOption('#provider', 'outlook-school');
  assert.equal(await multi.locator('#add').isDisabled(), false);
  assert.equal(await multi.locator('#add').textContent(), 'Download for Outlook');
  assert.equal(await multi.locator('.session a:visible').count(), 4);
  await multi.screenshot({ path: path.join(output, 'multiple-sessions.png'), fullPage: true });
  const multiDownloadPromise = multi.waitForEvent('download');
  await multi.locator('#add').click();
  const multiDownload = await multiDownloadPromise;
  const multiFile = path.join(output, multiDownload.suggestedFilename());
  await multiDownload.saveAs(multiFile);
  assert.equal(((await readFile(multiFile, 'utf8')).match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.equal(await multi.locator('#outlook-import').isVisible(), true);
  console.log('PASS: new enrollment creates its button; server pagination is read; all four recurring sessions are exported');

  // A different enrollment is on another PDC table page; its API data must still be included.
  enrolled = [seminar, series, { ...seminar, activityEventCode: 'PDC-INVALID-SCHEDULE', description: 'Awaiting a confirmed schedule', eventSchedules: [{ ...seminar.eventSchedules[0], minuteBegin: null }] }];
  await pdc.locator(`tr[data-row-key="${series.activityEventCode}"]`).evaluate(row => row.remove());
  const batchOpened = context.waitForEvent('page');
  await pdc.locator('.pdc-calendar-batch-action').click();
  const batch = await batchOpened;
  await batch.locator('#content:not([hidden])').waitFor();
  assert.equal(await batch.locator('.batch-event').count(), 2);
  assert.equal(await batch.locator('.session').count(), 5);
  assert.equal(await batch.locator('#errors li').count(), 1);
  assert.match(await batch.locator('#errors').textContent(), /Awaiting a confirmed schedule/);
  await batch.selectOption('#provider', 'outlook-school');
  await batch.locator('#select-none').click();
  assert.equal(await batch.locator('#add').isDisabled(), true);
  await batch.locator('#select-all').click();
  const firstGroup = batch.locator('.batch-event').filter({ hasText: seminar.activityEventCode });
  await firstGroup.locator('.batch-event-header input').uncheck();
  assert.match(await batch.locator('#selection-count').textContent(), /1 event\(s\) · 4 session/);
  const subsetDownloadPromise = batch.waitForEvent('download');
  await batch.locator('#add').click();
  const subsetDownload = await subsetDownloadPromise;
  await subsetDownload.saveAs(path.join(output, 'batch-subset.ics'));
  const subset = await readFile(path.join(output, 'batch-subset.ics'), 'utf8');
  assert.equal((subset.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.ok(!subset.includes(seminar.activityEventCode));
  await batch.locator('#select-all').click();
  const batchDownloadPromise = batch.waitForEvent('download');
  await batch.locator('#add').click();
  const batchDownload = await batchDownloadPromise;
  await batchDownload.saveAs(path.join(output, 'batch-all.ics'));
  const batchText = (await readFile(path.join(output, 'batch-all.ics'), 'utf8')).replace(/\r\n /g, '');
  assert.equal((batchText.match(/BEGIN:VCALENDAR/g) || []).length, 1);
  assert.equal((batchText.match(/BEGIN:VEVENT/g) || []).length, 5);
  assert.match(batchText, /Research with care/);
  assert.match(batchText, /Writing for a wider audience/);
  assert.equal(await batch.locator('#import-guide').isVisible(), true);
  assert.equal(await batch.locator('#open-calendar').getAttribute('href'), 'https://outlook.office.com/calendar/');
  await batch.screenshot({ path: path.join(output, 'batch-preview.png'), fullPage: true });
  console.log('PASS: all-page batch selection exports one file with distinct event titles; unavailable schedules are reported');

  await batch.evaluate(() => { chrome.permissions.contains = async () => true; });
  await batch.selectOption('#provider', 'nextcloud');
  await batch.locator('#add').click();
  await batch.waitForFunction(() => document.getElementById('status').textContent.includes('4 added · 1 already present · 0 failed'));
  assert.equal(stored.size, 5);
  const callsBeforeFailure = writes.length;
  denyNextcloud = true;
  await batch.locator('#add').click();
  await batch.waitForFunction(() => document.getElementById('status').textContent.includes('5 failed'));
  assert.equal(writes.length - callsBeforeFailure, 1);
  denyNextcloud = false;
  console.log('PASS: Nextcloud batch preserves event identities and stops the entire batch on invalid credentials');

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/options.html`);
  await settings.waitForFunction(() => document.getElementById('username').value === 'test');
  assert.equal(await settings.locator('#app-password').inputValue(), '');
  await settings.selectOption('#provider', 'ics');
  await settings.locator('#save-preferences').click();
  await settings.waitForFunction(() => document.getElementById('status').textContent === 'Preferences saved.');
  await settings.locator('#calendar-url').fill('https://cloud.example.com/apps/calendar');
  await settings.locator('#connect').click();
  await settings.waitForFunction(() => document.getElementById('status').textContent.includes('specific Nextcloud calendar'));
  await settings.locator('#disconnect').click();
  await settings.waitForFunction(() => document.getElementById('status').textContent.includes('Connection forgotten'));
  assert.equal(await worker.evaluate(async () => !!(await chrome.storage.local.get('nextcloud')).nextcloud), false);
  await settings.screenshot({ path: path.join(output, 'settings.png'), fullPage: true });
  console.log('PASS: preferences persist; passwords stay hidden; invalid calendar URLs rejected; forgetting connection removes credentials');

  enrolled = [seminar];
  await pdc.reload();
  await pdc.waitForFunction(() => document.querySelectorAll('.pdc-calendar-action').length === 1);
  console.log('PASS: dropped enrollment loses its calendar button without deleting calendar entries');

  denyPdc = true;
  await pdc.locator('.pdc-calendar-action').click();
  await pdc.waitForFunction(() => document.getElementById('pdc-calendar-status').textContent.includes('Sign in again'));
  assert.ok(readRequests >= 7);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(unexpected.length, 0, unexpected.join('\n'));
  console.log('PASS: expired PDC login is reported; no page errors or unexpected network destinations');

  const sis = await context.newPage();
  await sis.goto('https://sisn.hkust-gz.edu.cn/classes/my-class-schedule');
  await sis.locator('#add2calendar-sis-toolbar button:not(:disabled)').waitFor();
  assert.equal(await sis.locator('#add2calendar-sis-toolbar span').textContent(), '1 enrolled class ready');
  const sisBatchOpened = context.waitForEvent('page');
  await sis.locator('#add2calendar-sis-toolbar button').click();
  const sisBatch = await sisBatchOpened;
  await sisBatch.locator('#content:not([hidden])').waitFor();
  assert.equal(await sisBatch.locator('.batch-event').count(), 1);
  assert.equal(await sisBatch.locator('.session').count(), 4);
  assert.match(await sisBatch.locator('.batch-event').textContent(), /COMP 5001 · Synthetic Systems Seminar/);
  const sisDownloadPromise = sisBatch.waitForEvent('download');
  await sisBatch.locator('#add').click();
  const sisDownload = await sisDownloadPromise;
  await sisDownload.saveAs(path.join(output, 'sis-schedule.ics'));
  const sisText = (await readFile(path.join(output, 'sis-schedule.ics'), 'utf8')).replace(/\r\n /g, '');
  assert.match(sisText, /UID:sis-[a-f0-9]{64}@add2calendar\.local/);
  assert.match(sisText, /URL:https:\/\/sisn\.hkust-gz\.edu\.cn\/classes\/my-class-schedule/);
  console.log('PASS: SIS schedule response creates a calendar button and exports enrolled recurring classes');

  console.log(`Browser integration checks passed. Screenshots: ${output}`);
} finally { await context.close(); }
