import test from 'node:test';
import assert from 'node:assert/strict';
import { SIS_SOURCE, isEnrolledCourse, normalizeSisBatch, sisCourseToEvent } from '../extension/lib/sis.mjs';
import { makeCalendarICS } from '../extension/lib/calendar.mjs';

const enrolled = {
  classId: 'CLASS-101',
  classNbr: '1234',
  classSection: 'L1',
  subjectArea: 'COMP',
  catalogNbr: '5001',
  crseShortDesc: 'Synthetic Systems Seminar',
  enrollmentStatus: 'enrolSuccess',
  enrollmentStatusEnDesc: 'Enrolled',
  meetingInfoList: [{
    startDate: '2026-09-07',
    endDate: '2026-09-18',
    weekDay: '1,3',
    meetingStartTime: '10:00',
    meetingEndTime: '11:30',
    facilityName: 'Synthetic Room 101',
    instructorList: [{ instructorName: 'Dr. Example', instructorRoleInd: 'PI' }]
  }]
};

test('SIS enrolled classes become recurring China-time calendar events', async () => {
  assert.equal(isEnrolledCourse(enrolled), true);
  assert.equal(isEnrolledCourse({ ...enrolled, enrollmentStatus: 'waitlistSuccess' }), false);
  const raw = sisCourseToEvent(enrolled);
  assert.equal(raw.activityEventCode, 'SIS-CLASS-101');
  assert.equal(raw.eventSchedules[0].meetOnMon, true);
  assert.equal(raw.eventSchedules[0].meetOnWed, true);
  const result = await normalizeSisBatch([enrolled, { ...enrolled, classId: 'WAIT', enrollmentStatus: 'waitlistSuccess' }]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].sessions.length, 4);
  assert.equal(result.events[0].sessions[0].start, '2026-09-07T02:00:00.000Z');
  assert.match(result.events[0].sessions[0].uid, /^sis-[a-f0-9]{64}@add2calendar\.local$/);
  assert.equal(result.events[0].url, SIS_SOURCE);
  assert.match(result.events[0].description, /SIS event: SIS-CLASS-101/);
  assert.match(result.events[0].description, /Instructor: Dr\. Example/);
  const ics = makeCalendarICS(result.events.map(event => ({ event, sessions: event.sessions })));
  assert.match(ics, /PRODID:-\/\/Add2Calendar\/\/EN/);
  assert.match(ics, /URL:https:\/\/sisn\.hkust-gz\.edu\.cn\/classes\/my-class-schedule/);
});

test('SIS rejects empty enrollment results and reports unusable meetings per class', async () => {
  await assert.rejects(() => normalizeSisBatch([{ ...enrolled, enrollmentStatus: 'waitlistSuccess' }]), /No enrolled SIS classes/);
  const result = await normalizeSisBatch([enrolled, {
    ...enrolled,
    classId: 'CLASS-BAD',
    crseShortDesc: 'Incomplete synthetic schedule',
    meetingInfoList: [{ ...enrolled.meetingInfoList[0], meetingStartTime: '' }]
  }]);
  assert.equal(result.events.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /SIS has not supplied a complete start\/end time/);
});
