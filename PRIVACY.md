# Privacy

**English** | [简体中文](PRIVACY.zh-CN.md)

Add2Calendar runs locally in your browser. The author operates no backend and receives no data. There is no analytics or telemetry.

## PDC access

On the PDC website, the extension reads your enrollment records and event schedules using the authentication token already present in the current tab. Requests go only to the PDC origin. The token is not persisted by the extension, passed to extension pages, included in calendar files, or sent to calendar providers. The extension does not read or automate passwords or two-factor authentication codes and does not change your enrollment.

Only event fields (title, code, times, venue, instructors, remarks, enquiry email, and a fixed PDC source URL) are passed to the extension preview. Student-profile fields are not copied. Draft previews use browser session storage and expire after 24 hours; expired drafts are pruned when a new draft is created. Browser session storage is cleared when the browser session ends.

## Calendar destinations

- **Outlook / Google:** choosing to open a session sends its details in a prefilled calendar URL to that provider. You finish saving in the provider’s interface. The URL may appear in browser history. Their own account and privacy policies apply.
- **Nextcloud:** clicking Add sends the selected event details and a Basic Authorization header over HTTPS to the exact calendar URL you configured. Redirects are rejected. No invitations or attendee emails are sent by the extension.
- **Calendar file:** the extension creates a local `.ics` download. Importing or sharing that file is your choice.

## Local settings and permissions

Your provider preference, reminder choice, and optional Nextcloud connection are stored in `chrome.storage.local`, not Chrome Sync. Nextcloud app passwords are stored without additional encryption. Local storage is restricted to trusted extension contexts so PDC content scripts cannot access it. The extension requests optional host access only for the HTTPS Nextcloud server you configure. Its manifest declares possible HTTPS origins to allow students to use different servers; it does not request access to all of them at installation.

Use Settings → Forget connection to remove Nextcloud settings and its optional host permission. Revoke the app password in Nextcloud Security to invalidate it at the server. Removing the extension deletes its local settings, but does not remove calendar entries or downloaded files.
