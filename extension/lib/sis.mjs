import { cleanText } from './calendar.mjs';
import { normalizeBatch } from './batch.mjs';

export const SIS_SOURCE = 'https://sisn.hkust-gz.edu.cn/classes/my-class-schedule';

export function isEnrolledCourse(course) {
  const status = cleanText(course?.enrollmentStatus, 100).toLowerCase();
  const description = cleanText(course?.enrollmentStatusEnDesc, 200).toLowerCase();
  return status === 'enrolsuccess' || (!status && description.includes('enrol') && !description.includes('wait'));
}

function clock(value) {
  const match = cleanText(value, 20).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: null, minute: null };
}

function courseCode(course) {
  return cleanText(course.crseCode || [course.subjectArea, course.catalogNbr].filter(Boolean).join(' '), 100);
}

export function sisCourseToEvent(course) {
  if (!course || typeof course !== 'object') throw new Error('SIS returned an invalid class record.');
  const code = courseCode(course);
  const section = cleanText(course.classSection, 100);
  const classNumber = cleanText(course.classNbr, 100);
  const classId = cleanText(course.classId || [code, section, classNumber].filter(Boolean).join('-'), 200);
  const title = cleanText(course.crseShortDesc || course.crseName, 500);
  const meetings = Array.isArray(course.meetingInfoList) ? course.meetingInfoList : [];
  const instructors = [...new Set(meetings.flatMap(meeting => Array.isArray(meeting.instructorList) ? meeting.instructorList : [])
    .filter(instructor => !instructor?.instructorRoleInd || instructor.instructorRoleInd === 'PI')
    .map(instructor => cleanText(instructor?.instructorName, 200)).filter(Boolean))];
  return {
    activityEventCode: `SIS-${classId}`,
    description: [code, title].filter(Boolean).join(' · '),
    eventInstructors: instructors.map(name => ({ name })),
    remarks: [`Class section: ${section || 'not specified'}`, classNumber && `Class number: ${classNumber}`].filter(Boolean).join('\n'),
    sourceName: 'SIS',
    sourceUrl: SIS_SOURCE,
    uidNamespace: 'sis',
    eventSchedules: meetings.map(meeting => {
      const start = clock(meeting.meetingStartTime), end = clock(meeting.meetingEndTime);
      const weekdays = new Set(cleanText(meeting.weekDay, 50).split(',').map(value => Number(value.trim())).filter(value => value >= 1 && value <= 7));
      return {
        dateBegin: cleanText(meeting.startDate, 30),
        dateEnd: cleanText(meeting.endDate || meeting.startDate, 30),
        hourBegin: start.hour,
        minuteBegin: start.minute,
        hourEnd: end.hour,
        minuteEnd: end.minute,
        venue: cleanText(meeting.facilityName, 1000),
        meetOnMon: weekdays.has(1),
        meetOnTue: weekdays.has(2),
        meetOnWed: weekdays.has(3),
        meetOnThu: weekdays.has(4),
        meetOnFri: weekdays.has(5),
        meetOnSat: weekdays.has(6),
        meetOnSun: weekdays.has(7)
      };
    })
  };
}

export async function normalizeSisBatch(courses) {
  if (!Array.isArray(courses)) throw new Error('SIS did not provide a class schedule. Reload SIS and try again.');
  const enrolled = courses.filter(isEnrolledCourse);
  if (!enrolled.length) throw new Error('No enrolled SIS classes are available to add.');
  return normalizeBatch(enrolled.map(sisCourseToEvent));
}
