# Validation — 2026-09-07

Version: **0.4.0**. Runtime: no dependencies or build step. Minimum Chrome version: 120.

## Completed

- **26 unit tests passed** with Node.js 24.15.0. In addition to calendar export coverage, Outlook tests verify PKCE authorization parameters, China-day date ranges, Graph-only pagination, event-risk classification, and deletion batching in groups of 20.
- **15 browser integration checks passed** with the actual extension loaded in an isolated **Chrome for Testing 153.0.8010.12** profile via Playwright 1.63.0. PDC, SIS, Nextcloud, Microsoft sign-in, and Graph responses were synthetic; the browser timezone was America/New_York.
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
- Verified the visible SIS table activates the same control when the API response is missed. Class sections distinguish titles; same-time venue conflicts remain exportable through per-session single/combined venue choices, and the chosen venue reaches the `.ics` file.
- Verified Chrome’s Chinese UI locale localizes settings, event and batch previews, injected PDC/SIS controls, provider guidance, validation messages, and calendar descriptions.
- Verified Outlook cleanup stays unavailable until manual activation, uses an interactive PKCE sign-in, loads arbitrary synthetic events, requires explicit selection and confirmation, warns about organizer meetings and recurring items, batches selected deletions, and never stores the access token.
- Confirmed no browser page errors or unexpected network destinations in the final integration run.
- Reviewed screenshots of the single-session preview, multiple-session preview, and settings page.
- Checked JavaScript syntax and manifest file references.

Screenshots and synthetic `.ics` downloads are in `test-results/` in the development workspace. They contain no real student information.

## Live checks still needed

The user has confirmed that the extension loads and that individual events can be added to Outlook after saving in its editor. Automated validation still uses synthetic PDC, SIS, Nextcloud, and Microsoft Graph responses; live Microsoft Entra sign-in and deletion remain to be checked with a registered application.

A first live trial should confirm:

1. Load the extension and reload a signed-in PDC tab. Confirm the button appears on Enrollment Records and after a successful enrollment.
2. Compare every preview session with the original PDC schedule.
3. Reload a signed-in SIS **My Class Schedule** page, click **Add class schedule**, and compare each exported class section, date range, weekday, time, room, and instructor with SIS.
4. Complete Chrome’s real optional permission prompt for your Nextcloud host and add one event to a test calendar. Check its time, venue, and reminder. Repeat the addition to verify the server skips it.
5. Use a batch preview, download the Outlook batch, and import it once into the target Outlook calendar. Confirm all selected sessions appear with their own titles and times.
6. Import an `.ics` file in the desktop/mobile calendar app you use and check reminder behavior there.

No real enrollments, calendar entries, university credentials, or Nextcloud configuration were changed during development. The extension is packaged for unpacked installation and has not been published to the Chrome Web Store.
