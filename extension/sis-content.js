(() => {
  if (globalThis.__add2CalendarSisContentInstalled) return;
  globalThis.__add2CalendarSisContentInstalled = true;
  const t = globalThis.Add2CalendarI18n.t;
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

  function text(element) {
    return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isoDate(value) {
    const match = String(value).toUpperCase().match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/);
    const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
    return match && months[match[2]] ? `${match[3]}-${months[match[2]]}-${match[1].padStart(2, '0')}` : '';
  }

  function clock(value, period) {
    const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    let hour = Number(match[1]);
    if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  }

  function meetingFromText(value, location, instructor) {
    const date = value.match(/(\d{1,2}-[A-Z]{3}-\d{4})\s*-\s*(\d{1,2}-[A-Z]{3}-\d{4})/i);
    const time = value.match(/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i);
    if (!date || !time) return null;
    const between = value.slice((date.index || 0) + date[0].length, time.index);
    const dayMap = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 };
    const weekdays = [...between.matchAll(/Mo|Tu|We|Th|Fr|Sa|Su/g)].map(match => dayMap[match[0]]);
    return {
      startDate: isoDate(date[1]),
      endDate: isoDate(date[2]),
      weekDay: weekdays.join(','),
      meetingStartTime: clock(time[1], time[2]),
      meetingEndTime: clock(time[3], time[4]),
      facilityName: location,
      instructorList: instructor ? [{ instructorName: instructor, instructorRoleInd: 'PI' }] : []
    };
  }

  function captureVisibleSchedule() {
    for (const table of document.querySelectorAll('.el-table')) {
      const header = table.querySelector('.el-table__header-wrapper tr');
      const body = table.querySelector('.el-table__body-wrapper tbody');
      if (!header || !body) continue;
      const labels = [...header.querySelectorAll('th')].map(cell => text(cell).toLowerCase());
      const index = label => labels.findIndex(value => value === label || value.includes(label));
      const columns = {
        course: index('course'), section: index('section'), description: index('description'), status: index('status'),
        dateTime: index('date & time'), location: index('location'), instructor: index('instructor')
      };
      if (Object.values(columns).some(value => value < 0)) continue;
      const parsed = [...body.querySelectorAll('tr')].map(row => {
        const cells = [...row.querySelectorAll(':scope > td')];
        const course = text(cells[columns.course]), sectionText = text(cells[columns.section]);
        const section = sectionText.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        const dateCell = cells[columns.dateTime], locationCell = cells[columns.location], instructorCell = cells[columns.instructor];
        const groupText = cell => {
          const groups = [...cell.querySelectorAll('.column-row')];
          return (groups.length ? groups : [cell]).map(text);
        };
        const dates = groupText(dateCell), locations = groupText(locationCell), instructors = groupText(instructorCell);
        const meetingInfoList = dates.map((value, i) => meetingFromText(value, locations[i] || locations[0] || '', instructors[i] || instructors[0] || '')).filter(Boolean);
        return {
          classId: [course, section?.[1] || sectionText, section?.[2] || ''].join('-'),
          classNbr: section?.[2] || '',
          classSection: section?.[1] || sectionText,
          crseCode: course,
          crseShortDesc: text(cells[columns.description]),
          enrollmentStatus: /^enrolled$/i.test(text(cells[columns.status])) ? 'enrolSuccess' : '',
          enrollmentStatusEnDesc: text(cells[columns.status]),
          meetingInfoList
        };
      }).filter(course => course.crseCode);
      if (parsed.length) {
        courses = parsed;
        loaded = true;
        errorMessage = '';
        return true;
      }
    }
    return false;
  }

  function render() {
    const onSchedule = location.pathname.replace(/\/$/, '') === supportedPath;
    let toolbar = document.getElementById('add2calendar-sis-toolbar');
    if (!onSchedule) { if (toolbar) toolbar.hidden = true; return; }
    if (!document.body) return;
    if (!toolbar) {
      toolbar = document.createElement('aside');
      toolbar.id = 'add2calendar-sis-toolbar';
      toolbar.innerHTML = '<button type="button"></button><span role="status"></span>';
      document.body.append(toolbar);
      toolbar.querySelector('button').addEventListener('click', openSchedule);
    }
    toolbar.hidden = false;
    const count = enrolledCount(), button = toolbar.querySelector('button'), status = toolbar.querySelector('span');
    button.disabled = busy || !count;
    setText(button, busy ? t('preparingCalendar') : count ? t('addClassSchedule') : t('loadingClassSchedule'));
    setText(status, errorMessage || (count ? t(count === 1 ? 'classReady' : 'classesReady', String(count)) : loaded ? t('noEnrolledClassesFound') : t('waitingForSis')));
  }

  async function openSchedule() {
    if (busy || !enrolledCount()) return;
    busy = true; errorMessage = ''; render();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SIS_OPEN_BATCH', courses });
      if (response?.error) throw new Error(response.error);
    } catch (error) {
      errorMessage = error.message || t('prepareScheduleFailed');
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

  document.addEventListener('DOMContentLoaded', () => { captureVisibleSchedule(); render(); }, { once: true });
  setInterval(() => { if (!enrolledCount()) captureVisibleSchedule(); render(); }, 1000);
  render();
})();
