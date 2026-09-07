(() => {
  if (globalThis.__pdcCalendarInstalled) return;
  globalThis.__pdcCalendarInstalled = true;
  const supported = () => ['/event-enrollment', '/enrollment-records'].includes(location.pathname.replace(/\/$/, ''));
  let events = new Map(), timer, fingerprint = '', loading;

  function notify(message) {
    let status = document.querySelector('#pdc-calendar-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'pdc-calendar-status';
      status.setAttribute('role', 'status');
      document.body.append(status);
    }
    status.textContent = message;
    status.hidden = !message;
  }

  async function request(path, body) {
    const token = sessionStorage.getItem('auth-token');
    if (!token) throw new Error('Sign into PDC, then reload the page to use Add to calendar.');
    const response = await fetch(`/api/pdc-student/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if ([401, 403].includes(response.status)) throw new Error('Your PDC session needs attention. Sign in again, then reload the page.');
    if (!response.ok) throw new Error(`PDC could not load your enrollments (HTTP ${response.status}). Reload to retry.`);
    const json = await response.json();
    if (json.code !== undefined && ![0, 200, '0', '200'].includes(json.code)) throw new Error('PDC could not load your enrollments. Sign in again or reload to retry.');
    return json.data ?? json;
  }

  async function loadEnrollments() {
    if (loading) return loading;
    loading = (async () => {
      const next = new Map();
      for (let page = 1; page <= 100; page++) {
        const data = await request('user-event-enrollment/page', { withEvent: true, pagination: { current: page, pageSize: 100, total: 0 } });
        if (!Array.isArray(data.userEventEnrollments)) throw new Error('PDC returned an unfamiliar enrollment format. The extension may need an update.');
        for (const item of data.userEventEnrollments) {
          const code = String(item.activityEventCode ?? item.event?.activityEventCode ?? '');
          if (code) next.set(code, { ...item.event, activityEventCode: code });
        }
        const total = Number(data.pagination?.total);
        const size = Number(data.pagination?.pageSize) || 100;
        if (Number.isFinite(total) ? page * size >= total : data.userEventEnrollments.length < size) {
          events = next;
          return;
        }
        if (!data.userEventEnrollments.length) throw new Error('PDC returned an incomplete enrollment list. Reload to retry.');
      }
      throw new Error('PDC returned too many enrollment pages. The extension may need an update.');
    })();
    try { await loading; } finally { loading = null; }
  }

  // Only calendar fields leave this content script. University credentials and student details stay here.
  function calendarFields(event) {
    return {
      activityEventCode: event.activityEventCode,
      description: event.description,
      remarks: event.remarks,
      enquiryEmail: event.enquiryEmail,
      eventInstructors: Array.isArray(event.eventInstructors) ? event.eventInstructors.map(item => ({ name: item.name })) : [],
      eventSchedules: Array.isArray(event.eventSchedules) ? event.eventSchedules.map(item => Object.fromEntries([
        'dateBegin', 'dateEnd', 'hourBegin', 'minuteBegin', 'hourEnd', 'minuteEnd', 'venue',
        'meetOnMon', 'meetOnTue', 'meetOnWed', 'meetOnThu', 'meetOnFri', 'meetOnSat', 'meetOnSun'
      ].map(key => [key, item[key]]))) : []
    };
  }

  async function openEvent(code, button) {
    button.disabled = true;
    button.textContent = 'Loading…';
    try {
      await loadEnrollments();
      let event = events.get(code);
      if (!event) throw new Error('This event is no longer in your enrollments.');
      if (!event.eventSchedules?.length) {
        const data = await request(`event/detail?activityEventCode=${encodeURIComponent(code)}`);
        event = { ...event, ...(data.event ?? data), activityEventCode: code };
      }
      const result = await chrome.runtime.sendMessage({ type: 'PDC_OPEN_EVENT', event: calendarFields(event) });
      if (!result?.ok) throw new Error(result?.error || 'Reload PDC after installing or updating the extension.');
      notify('');
    } catch (error) {
      notify(error.message || 'Could not load this event. Reload PDC and try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Add to calendar';
      render();
    }
  }

  async function openBatch(button) {
    button.disabled = true;
    button.textContent = 'Loading enrollments…';
    try {
      await loadEnrollments();
      if (!events.size) throw new Error('No enrolled events are available to add.');
      if (events.size > 500) throw new Error('There are too many enrolled events for one batch. Use individual event buttons instead.');
      const batch = [];
      for (let event of events.values()) {
        if (!event.eventSchedules?.length) {
          try {
            const data = await request(`event/detail?activityEventCode=${encodeURIComponent(event.activityEventCode)}`);
            event = { ...event, ...(data.event ?? data), activityEventCode: event.activityEventCode };
          } catch { /* The preview lists schedules that could not be loaded. */ }
        }
        batch.push(calendarFields(event));
      }
      const result = await chrome.runtime.sendMessage({ type: 'PDC_OPEN_BATCH', events: batch });
      if (!result?.ok) throw new Error(result?.error || 'Reload the extension and PDC to use batch export.');
      notify('');
    } catch (error) { notify(error.message || 'Could not load the events. Reload PDC to retry.'); }
    finally { button.disabled = false; button.textContent = 'Add multiple events'; }
  }

  function renderBatchButton() {
    let toolbar = document.getElementById('pdc-calendar-batch');
    const firstRow = rows()[0];
    if (!supported() || !firstRow || !events.size) { toolbar?.remove(); return; }
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'pdc-calendar-batch';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pdc-calendar-batch-action';
      button.textContent = 'Add multiple events';
      button.addEventListener('click', () => openBatch(button));
      const hint = document.createElement('span');
      hint.textContent = 'Choose from all enrollments and export them together.';
      toolbar.append(button, hint);
    }
    const table = firstRow.closest('.ant-table-wrapper') || firstRow.closest('table');
    if (table && toolbar.nextElementSibling !== table) table.before(toolbar);
  }

  function rows() {
    return [...document.querySelectorAll('tr[data-row-key]')].filter(row => !row.dataset.rowKey.endsWith('-remark-row'));
  }

  function render() {
    renderBatchButton();
    for (const row of rows()) {
      const code = row.dataset.rowKey;
      let button = row.querySelector('.pdc-calendar-action');
      if (button && button.dataset.eventCode !== code) { button.remove(); button = null; }
      if (!supported() || !events.has(code)) { button?.remove(); continue; }
      if (button) continue;
      const cell = row.querySelector('td:last-child');
      if (!cell) continue;
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'pdc-calendar-action';
      button.dataset.eventCode = code;
      button.textContent = 'Add to calendar';
      button.setAttribute('aria-label', `Add ${events.get(code).description || code} to calendar`);
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openEvent(code, button); });
      cell.append(button);
    }
  }

  async function scan() {
    if (!supported()) { fingerprint = ''; notify(''); render(); return; }
    const tableRows = rows();
    if (!tableRows.length) return;
    const signature = location.pathname + JSON.stringify(tableRows.map(row => [row.dataset.rowKey, [...row.querySelectorAll('button:not(.pdc-calendar-action), a')].map(control => [control.textContent.trim(), control.hasAttribute('disabled'), control.getAttribute('aria-disabled')])]));
    if (signature === fingerprint) { render(); return; }
    fingerprint = signature;
    try { await loadEnrollments(); notify(''); render(); }
    catch (error) { notify(error.message || 'Calendar buttons could not load. Reload PDC to retry.'); }
  }

  const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 300); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'data-row-key'] });
  window.addEventListener('popstate', () => { fingerprint = ''; scan(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { fingerprint = ''; scan(); } });
  scan();
})();
