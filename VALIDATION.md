# Validation — 2026-09-07

Version: **0.3.1**. Runtime: no dependencies or build step. Minimum Chrome version: 120.

## Completed

- **20 unit tests passed** with Node.js 24.15.0. Covered China-to-UTC conversion, recurring weekday expansion, missing/invalid schedules, stable identifiers, conflicting venues, Unicode iCalendar escaping and 75-octet folding, session selection, Outlook/Google URL parameters, valid Nextcloud URLs, conditional CalDAV writes, partial failures, retries, UTF-8 authentication, SIS enrolled/waitlisted filtering, and SIS recurring meeting conversion.
- **14 browser integration checks passed** with the actual extension loaded in an isolated **Chrome for Testing 153.0.8010.12** profile via Playwright 1.63.0. PDC, SIS, and Nextcloud responses were synthetic; the browser timezone was America/New_York.
- Verified buttons only appear for enrolled rows, ignore remark rows, appear after a new enrollment, and disappear after a drop.
- Verified paginated enrollment reads and fresh data lookup on click.
- Verified the content script, background worker, session draft storage, and preview work together without passing the PDC token or student-profile fields to the preview.
- Verified real `.ics` downloads with one and four sessions, and China-local times shown correctly in the preview.
- Verified a batch spanning two events and five sessions, including an event absent from the visible PDC table page. Confirmed one VCALENDAR envelope, correct per-event titles, whole-event selection, one file download, and Outlook import instructions.
- Verified an invalid third event is listed as unavailable while valid events remain exportable.
- Verified batch Nextcloud writes preserve identifiers used by individual additions, skip existing sessions, and stop the whole batch on invalid credentials.
- Verified school Outlook, personal Outlook, and Google handoff URLs at the Chrome tabs API boundary. These tests do not save events in those services.
- Verified actual preview CalDAV serialization/requests against a mock server, including repeated-click handling. The optional permission decision was mocked for the Nextcloud write check.
- Verified preferences, hidden saved passwords, invalid Nextcloud URL rejection, forgetting a connection, and expired PDC login feedback.
- Verified a synthetic SIS schedule response activates **Add class schedule**, excludes a waitlisted class, opens the batch preview, expands recurring meetings, and downloads an `.ics` file with SIS-specific identifiers and source links.
- Verified the visible SIS table activates the same control and preserves separate recurring patterns, rooms, and instructors when the API response is missed.
- Confirmed no browser page errors or unexpected network destinations in the final integration run.
- Reviewed screenshots of the single-session preview, multiple-session preview, and settings page.
- Checked JavaScript syntax and manifest file references.

Screenshots and synthetic `.ics` downloads are in `test-results/` in the development workspace. They contain no real student information.

## Live checks still needed

The user has confirmed that the extension loads and that individual events can be added to Outlook after saving in its editor. Automated validation still uses synthetic PDC, SIS, and Nextcloud responses; live SIS schedule comparison, Outlook batch import, and live Nextcloud writes remain to be checked.

A first live trial should confirm:

1. Load the extension and reload a signed-in PDC tab. Confirm the button appears on Enrollment Records and after a successful enrollment.
2. Compare every preview session with the original PDC schedule.
3. Reload a signed-in SIS **My Class Schedule** page, click **Add class schedule**, and compare each exported class section, date range, weekday, time, room, and instructor with SIS.
4. Complete Chrome’s real optional permission prompt for your Nextcloud host and add one event to a test calendar. Check its time, venue, and reminder. Repeat the addition to verify the server skips it.
5. Use a batch preview, download the Outlook batch, and import it once into the target Outlook calendar. Confirm all selected sessions appear with their own titles and times.
6. Import an `.ics` file in the desktop/mobile calendar app you use and check reminder behavior there.

No real enrollments, calendar entries, university credentials, or Nextcloud configuration were changed during development. The extension is packaged for unpacked installation and has not been published to the Chrome Web Store.
