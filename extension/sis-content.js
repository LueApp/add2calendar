(() => {
  if (globalThis.__add2CalendarSisContentInstalled) return;
  globalThis.__add2CalendarSisContentInstalled = true;
  const supportedPath = '/classes/my-class-schedule';
  let courses = [], busy = false, loaded = false, errorMessage = '';

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function enrolledCount() {
    return courses.filter(course => {
      const status = String(course?.enrollmentStatus || '').toLowerCase();
      const description = String(course?.enrollmentStatusEnDesc || '').toLowerCase();
      return status === 'enrolsuccess' || (!status && description.includes('enrol') && !description.includes('wait'));
    }).length;
  }

  function render() {
    const onSchedule = location.pathname.replace(/\/$/, '') === supportedPath;
    let toolbar = document.getElementById('add2calendar-sis-toolbar');
    if (!onSchedule) { if (toolbar) toolbar.hidden = true; return; }
    if (!document.body) return;
    if (!toolbar) {
      toolbar = document.createElement('aside');
      toolbar.id = 'add2calendar-sis-toolbar';
      toolbar.innerHTML = '<button type="button">Loading class schedule…</button><span role="status">Waiting for SIS</span>';
      document.body.append(toolbar);
      toolbar.querySelector('button').addEventListener('click', openSchedule);
    }
    toolbar.hidden = false;
    const count = enrolledCount(), button = toolbar.querySelector('button'), status = toolbar.querySelector('span');
    button.disabled = busy || !count;
    setText(button, busy ? 'Preparing calendar…' : count ? 'Add class schedule' : 'Loading class schedule…');
    setText(status, errorMessage || (count ? `${count} enrolled class${count === 1 ? '' : 'es'} ready` : loaded ? 'No enrolled classes found' : 'Waiting for SIS'));
  }

  async function openSchedule() {
    if (busy || !enrolledCount()) return;
    busy = true; errorMessage = ''; render();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SIS_OPEN_BATCH', courses });
      if (response?.error) throw new Error(response.error);
    } catch (error) {
      errorMessage = error.message || 'Could not prepare the class schedule.';
    } finally { busy = false; render(); }
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'add2calendar-sis-bridge' || event.data?.type !== 'SIS_SCHEDULE') return;
    if (!Array.isArray(event.data.courses)) return;
    courses = event.data.courses;
    loaded = true;
    errorMessage = '';
    render();
  });

  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(render, 1000);
  render();
})();
