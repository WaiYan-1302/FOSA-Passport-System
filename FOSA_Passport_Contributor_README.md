# FOSA Passport Web System — Contributor README

**Project:** FOSA Passport 2026–2027  
**Platform:** Google Apps Script + Google Sheets + QR codes + printed passport cards  
**Main files:** `Code.gs`, `Index.html`, `Style.html`  
**Audience:** FOSA members, operators, and future student developers

---

## 1. What this system is

FOSA Passport is a lightweight attendance and engagement system for FOSA event participants.

Each participant receives a physical passport card with:

- a visible Passport ID, for example `26F0001`
- a QR code containing a private passport link

When the QR code is scanned, the participant opens their personal FOSA Passport page. On that page they can:

1. register their display name and basic profile on the first scan
2. see their stamp / attendance history
3. enter the event word announced by FOSA staff
4. collect a stamp for the active event

The system is designed for **zero-budget operation** using tools FOSA can already access:

- Google Apps Script as the web app backend
- Google Sheets as the database
- QR codes for each passport
- printed physical cards

---

## 2. Simple explanation for general members

### 2.1 How one passport works

```text
One physical card
= one visible Passport ID
= one private token inside the QR code
= one participant row in Google Sheets
= one attendance history
```

Example:

```text
Printed on card: 26F0001
Hidden in QR:    ?t=5ARNYUP3 or another private token
```

The visible ID is easy for staff to read. The private token makes it harder for people to guess other participants’ passport pages.

### 2.2 What happens at an event

1. FOSA staff prepare an event row in the `Events` sheet.
2. One event is marked as active.
3. FOSA staff announce the event word at the event.
4. Participant scans their passport QR code.
5. Participant enters the event word.
6. The system checks:
   - Does this passport exist?
   - Is this passport active?
   - Is the profile already registered?
   - Is there an active event?
   - Is the event word correct?
   - Has this passport already checked in for this event?
7. If everything is valid, the system writes one row to the `Attendance` sheet.

### 2.3 What Google Sheets does

Google Sheets is the database. It stores:

- passport accounts
- participant names and schools
- event information
- attendance history
- app settings such as the web app URL and logo URL

Members do not need to edit the code to run normal event operations. Most operations happen by editing Google Sheets and running existing Apps Script functions.

---

## 3. Current project files

The system should have only these main files in Apps Script:

```text
Code.gs
Index.html
Style.html
```

### `Code.gs`

Backend logic. It connects to Google Sheets, reads and writes participant/event/attendance data, generates passport accounts, refreshes QR URLs, and provides data to the web page.

### `Index.html`

Frontend structure and JavaScript. It displays the loading screen, registration screen, passport screen, check-in tab, stamps tab, language switching, and calls backend functions using `google.script.run`.

### `Style.html`

CSS. It controls the mobile-first visual design, cards, buttons, logo boxes, tabs, stamps, and responsive layout.

---

## 4. Google Sheets structure

The spreadsheet must contain these four tabs:

```text
Participants
Events
Attendance
Settings
```

Run this Apps Script function to create missing tabs and headers safely:

```javascript
setupDatabaseSafe()
```

This function is designed to be safe. It creates missing sheets/headers but does not clear existing data.

---

## 5. Sheet details

## 5.1 `Participants` sheet

Required headers:

```text
passport_id
display_name
university
country
email
status
created_at
name_locked
registered_at
token
encrypted_url
qr
notes
```

| Column | Meaning |
|---|---|
| `passport_id` | Visible ID printed on the card, such as `26F0001` |
| `display_name` | Name shown on the passport page |
| `university` | Participant university / school |
| `country` | Participant country / region |
| `email` | Optional email |
| `status` | Usually `active`; can be changed later to revoke a passport |
| `created_at` | When this passport row was created |
| `name_locked` | Becomes `TRUE` after first registration |
| `registered_at` | When the participant registered their profile |
| `token` | Private token used in QR URL |
| `encrypted_url` | Full web app URL with token |
| `qr` | Google Sheets QR code image formula |
| `notes` | Internal notes |

### Important participant rule

A passport is usable only when:

```text
status = active
```

If `display_name` is blank, the user sees the registration screen first.

---

## 5.2 `Events` sheet

Required headers:

```text
event_id
event_name
event_date
password
active
start_time
end_time
event_name_en
event_name_ja
image_url
notes
checkin_open_offset_min
checkin_close_offset_min
checkin_timezone
```

| Column | Meaning |
|---|---|
| `event_id` | Unique event code, such as `E001` |
| `event_name` | General event name |
| `event_date` | Event date |
| `password` | Event word/password announced at the event |
| `active` | `TRUE` for the current active event |
| `start_time` | Event start time |
| `end_time` | Event end time |
| `event_name_en` | English event name |
| `event_name_ja` | Japanese event name |
| `image_url` | Optional stamp image URL or Google Drive file ID |
| `notes` | Internal notes |
| `checkin_open_offset_min` | Planned check-in window setting |
| `checkin_close_offset_min` | Planned check-in window setting |
| `checkin_timezone` | Planned timezone setting, usually `Asia/Tokyo` |

### Important current note about check-in window

The current source contains the check-in window columns, but the current `checkIn()` logic mainly checks active event, password, registration, and duplicate attendance. If strict time-window enforcement is needed, developers should confirm or add that logic before relying on these columns operationally.

---

## 5.3 `Attendance` sheet

Required headers:

```text
timestamp
passport_id
event_id
checkin_method
notes
```

Each successful check-in adds one row.

Duplicate prevention is based on:

```text
passport_id + event_id
```

This means one passport can only receive one stamp for the same event.

---

## 5.4 `Settings` sheet

Required headers:

```text
key
value
notes
```

Important settings:

| Key | Meaning |
|---|---|
| `system_name` | Display/system name |
| `admin_email` | FOSA admin contact email |
| `fosa_logo_url` | Logo URL or Google Drive file ID |
| `privacy_policy_url` | Optional privacy policy link |
| `web_app_url` | Deployed `/exec` web app URL used for QR generation |

### Important URL rule

`web_app_url` must be the deployed `/exec` URL.

Correct:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Wrong for printed QR codes:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/dev
```

---

## 6. URL and QR system

### 6.1 Public web app URL

The web app URL is created from Apps Script deployment.

Correct real participant URL:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?t=TOKEN
```

Example:

```text
https://script.google.com/macros/s/AKfycbwdMhZ2aFRDoT6dB8xK-98bKndxzl3kiDSKMjH1FwSngylZxWflyyhtbLthN2djipOQ/exec?t=5ARNYUP3
```

### 6.2 Legacy visible-ID URL

The system can also read legacy visible ID URLs:

```text
/exec?id=26F0001
```

However, for real printed passport cards, token URLs are preferred:

```text
/exec?t=TOKEN
```

### 6.3 QR code formula

QR codes are generated in Google Sheets using the `encrypted_url` cell.

Typical formula:

```excel
=IMAGE("https://quickchart.io/qr?size=300&text="&ENCODEURL(K2))
```

The actual column letter may be different depending on where `encrypted_url` is located.

### 6.4 When to refresh QR codes

Run this after changing the deployment URL or `Settings.web_app_url`:

```javascript
refreshPassportUrls()
```

If QR images still scan to an old deployment, Google Sheets may be caching the image. Delete the QR cells and run `refreshPassportUrls()` again.

---

## 7. Deployment rules

### 7.1 Correct deployment settings

For participants to open the passport page without needing a Google login:

```text
Execute as: Me
Who has access: Anyone
```

If `Who has access` is set to `Anyone with Google account`, participants may be forced to sign in.

If it is set to `Only myself` or a restricted organization/domain, participants will see:

```text
You need access
```

### 7.2 Do not accidentally change deployment ID

The deployment ID is part of every QR URL. If it changes, old QR codes point to the old app.

Safe update method:

```text
Apps Script → Deploy → Manage deployments → Edit existing deployment → Version: New version → Deploy
```

Risky method:

```text
Deploy → New deployment
```

Creating a new deployment may create a new `/exec` URL. If that happens, update `Settings.web_app_url` and run `refreshPassportUrls()`.

### 7.3 `/dev` vs `/exec`

Use `/dev` only for developer testing.

Use `/exec` for real participants and QR codes.

---

## 8. Main backend architecture

### 8.1 Entry point

```javascript
doGet(e)
```

This is the Apps Script web app entry function.

It:

1. reads URL parameters
2. accepts `?t=TOKEN` or `?id=PASSPORT_ID`
3. supports hard debug mode
4. loads `Index.html`
5. passes these template variables to the frontend:
   - `passportKey`
   - `appVersion`
   - `initialSettings`

### 8.2 Frontend/backend communication

The frontend calls backend functions using:

```javascript
google.script.run
```

Main frontend calls:

```javascript
getPassportData(PASSPORT_KEY)
registerProfile(PASSPORT_KEY, profile, agreed)
checkIn(PASSPORT_KEY, password)
```

### 8.3 Backend response pattern

Most backend functions return an object with:

```javascript
{
  ok: true,
  ...data
}
```

or:

```javascript
{
  ok: false,
  code: 'error_code',
  message: 'Human readable message'
}
```

Frontend translations use the `code` value where possible.

---

## 9. Important `Code.gs` constants and variables

### 9.1 `CONFIG`

`CONFIG` is the main backend configuration object.

It contains:

```javascript
CONFIG.SPREADSHEET_ID
CONFIG.APP_TITLE
CONFIG.VERSION
CONFIG.SHEETS
CONFIG.REQUIRED_HEADERS
```

Most important value:

```javascript
SPREADSHEET_ID
```

If the Google Sheet changes, update this ID.

### 9.2 `CONFIG.SHEETS`

Maps logical names to sheet tab names:

```javascript
PARTICIPANTS: 'Participants'
EVENTS: 'Events'
ATTENDANCE: 'Attendance'
SETTINGS: 'Settings'
```

Do not rename sheet tabs unless you also update this config.

### 9.3 `CONFIG.REQUIRED_HEADERS`

Defines required headers for each sheet.

`setupDatabaseSafe()` uses this to create missing headers.

### 9.4 `HEADER_ALIASES`

Allows older or slightly different column names to still work.

For example:

```text
PassportID → passport_id
DisplayName → display_name
EventID → event_id
```

This makes the system more tolerant, but developers should still use the official header names.

---

## 10. Main backend functions

## 10.1 Setup and database functions

### `setupDatabaseSafe()`

Creates missing sheets and headers safely.

Use when setting up the project for the first time or repairing missing headers.

Do not expect it to delete old data.

### `ensureSheet_(ss, sheetName, requiredHeaders)`

Private helper. Creates a sheet if missing and appends missing required headers.

### `formatHeaderRow_(sheet)`

Formats header row and freezes the first row.

### `ensureDefaultSettings_()`

Creates default settings keys if missing.

### `ensureTestEventIfNoEventExists_()`

Creates a test event only if the `Events` sheet is empty.

### `ensureTestPassport0001_()`

Creates test passport `TEST0001` if missing.

---

## 10.2 Passport generation and maintenance

### `generateTestPassports()`

Generates 10 test passports using prefix `TEST`.

### `generateRealPassports100()`

Generates up to 100 real passport rows using prefix `26F`.

### `generateRealPassports300()`

Generates up to 300 real passport rows using prefix `26F`.

### `generatePassportAccounts_(options)`

Private helper used by the generation functions.

It:

1. checks existing Passport IDs
2. generates tokens
3. builds encrypted URLs if `web_app_url` exists
4. builds QR formulas
5. appends rows to `Participants`

### `refreshPassportUrls()`

Regenerates `encrypted_url` and `qr` for all existing participants using the current `Settings.web_app_url`.

Use this when:

- deployment URL changed
- QR codes point to an old restricted deployment
- `web_app_url` was corrected

### `saveCurrentWebAppUrlToSettings()`

Saves the current deployed web app URL into `Settings.web_app_url`.

Run this only after the web app is deployed.

### `resetTestPassport0001()`

Clears profile data and attendance for `TEST0001` so first-scan registration can be tested again.

---

## 10.3 Event functions

### `activateEvent(eventId)`

Sets one event to active and all others to inactive.

This function requires an argument in code. From the Apps Script dropdown, it cannot ask for a parameter. Developers can run it from a temporary wrapper function or from the editor with an argument if using manual execution methods.

Example wrapper:

```javascript
function activateWelcomeParty() {
  activateEvent('E001');
}
```

---

## 10.4 Public backend functions called by frontend

### `getPassportData(passportKey)`

Reads passport data and returns:

- participant profile
- whether registration is required
- active event
- attendance history
- public settings
- app version

Used when the page loads.

### `registerProfile(passportKey, profile, agreedToPrivacy)`

Registers first-scan profile information.

Validates:

- passport key exists
- privacy consent is checked
- display name exists
- email format is acceptable
- passport exists
- passport is active
- passport is not already locked

Then updates:

```text
display_name
university
email
country
name_locked
registered_at
```

### `checkIn(passportKey, password)`

Handles event check-in.

Current logic checks:

- passport key exists
- event word is entered
- database sheets exist
- passport exists
- passport is active
- participant registered profile
- active event exists
- event word matches
- duplicate attendance does not already exist

Then writes to `Attendance`.

It uses `LockService` to reduce duplicate writes if many users check in at the same time.

---

## 10.5 Lookup and normalization helpers

### `findPassportRecord_(sheet, passportKey)`

Finds a participant by token or visible passport ID.

Token match is exact. Passport ID match is case-insensitive.

### `normalizeParticipant_(obj)`

Cleans a participant row into a predictable object.

### `getActiveEventInternal_(sheet)`

Finds the first event row with `active = TRUE`.

### `normalizeEvent_(obj)`

Cleans event data and converts image URLs using `makeImageUrl_()`.

### `toPublicEvent_(event)`

Removes private event fields such as password before sending to frontend.

### `getAttendanceHistory_(attendanceSheet, eventsMap, passportId)`

Builds stamp history for one participant.

### `alreadyCheckedIn_(sheet, passportId, eventId)`

Checks duplicate attendance.

---

## 10.6 Sheet helper functions

These functions make the app work even when columns move:

```javascript
getRecords_(sheet)
getHeaders_(sheet)
getHeaderMap_(sheet)
updateRowByHeaders_(sheet, rowNumber, dataObject)
appendRowByHeaders_(sheet, dataObject)
makeRowFromHeaders_(headers, dataObject)
```

Design idea:

```text
Use header names, not fixed column numbers.
```

This makes the system more robust if someone inserts or moves columns.

---

## 10.7 Settings helper functions

```javascript
getSettingValue_(key)
getSettings_(sheet)
getPublicSettings_(sheet)
getInitialSettings()
getInitialPublicSettingsSafe_()
upsertSetting_(key, value, notes)
```

`getPublicSettings_()` returns only settings that are safe for the frontend:

```text
system_name
admin_email
fosa_logo_url
privacy_policy_url
```

It does not expose event passwords.

---

## 10.8 Utility functions

```javascript
canonicalHeader_(value)
sanitizeText_(value)
normalizeBoolean_(value)
isLikelyEmail_(email)
generateToken_()
columnLetter_(columnNumber)
makeImageUrl_(value)
ok_(data, code, message)
fail_(code, message, extra)
jsonOutput_(object)
```

### `makeImageUrl_(value)`

Accepts either:

- a normal image URL
- a Google Drive file ID
- a Google Drive sharing URL

It converts Drive IDs/URLs into thumbnail URLs that are easier to display in the web app.

---

## 10.9 Debug functions

### Hard debug URL

Use this URL pattern:

```text
/dev?id=TEST0001&mode=harddebug
```

It returns plain text JSON instead of the UI.

Use it to check:

- whether the correct spreadsheet is connected
- whether the Participants sheet exists
- whether the passport key is found
- what app version is running

### `debugDirectPassportTest()`

Logs the result of:

```javascript
getPassportData('TEST0001')
```

### `debugDatabaseConnection()`

Logs spreadsheet and test passport connection information.

---

## 11. Frontend architecture: `Index.html`

The frontend is a single mobile-first page with multiple screens.

Main screens:

```text
loadingScreen
errorScreen
registerScreen
passportScreen
```

Inside the passport screen:

```text
checkinTab
stampsTab
```

### Main frontend variables

```javascript
PASSPORT_KEY
APP_VERSION
INITIAL_SETTINGS
LANGUAGE_STORAGE_KEY
currentLanguage
currentData
activeTab
I18N
```

### Main frontend functions

```javascript
bootApp()
loadPassport()
renderRegistration(data)
submitRegistration(event)
renderPassport(data)
renderActiveEvent(eventData)
submitCheckIn(event)
renderStamps(attendance)
showTab(tabName)
showScreen(screenId)
showError(message)
toggleLanguage()
applyLanguage()
tr(key)
getResultMessage(result, fallback)
getLocalizedEventName(item)
getInitial(name)
applyLogo(settings)
setFixedLogoImage(imageId, fallbackId, url)
renderPrivacyPolicy(settings)
setMessage(element, text, type)
setButtonLoading(button, isLoading)
showToast(message)
escapeHtml(value)
```

### Language system

The web app supports English and Japanese.

The selected language is stored in browser local storage:

```javascript
fosaPassportLanguage
```

Translation text is stored in the `I18N` object.

### Logo system

The logo can be set from `Settings.fosa_logo_url`.

If no logo URL exists or the image fails to load, the UI shows the text fallback:

```text
FOSA
```

Caution: frontend syntax errors can freeze the app on the loading screen. If the language toggle does not work, suspect a JavaScript syntax error before suspecting Google Sheets.

---

## 12. CSS architecture: `Style.html`

The design is:

```text
mobile-first
clean
soft blue / white
rounded cards
large tap targets
simple bilingual UI
```

Important CSS variables:

```css
--bg-main
--bg-deep
--card
--text
--muted
--accent
--accent-deep
--accent-soft
--success
--danger
--line
--shadow
--soft-shadow
--inner-shadow
--radius-xl
--radius-lg
--radius-md
```

Main UI classes:

```css
.app-shell
.screen
.language-toggle
.hero-card
.content-card
.center-card
.fixed-logo-box
.fixed-logo-img
.primary-button
.message
.passport-hero
.avatar-ring
.avatar
.stats-grid
.stat-card
.tab-bar
.tab
.tab-content
.event-box
.stamp-grid
.stamp-item
.toast
.hidden
```

---

## 13. Normal operation guide

## 13.1 First setup

1. Open the Apps Script project.
2. Confirm `CONFIG.SPREADSHEET_ID` matches the Google Sheet.
3. Run:

```javascript
setupDatabaseSafe()
```

4. Deploy web app:

```text
Execute as: Me
Who has access: Anyone
```

5. Run:

```javascript
saveCurrentWebAppUrlToSettings()
```

6. Generate passports:

```javascript
generateRealPassports100()
```

or:

```javascript
generateRealPassports300()
```

7. If needed, run:

```javascript
refreshPassportUrls()
```

8. Test one QR code from the sheet before printing.

---

## 13.2 Before each event

1. Add or confirm event row in `Events`.
2. Make sure only one event is active.
3. Confirm event password.
4. Confirm QR links open on a non-owner phone/account.
5. Test one check-in with a test passport.

---

## 13.3 During event

1. Announce the event word only at the event.
2. Participants scan passport QR.
3. Participants enter event word.
4. Staff monitor `Attendance` sheet if needed.

---

## 13.4 After event

1. Confirm attendance count.
2. Check if any duplicate or suspicious rows exist.
3. Deactivate or change active event when finished.
4. Back up the spreadsheet periodically.

---

## 14. Developer caution list

### Do not duplicate these functions

There should be only one:

```javascript
doGet(e)
include(filename)
getPassportData(passportKey)
registerProfile(...)
checkIn(...)
```

Duplicate Apps Script functions can cause confusing behavior.

### Do not rename sheets casually

These exact tabs are expected:

```text
Participants
Events
Attendance
Settings
```

### Do not delete required headers

The system uses headers to find columns.

### Do not print `/dev` QR codes

Real QR codes must use `/exec`.

### Do not create new deployment unless necessary

Use **Manage deployments → Edit existing deployment → New version** to preserve the deployment ID.

### Do not put event passwords inside QR codes

QR code should only identify the passport, not the event password.

### Do not expose private settings to frontend

Only public settings should be returned by `getPublicSettings_()`.

### Be careful with logo changes

A previous logo fix caused a frontend JavaScript syntax error, which froze the loading screen. If the page stays on loading and language toggle does not work, check browser console / JavaScript syntax first.

---

## 15. Common problems and fixes

### Problem: QR opens “You need access”

Likely causes:

- QR points to `/dev`
- QR points to old restricted deployment
- deployment access is not `Anyone`

Fix:

1. Confirm the scanned QR URL.
2. Confirm deployment setting is `Who has access: Anyone`.
3. Confirm `Settings.web_app_url` uses the current `/exec` URL.
4. Run:

```javascript
refreshPassportUrls()
```

### Problem: Manual link works but QR fails

Likely cause:

```text
QR image is stale and still contains old URL.
```

Fix:

1. Delete QR cells.
2. Run `refreshPassportUrls()`.
3. Scan the new QR from the sheet.

### Problem: Loading screen never ends

If the language toggle does not work, likely cause:

```text
frontend JavaScript syntax error
```

If the language toggle works but loading never ends, likely causes:

```text
backend function error
passport not found
wrong spreadsheet
Google Apps Script permission issue
```

Use hard debug:

```text
/dev?id=TEST0001&mode=harddebug
```

### Problem: Passport not found

Check:

- token exists in `Participants.token`
- visible ID exists in `Participants.passport_id`
- QR URL uses correct token
- no extra spaces in the sheet

### Problem: User cannot register

Check:

- `display_name` is blank for first-time registration
- `status` is `active`
- privacy checkbox is checked
- email is valid or blank

### Problem: User cannot check in

Check:

- user already registered profile
- exactly one event is active
- event password is correct
- participant has not already checked in for this event
- `Attendance` sheet has correct headers

---

## 16. Suggested contribution workflow

1. Make a backup of the spreadsheet.
2. Copy current `Code.gs`, `Index.html`, and `Style.html` to a backup folder.
3. Edit only one part at a time.
4. Test `/dev?id=TEST0001` first.
5. Test `/dev?id=TEST0001&mode=harddebug` if backend is suspected.
6. Test a real `/exec?t=TOKEN` URL.
7. Deploy using existing deployment, not new deployment.
8. Test from a different Google account or incognito browser.
9. Only then refresh QR codes or print new cards.

---

## 17. Recommended future improvements

Possible future improvements:

- Add strict check-in time-window enforcement using `checkin_open_offset_min`, `checkin_close_offset_min`, and `checkin_timezone`.
- Add admin dashboard for events and attendance.
- Add event-specific stamp images.
- Add export/report function for attendance.
- Add safer token generation if using short tokens.
- Add staff-only revocation screen.
- Add privacy policy page.
- Add multilingual support beyond English/Japanese.
- Add clearer “contact FOSA staff” flow for name corrections.

---

## 18. Mental model for future developers

The cleanest way to understand the whole system is:

```text
URL token
↓
find participant row
↓
if not registered: show registration
↓
if registered: show passport page
↓
active event + event word
↓
write attendance row
↓
attendance history becomes stamp history
```

Keep this flow simple. Most bugs happen when the deployment URL, QR URL, spreadsheet headers, or frontend JavaScript are changed without testing each layer separately.
