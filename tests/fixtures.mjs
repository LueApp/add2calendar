// Synthetic event matching the fields in PDC's public frontend. No student data.
export const seminar = {
  activityEventCode: 'PDC-EXAMPLE-2026-001',
  description: 'Research with care: methods, people & impact',
  enquiryEmail: 'seminars@example.edu',
  remarks: 'Bring your questions.\nRoom information is available in PDC.',
  eventInstructors: [{ name: 'Dr. Example' }],
  eventSchedules: [{ dateBegin: '2026-09-10', dateEnd: '2026-09-10', hourBegin: 14, minuteBegin: 30, hourEnd: 16, minuteEnd: 0, venue: 'Academic Building, Room 101' }]
};
export const series = {
  ...seminar,
  activityEventCode: 'PDC-EXAMPLE-2026-002',
  description: 'Writing for a wider audience',
  eventSchedules: [{ dateBegin: '2026-09-07', dateEnd: '2026-09-18', hourBegin: 10, minuteBegin: 0, hourEnd: 11, minuteEnd: 30, venue: 'Learning Hub 203', meetOnMon: true, meetOnWed: true }]
};
