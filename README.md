# Add2Calendar

**English** | [简体中文](README.zh-CN.md)

**Calendar export for HKUST(GZ).** Add2Calendar is a Chrome extension that brings campus schedules to the calendar you already use. Export enrolled seminars from [PDC](https://pdc.hkust-gz.edu.cn/enrollment-records) and recurring classes from [SIS](https://sisn.hkust-gz.edu.cn/classes/my-class-schedule) to Outlook, Google Calendar, Nextcloud, or an `.ics` file.

An optional, manually activated Outlook cleanup tool can also review and remove arbitrary calendar events through Microsoft Graph.

**[Download the latest release](https://github.com/LueApp/add2calendar/releases/latest)** · [All releases](https://github.com/LueApp/add2calendar/releases) · [Report an issue](https://github.com/LueApp/add2calendar/issues)

## Website

The bilingual project website is a dependency-free static site in `site/`. Build it with:

```sh
npm run site:build
```

The deployable site is written to `web-dist/` and includes the current extension ZIP. For a Git-connected Cloudflare Pages project, use **`npm run site:build`** as the build command and **`web-dist`** as the output directory. No environment variables are required.

## Features

- Calendar buttons on **Event Enrollment** and **Enrollment Records**.
- Batch export across **all enrollment pages**, with event and session selection.
- An **Add class schedule** control on SIS **My Class Schedule**, exporting enrolled classes while excluding waitlisted and dropped classes.
- Each event retains its title, dates, times, venue, instructors, and source link.
- SIS titles include the class section. If one meeting time lists several venues, the preview lets you choose one or keep the venues combined.
- Multiple sessions and weekly meeting schedules are supported.
- PDC and SIS times are interpreted in **China Standard Time, UTC+08:00**, regardless of your computer timezone.
- Uses your existing PDC or SIS session; complete university authentication normally.
- The extension interface follows Chrome’s UI language, with complete English and Simplified Chinese translations.

**Added entries are copies. Later PDC or SIS changes and cancellations are not automatically synchronized.** This is an independent student tool, not an official university application.

<img src="docs/images/batch-preview.png" width="760" alt="Batch preview with two fictional seminars, session checkboxes, and Outlook import instructions">

*The screenshot uses fictional events. The extension interface is currently in English; documentation is available in both languages.*

## Install in Chrome

Requires **Google Chrome 120+**. No Node.js, Python, or server is needed for normal use.

1. Download the extension ZIP from [Releases](https://github.com/LueApp/add2calendar/releases/latest) and extract it into a permanent folder.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked**. Select the folder that **directly contains `manifest.json`**.
4. Reload any open PDC and SIS tabs and sign in normally.
5. On PDC, open **Event Enrollment** or **Enrollment Records**. On SIS, open **Classes → My Class Schedule**.

| How you downloaded it | Folder to select in Chrome |
| --- | --- |
| Release asset (`.zip`) | The extracted folder; `manifest.json` is at its root |
| GitHub **Code → Download ZIP**, or `git clone` | The `extension` subfolder inside the source checkout |

**“Manifest file is missing or unreadable”** means Chrome cannot find `manifest.json` directly inside the selected folder. Do not select the ZIP itself or a parent folder. Early v0.1.0 ZIPs used an extra `extension` subfolder.

## Add your SIS class schedule

1. Sign into SIS and open **Classes → My Class Schedule**.
2. Wait for **Add class schedule** in the lower-right corner. Its status shows how many enrolled classes are ready.
3. Click the button to preview every enrolled class and recurring meeting. Waitlisted and dropped classes are excluded. Classes are labeled with their section, such as `SYSH 5000 · T01`.
4. Choose a calendar destination, adjust the selected classes or sessions, and resolve any multiple-venue warnings by choosing one room or keeping the rooms combined. Then add or download the batch.

Add2Calendar observes the schedule response that SIS already loads for this page. It keeps course code, title, section, dates, weekdays, times, rooms, and instructor names; student identifiers and authentication data are not passed to the extension preview. If the control still says **Loading class schedule…**, reload the extension and then reload the SIS page.

## Add a batch to Outlook

1. On PDC, click **Add multiple events** above the table.
2. Choose **Outlook · school / Microsoft 365** or **Outlook.com · personal**.
3. Select the events and sessions you want. Upcoming sessions are selected initially; use **Select all**, **Upcoming only**, or **Clear selection** to adjust them.
4. Click **Download for Outlook**. All selected sessions are included in **one `.ics` file**, with each event’s own title and details.
5. In Outlook: **Calendar → Add calendar → Upload from file**. Choose the file and target calendar, then click **Import** or **Import and Save** once.

**One import confirmation is required for the whole batch.** Uncheck events already in Outlook: the extension cannot inspect your Outlook calendar, and repeated imports may create duplicates. Events with unusable schedules are listed separately in the preview.

For one event, click its **Add to calendar** button. A single-session Outlook link opens a prefilled event for you to save. Selecting several sessions offers **Download for Outlook** to export them together.

The SIS class-schedule button opens the same batch preview, with one event per enrolled class section and its recurring meetings selected.

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

3. In Nextcloud **Settings → Security**, create an app password named **Add2Calendar**.
4. Open the extension’s **Settings** from its toolbar icon or preview. Enter the private calendar URL, Nextcloud username, and app password.
5. Click **Save Nextcloud connection** and allow Chrome access to that server.
6. In an event or batch preview, choose **Nextcloud**, select sessions, and click Add.

Use the private link for a **specific calendar**, not a public share, general Calendar page, or account-wide CalDAV address. Saving settings creates no test event; credentials are checked when you add an event.

Identical sessions previously added by this extension are skipped, and existing entries are never overwritten. Entries created manually or through another tool may not be recognized as duplicates. Re-adding a rescheduled seminar creates a new time entry and leaves the old entry in place.

## Outlook cleanup (advanced, manual activation)

This optional tool can review and delete **any events in your Outlook calendar**, including entries created manually or by other applications. It is disabled by default and never opens, signs in, loads events, selects events, or deletes events automatically.

Microsoft requires a registered Entra application and delegated `Calendars.ReadWrite` access:

1. In Microsoft Entra, create an app registration for the account types you intend to support. A single-tenant app is supported; copy its **Directory (tenant) ID** from the Overview page.
2. Under **Authentication**, add a **Single-page application** redirect URI. Copy the exact redirect URL shown in Add2Calendar Settings; it is unique to the installed extension.
3. Under **API permissions**, add Microsoft Graph → Delegated permissions → `Calendars.ReadWrite`.
4. Copy the application’s **Application (client) ID** into Add2Calendar Settings. For a single-tenant app, also paste its **Directory (tenant) ID** instead of `common`, then click **Activate Outlook cleanup**.
5. Click **Open cleanup tool**, then **Connect and review events**. Microsoft shows the requested permission before continuing.
6. Choose a calendar and date range, load events, filter and select the entries to remove, then click **Review deletion**.
7. Review organizer-meeting and recurrence warnings, tick the confirmation box, and delete the selected events.

The cleanup tab stores its Microsoft access token only in memory. Closing it, disconnecting, or allowing the token to expire removes the token. Deactivating cleanup removes its optional Microsoft host access and local configuration. A school tenant may prevent user consent; in that case its Microsoft administrator must approve the application.

## Update an existing installation

1. Download and extract the new release.
2. Copy its files into the **same folder you originally loaded**, replacing the old extension files.
3. In `chrome://extensions`, click **Reload** on the extension’s card.
4. Reload PDC and SIS.

Keep the installation folder in place. Reusing its path preserves the unpacked extension’s identity and settings. Updates are manual: this extension has not been published to the Chrome Web Store. Some managed browsers may prohibit unpacked extensions.

## Privacy and limitations

- No analytics, third-party backend, or AI service.
- The PDC token is used only for read requests to PDC. The SIS adapter observes the schedule response already loaded by SIS and removes student identifiers before passing class data to the extension.
- Nextcloud credentials stay in local extension storage, separate from campus content scripts and Chrome Sync. The app password is **not additionally encrypted at rest**; use a dedicated, revocable app password.
- The extension does not enroll in, drop, or swap events or classes, or bypass university authentication.
- Outlook cleanup remains inactive until configured and manually activated. Microsoft grants it broad calendar read/write access, so every deletion requires explicit selection, review, and confirmation.
- The supported sources are HKUST(GZ) PDC and SIS. Changes to either website’s internal interface may require extension updates.
- Imported entries are not subscriptions. Check PDC or SIS for later changes and cancellations.

Read the [privacy details](PRIVACY.md) and [validation notes](VALIDATION.md).

## Troubleshooting

| Problem | What to do |
| --- | --- |
| No calendar buttons | Reload the extension and PDC, allow access to the PDC site, and check **Enrollment Records**. Buttons appear for enrolled events only. |
| SIS control stays on “Loading class schedule…” | Reload the extension, then reload **My Class Schedule** after SIS has finished signing in. The control activates only when SIS returns enrolled classes. |
| PDC login expired | Sign in normally, then reload PDC. |
| Nothing selected in a batch | Upcoming sessions are selected initially. Choose **Select all** to include past sessions. |
| Schedule cannot be exported | Check that PDC has published valid dates, times, and meeting weekdays. Ambiguous schedules are not guessed. |
| Outlook link loses details or uses the wrong account | Choose the matching school/personal option or use `.ics` import. |
| Nextcloud rejects the connection | Check the specific calendar’s private URL, actual username, app password, and write access. |
| Some Nextcloud additions fail | Check the result counts and retry. Successfully added identical sessions are skipped. |
| Outlook cleanup cannot connect | Verify the Entra client ID, exact redirect URL, SPA platform type, delegated `Calendars.ReadWrite` permission, and any school-tenant consent policy. |
| Microsoft shows AADSTS50194 | The app is single-tenant but the authority is `common`. Paste the app’s Directory (tenant) ID into **Microsoft tenant authority**, then activate again. |

When reporting an issue, include the extension version and error text. Remove tokens, app passwords, student identifiers, and private event details from screenshots or logs.

## Development

The extension has no runtime dependencies or build step. Development uses **Node.js 22+**, **npm**, and **Python 3**. Playwright is used only for browser tests.

```sh
git clone https://github.com/LueApp/add2calendar.git
cd add2calendar
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
| `extension/sis-bridge.js`, `extension/sis-content.js` | SIS schedule capture and injected class-schedule control |
| `extension/outlook.*`, `extension/lib/outlook.mjs` | Manually activated Outlook event review and cleanup |
| `extension/event.*`, `extension/batch.*` | Individual and batch previews |
| `extension/lib/` | Schedule conversion, iCalendar export, and CalDAV writes |
| `tests/` | Unit tests with fictional event data |
| `scripts/browser-test.mjs` | Actual extension tested against simulated PDC, SIS, and calendar responses |
| `scripts/package.py` | Creates the ZIP with `manifest.json` at its root |

Version 0.4.1 passed **26 unit tests and 15 browser integration checks**. Automated tests do not write to real student calendars. See [VALIDATION.md](VALIDATION.md) for test scope and live checks still needed.

## License and references

[MIT License](LICENSE).

[Outlook import](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web) · [Google Calendar import](https://support.google.com/calendar/answer/37118) · [Nextcloud Calendar](https://docs.nextcloud.com/server/stable/user_manual/en/groupware/calendar.html) · [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)
