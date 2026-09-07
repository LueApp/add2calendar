# Privacy

**English** | [简体中文](PRIVACY.zh-CN.md)

Add2Calendar runs locally in your browser. The author operates no backend and receives no data. There is no analytics or telemetry.

## PDC access

On the PDC website, the extension reads your enrollment records and event schedules using the authentication token already present in the current tab. Requests go only to the PDC origin. The token is not persisted by the extension, passed to extension pages, included in calendar files, or sent to calendar providers. The extension does not read or automate passwords or two-factor authentication codes and does not change your enrollment.

Only event fields (title, code, times, venue, instructors, remarks, enquiry email, and a fixed PDC source URL) are passed to the extension preview. Student-profile fields are not copied. Draft previews use browser session storage and expire after 24 hours; expired drafts are pruned when a new draft is created. Browser session storage is cleared when the browser session ends.

## SIS access

On **My Class Schedule**, SIS loads the signed-in student’s schedule from its own same-origin API. Add2Calendar observes that response without changing it, keeps only course code, title, section, enrollment status, dates, weekdays, times, room, and instructor names, and passes those fields to the extension background worker when you click **Add class schedule**. Student IDs and authentication data are discarded in the page before the schedule reaches the extension preview.

Waitlisted and dropped classes are not exported. The extension does not submit enrollment, drop, swap, or approval requests in SIS. It does not read passwords, authentication codes, grades, credits, deadlines, or unrelated SIS pages.

## Calendar destinations

- **Outlook / Google:** choosing to open a session sends its details in a prefilled calendar URL to that provider. You finish saving in the provider’s interface. The URL may appear in browser history. Their own account and privacy policies apply.
- **Nextcloud:** clicking Add sends the selected event details and a Basic Authorization header over HTTPS to the exact calendar URL you configured. Redirects are rejected. No invitations or attendee emails are sent by the extension.
- **Calendar file:** the extension creates a local `.ics` download. Importing or sharing that file is your choice.

## Outlook cleanup (optional)

Outlook cleanup is disabled by default. To enable it, you must open the extension Settings, enter a Microsoft Entra application client ID, click **Activate Outlook cleanup**, and grant Chrome access to Microsoft sign-in and Graph. Opening the cleanup tool still does not connect or load data: you must click **Connect**, approve Microsoft’s delegated `Calendars.ReadWrite` permission, select a calendar and date range, and click **Load events**.

The Microsoft access token remains only in the cleanup tab’s memory and is discarded when it expires, you disconnect, or the tab closes. It is not stored in extension storage or sent to the author. The enabled flag and public application client ID are stored locally. Deactivation removes those settings and the optional Microsoft host permissions.

For the chosen calendar and date range, Microsoft Graph returns event IDs, titles, times, locations, organizers, recurrence types, sensitivity, and attendee records. Add2Calendar immediately discards attendee identities and retains only the attendee count needed to warn about meetings. Events are not selected automatically. Before deletion, the tool shows the selection again, warns about organizer meetings and recurring items, and requires a confirmation checkbox. Only the selected event IDs are sent back to Microsoft Graph for deletion. Deleting an organizer meeting may cause Outlook to send cancellation notices to attendees.

## Local settings and permissions

Your provider preference, reminder choice, optional Nextcloud connection, and optional Outlook-cleanup configuration are stored in `chrome.storage.local`, not Chrome Sync. Nextcloud app passwords are stored without additional encryption. Local storage is restricted to trusted extension contexts so PDC and SIS content scripts cannot access it. The extension requests optional host access only for the HTTPS Nextcloud server or Microsoft cleanup service you explicitly activate. Its manifest declares possible HTTPS origins to allow these user-selected connections; it does not request access to all of them at installation.

Use Settings → Forget connection to remove Nextcloud settings and its optional host permission. Revoke the app password in Nextcloud Security to invalidate it at the server. Removing the extension deletes its local settings, but does not remove calendar entries or downloaded files.
