(() => {
  if (globalThis.__add2CalendarSisBridgeInstalled) return;
  globalThis.__add2CalendarSisBridgeInstalled = true;
  const endpoint = '/api/student/queryMyClassSchedulePage';

  function publish(payload) {
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.data) ? payload.data.data : [];
    const courses = rows.slice(0, 500).map(course => ({
      classId: course?.classId,
      classNbr: course?.classNbr,
      classSection: course?.classSection,
      subjectArea: course?.subjectArea,
      catalogNbr: course?.catalogNbr,
      crseCode: course?.crseCode,
      crseShortDesc: course?.crseShortDesc,
      crseName: course?.crseName,
      enrollmentStatus: course?.enrollmentStatus,
      enrollmentStatusEnDesc: course?.enrollmentStatusEnDesc,
      meetingInfoList: Array.isArray(course?.meetingInfoList) ? course.meetingInfoList.slice(0, 100).map(meeting => ({
        startDate: meeting?.startDate,
        endDate: meeting?.endDate,
        weekDay: meeting?.weekDay,
        meetingStartTime: meeting?.meetingStartTime,
        meetingEndTime: meeting?.meetingEndTime,
        facilityName: meeting?.facilityName,
        instructorList: Array.isArray(meeting?.instructorList) ? meeting.instructorList.slice(0, 50).map(instructor => ({
          instructorName: instructor?.instructorName,
          instructorRoleInd: instructor?.instructorRoleInd
        })) : []
      })) : []
    }));
    window.postMessage({ source: 'add2calendar-sis-bridge', type: 'SIS_SCHEDULE', courses }, location.origin);
  }

  function isScheduleUrl(value) {
    try { return new URL(value, location.href).origin === location.origin && new URL(value, location.href).pathname === endpoint; }
    catch { return false; }
  }

  const originalFetch = window.fetch;
  if (originalFetch) window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0] instanceof Request ? args[0].url : args[0];
    if (isScheduleUrl(url)) response.clone().json().then(publish).catch(() => {});
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this.__add2CalendarSisSchedule = String(method).toUpperCase() === 'POST' && isScheduleUrl(url);
    return originalOpen.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__add2CalendarSisSchedule) this.addEventListener('load', () => {
      try { publish(this.responseType === 'json' ? this.response : JSON.parse(this.responseText)); } catch {}
    }, { once: true });
    return originalSend.apply(this, args);
  };
})();
