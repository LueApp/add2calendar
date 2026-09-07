# PDC · Add to Calendar

**English** | [简体中文](README.zh-CN.md)

A Chrome extension that adds **Add to calendar** and **Add multiple events** buttons to the [HKUST(GZ) PDC system](https://pdc.hkust-gz.edu.cn/enrollment-records). Add enrolled seminars to Outlook, Google Calendar, Nextcloud, or an `.ics` calendar file.

**[Download v0.2.0](https://github.com/LueApp/pdc-calendar-extension/releases/download/v0.2.0/pdc-calendar-0.2.0.zip)** · [All releases](https://github.com/LueApp/pdc-calendar-extension/releases) · [Report an issue](https://github.com/LueApp/pdc-calendar-extension/issues)

## Website

The bilingual project website is a dependency-free static site in `site/`. Build it with:

```sh
npm run site:build
```

The deployable site is written to `web-dist/` and includes the current extension ZIP. For a Git-connected Cloudflare Pages project, use **`npm run site:build`** as the build command and **`web-dist`** as the output directory. No environment variables are required.

## Features

- Calendar buttons on **Event Enrollment** and **Enrollment Records**.
- Batch export across **all enrollment pages**, with event and session selection.
- Each event retains its title, dates, times, venue, instructors, and source link.
- Multiple sessions and weekly meeting schedules are supported.
- PDC times are interpreted in **China Standard Time, UTC+08:00**, regardless of your computer timezone.
- Uses your existing PDC session; complete university two-factor authentication normally.

**Added events are copies. Later PDC changes and cancellations are not automatically synchronized.** This is an independent student tool, not an official university application.

<img src="docs/images/batch-preview.png" width="760" alt="Batch preview with two fictional seminars, session checkboxes, and Outlook import instructions">

*The screenshot uses fictional events. The extension interface is currently in English; documentation is available in both languages.*

## Install in Chrome

Requires **Google Chrome 120+**. No Node.js, Python, or server is needed for normal use.

1. Download **`pdc-calendar-0.2.0.zip`** from [Releases](https://github.com/LueApp/pdc-calendar-extension/releases/latest) and extract it into a permanent folder.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked**. Select the folder that **directly contains `manifest.json`**.
4. Reload PDC and sign in normally.
5. Open **Event Enrollment** or **Enrollment Records**. Calendar buttons appear for enrolled events.

| How you downloaded it | Folder to select in Chrome |
| --- | --- |
| Release asset `pdc-calendar-0.2.0.zip` | The extracted folder; `manifest.json` is at its root |
| GitHub **Code → Download ZIP**, or `git clone` | The `extension` subfolder inside the source checkout |

**“Manifest file is missing or unreadable”** means Chrome cannot find `manifest.json` directly inside the selected folder. Do not select the ZIP itself or a parent folder. Early v0.1.0 ZIPs used an extra `extension` subfolder.

## Add a batch to Outlook

1. On PDC, click **Add multiple events** above the table.
2. Choose **Outlook · school / Microsoft 365** or **Outlook.com · personal**.
3. Select the events and sessions you want. Upcoming sessions are selected initially; use **Select all**, **Upcoming only**, or **Clear selection** to adjust them.
4. Click **Download for Outlook**. All selected sessions are included in **one `.ics` file**, with each event’s own title and details.
5. In Outlook: **Calendar → Add calendar → Upload from file**. Choose the file and target calendar, then click **Import** or **Import and Save** once.

**One import confirmation is required for the whole batch.** Uncheck events already in Outlook: the extension cannot inspect your Outlook calendar, and repeated imports may create duplicates. Events with unusable schedules are listed separately in the preview.

For one event, click its **Add to calendar** button. A single-session Outlook link opens a prefilled event for you to save. Selecting several sessions offers **Download for Outlook** to export them together.

## Supported calendars

| Destination | Single session | Batch |
| --- | --- | --- |
| School Outlook / Microsoft 365 | Prefilled web event; click Save | One `.ics` import |
| Personal Outlook.com | Prefilled web event; click Save | One `.ics` import |
| Google Calendar | Prefilled web event; click Save | Import one `.ics` file through **Settings → Import & export** |
| Nextcloud | Direct addition after setup | Direct addition of selected sessions |
| Apple Calendar, Thunderbird, other apps | Import the `.ics` file | Import the combined `.ics` file |

Each person uses their own account. Outlook and Google sign-in happens on their own websites; do not enter those passwords into this extension. Reminder settings apply to Nextcloud and `.ics` exports. For prefilled web events, set reminders in the calendar editor. Your calendar app controls reminder delivery.

## Connect Nextcloud (optional)

1. In Nextcloud Calendar, create or choose a writable calendar, such as **PDC Seminars**.
2. Open the **⋯** menu beside that calendar and copy its **private link**. It should look like:

   ```text
   https://cloud.example.com/remote.php/dav/calendars/USERNAME/CALENDAR/
   ```

3. In Nextcloud **Settings → Security**, create an app password named **PDC Calendar**.
4. Open the extension’s **Settings** from its toolbar icon or preview. Enter the private calendar URL, Nextcloud username, and app password.
5. Click **Save Nextcloud connection** and allow Chrome access to that server.
6. In an event or batch preview, choose **Nextcloud**, select sessions, and click Add.

Use the private link for a **specific calendar**, not a public share, general Calendar page, or account-wide CalDAV address. Saving settings creates no test event; credentials are checked when you add an event.

Identical sessions previously added by this extension are skipped, and existing entries are never overwritten. Entries created manually or through another tool may not be recognized as duplicates. Re-adding a rescheduled seminar creates a new time entry and leaves the old entry in place.

## Update an existing installation

1. Download and extract the new release.
2. Copy its files into the **same folder you originally loaded**, replacing the old extension files.
3. In `chrome://extensions`, click **Reload** on the extension’s card.
4. Reload PDC.

Keep the installation folder in place. Reusing its path preserves the unpacked extension’s identity and settings. Updates are manual: this extension has not been published to the Chrome Web Store. Some managed browsers may prohibit unpacked extensions.

## Privacy and limitations

- No analytics, third-party backend, or AI service.
- The PDC token is used only for read requests to PDC. It is not sent to calendar providers or saved in extension settings.
- Nextcloud credentials stay in local extension storage, separate from PDC content scripts and Chrome Sync. The app password is **not additionally encrypted at rest**; use a dedicated, revocable app password.
- The extension does not enroll in or drop events, or bypass login and two-factor authentication.
- The supported source is HKUST(GZ) PDC. Changes to its internal website interface may require extension updates.
- Imported events are not subscriptions. Check PDC for later changes and cancellations.

Read the [privacy details](PRIVACY.md) and [validation notes](VALIDATION.md).

## Troubleshooting

| Problem | What to do |
| --- | --- |
| No calendar buttons | Reload the extension and PDC, allow access to the PDC site, and check **Enrollment Records**. Buttons appear for enrolled events only. |
| PDC login expired | Sign in normally, then reload PDC. |
| Nothing selected in a batch | Upcoming sessions are selected initially. Choose **Select all** to include past sessions. |
| Schedule cannot be exported | Check that PDC has published valid dates, times, and meeting weekdays. Ambiguous schedules are not guessed. |
| Outlook link loses details or uses the wrong account | Choose the matching school/personal option or use `.ics` import. |
| Nextcloud rejects the connection | Check the specific calendar’s private URL, actual username, app password, and write access. |
| Some Nextcloud additions fail | Check the result counts and retry. Successfully added identical sessions are skipped. |

When reporting an issue, include the extension version and error text. Remove tokens, app passwords, student identifiers, and private event details from screenshots or logs.

## Development

The extension has no runtime dependencies or build step. Development uses **Node.js 22+**, **npm**, and **Python 3**. Playwright is used only for browser tests.

```sh
git clone https://github.com/LueApp/pdc-calendar-extension.git
cd pdc-calendar-extension
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run package
```

The ZIP is written to `dist/`. To load the source directly, select `extension/` in Chrome.

| Location | Purpose |
| --- | --- |
| `extension/content.js` | PDC adapter and injected buttons |
| `extension/event.*`, `extension/batch.*` | Individual and batch previews |
| `extension/lib/` | Schedule conversion, iCalendar export, and CalDAV writes |
| `tests/` | Unit tests with fictional event data |
| `scripts/browser-test.mjs` | Actual extension tested against simulated PDC/calendar responses |
| `scripts/package.py` | Creates the ZIP with `manifest.json` at its root |

Version 0.2.0 passed **18 unit tests and 12 browser integration checks**. Automated tests do not write to real student calendars. See [VALIDATION.md](VALIDATION.md) for test scope and live checks still needed.

## License and references

[MIT License](LICENSE).

[Outlook import](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web) · [Google Calendar import](https://support.google.com/calendar/answer/37118) · [Nextcloud Calendar](https://docs.nextcloud.com/server/stable/user_manual/en/groupware/calendar.html) · [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)
