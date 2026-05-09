/***** FOSA Passport System 2026–2027 *****/
/***** Clean long-term version: safe setup, short token URLs, QR codes, mobile web app, check-in period enforcement *****/

/**
 * IMPORTANT:
 * Replace this ID if your Google Sheet changes.
 * Spreadsheet URL format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 */
const CONFIG = Object.freeze({
  SPREADSHEET_ID: '18cdrDj5U8TsFytafHfVqN2nnwHbW7tsXju3DHY4fBo0',
  APP_TITLE: 'FOSA Passport',
  VERSION: '2026-05-clean-v4-short-token-notebook-checkin-period',
  TIME_ZONE: 'Asia/Tokyo',

  // Short private QR token. Example: K7Q9M2XA
  // This prevents predictable URLs while keeping QR URLs short and readable.
  TOKEN_LENGTH: 8,
  TOKEN_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',

  // Default check-in period = exactly event start_time to end_time.
  // Per-event offsets can override this in Events sheet.
  DEFAULT_CHECKIN_OPEN_OFFSET_MIN: 0,
  DEFAULT_CHECKIN_CLOSE_OFFSET_MIN: 0,

  SHEETS: Object.freeze({
    PARTICIPANTS: 'Participants',
    EVENTS: 'Events',
    ATTENDANCE: 'Attendance',
    SETTINGS: 'Settings'
  }),

  REQUIRED_HEADERS: Object.freeze({
    Participants: [
      'passport_id',
      'display_name',
      'university',
      'country',
      'email',
      'status',
      'created_at',
      'name_locked',
      'registered_at',
      'token',
      'encrypted_url',
      'qr',
      'notes'
    ],

    Events: [
      'event_id',
      'event_name',
      'event_date',
      'password',
      'active',
      'start_time',
      'end_time',
      'checkin_open_offset_min',
      'checkin_close_offset_min',
      'checkin_timezone',
      'event_name_en',
      'event_name_ja',
      'image_url',
      'notes'
    ],

    Attendance: [
      'timestamp',
      'passport_id',
      'event_id',
      'checkin_method',
      'notes'
    ],

    Settings: [
      'key',
      'value',
      'notes'
    ]
  })
});

/**
 * Header aliases make the app tolerant of older or manually typed sheet headers.
 */
const HEADER_ALIASES = Object.freeze({
  passportid: 'passport_id',
  passport_id: 'passport_id',
  passport_url: 'encrypted_url',
  passporturl: 'encrypted_url',
  encryptedurl: 'encrypted_url',
  encrypted_url: 'encrypted_url',
  url: 'encrypted_url',
  qrcode: 'qr',
  qr_code: 'qr',
  name: 'display_name',
  displayname: 'display_name',
  display_name: 'display_name',
  school: 'university',
  university_school: 'university',
  country_region: 'country',
  locked: 'name_locked',
  namelocked: 'name_locked',
  name_locked: 'name_locked',
  registeredat: 'registered_at',
  registered_at: 'registered_at',
  eventid: 'event_id',
  event_id: 'event_id',
  eventname: 'event_name',
  event_name: 'event_name',
  eventdate: 'event_date',
  event_date: 'event_date',
  starttime: 'start_time',
  start_time: 'start_time',
  endtime: 'end_time',
  end_time: 'end_time',
  checkinopenoffsetmin: 'checkin_open_offset_min',
  checkin_open_offset_min: 'checkin_open_offset_min',
  checkinopenmin: 'checkin_open_offset_min',
  openoffsetmin: 'checkin_open_offset_min',
  checkincloseoffsetmin: 'checkin_close_offset_min',
  checkin_close_offset_min: 'checkin_close_offset_min',
  checkinclosemin: 'checkin_close_offset_min',
  closeoffsetmin: 'checkin_close_offset_min',
  checkintimezone: 'checkin_timezone',
  checkin_timezone: 'checkin_timezone',
  timezone: 'checkin_timezone',
  eventnameen: 'event_name_en',
  event_name_en: 'event_name_en',
  eventnameja: 'event_name_ja',
  event_name_ja: 'event_name_ja',
  imageurl: 'image_url',
  image_url: 'image_url',
  checkinmethod: 'checkin_method',
  checkin_method: 'checkin_method'
});

/***** Web App Entry *****/

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const token = sanitizeText_(params.t);
  const legacyId = sanitizeText_(params.id);
  const passportKey = token || legacyId || '';

  // Hard debug route. Example: /dev?id=TEST0001&mode=harddebug
  if (params.mode === 'harddebug' || params.debug === '1') {
    return jsonOutput_(hardDebug_(passportKey || 'TEST0001'));
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.passportKey = passportKey;
  template.appVersion = CONFIG.VERSION;

  return template
    .evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/***** Database Connection *****/

function getDatabase_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/***** Safe Database Setup *****/

/**
 * SAFE setup.
 * It creates missing sheets and missing headers only.
 * It never clears existing participant/event/attendance data.
 */
function setupDatabaseSafe() {
  const ss = getDatabase_();

  ensureSheet_(ss, CONFIG.SHEETS.PARTICIPANTS, CONFIG.REQUIRED_HEADERS.Participants);
  ensureSheet_(ss, CONFIG.SHEETS.EVENTS, CONFIG.REQUIRED_HEADERS.Events);
  ensureSheet_(ss, CONFIG.SHEETS.ATTENDANCE, CONFIG.REQUIRED_HEADERS.Attendance);
  ensureSheet_(ss, CONFIG.SHEETS.SETTINGS, CONFIG.REQUIRED_HEADERS.Settings);

  ensureDefaultSettings_();
  ensureTestEventIfNoEventExists_();
  ensureTestPassport0001_();
  deleteBlankDefaultSheet_();

  Logger.log('setupDatabaseSafe completed. Existing data was not cleared.');
}

function ensureSheet_(ss, sheetName, requiredHeaders) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, Math.max(lastColumn, 1))
      .getDisplayValues()[0]
      .map(header => canonicalHeader_(header));

    const existing = new Set(currentHeaders.filter(Boolean));
    let appendAt = sheet.getLastColumn() + 1;

    requiredHeaders.forEach(header => {
      const canonical = canonicalHeader_(header);

      if (!existing.has(canonical)) {
        sheet.getRange(1, appendAt).setValue(header);
        existing.add(canonical);
        appendAt++;
      }
    });
  }

  formatHeaderRow_(sheet);
}

function formatHeaderRow_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) return;

  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, lastColumn)
    .setFontWeight('bold')
    .setBackground('#e7faff')
    .setFontColor('#164a57');

  sheet.autoResizeColumns(1, lastColumn);
}

function ensureDefaultSettings_() {
  upsertSetting_('system_name', 'FOSA Passport', 'Website/app name');
  upsertSetting_('admin_email', 'info.fosa16@gmail.com', 'Admin contact email');
  upsertSetting_('fosa_logo_url', '', 'Optional FOSA logo Google Drive file ID or image URL');
  upsertSetting_('privacy_policy_url', '', 'Optional privacy policy URL');
  upsertSetting_('web_app_url', '', 'Paste deployed /exec web app URL here later');
}

function ensureTestEventIfNoEventExists_() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);

  if (sheet.getLastRow() >= 2) {
    Logger.log('Events already exist. No test event added.');
    return;
  }

  appendRowByHeaders_(sheet, {
    event_id: 'E001',
    event_name: 'FOSA Welcome Party',
    event_date: Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd'),
    password: 'TEST123',
    active: true,
    start_time: '00:00',
    end_time: '23:59',
    checkin_open_offset_min: 0,
    checkin_close_offset_min: 0,
    checkin_timezone: CONFIG.TIME_ZONE,
    event_name_en: 'FOSA Welcome Party',
    event_name_ja: 'FOSAウェルカムパーティー',
    image_url: '',
    notes: 'Test event'
  });

  Logger.log('Test event E001 created.');
}

function ensureTestPassport0001_() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const existing = findPassportRecord_(sheet, 'TEST0001');

  if (existing) {
    Logger.log('TEST0001 already exists.');
    return;
  }

  appendRowByHeaders_(sheet, {
    passport_id: 'TEST0001',
    display_name: '',
    university: '',
    country: '',
    email: '',
    status: 'active',
    created_at: new Date(),
    name_locked: false,
    registered_at: '',
    token: generateUniqueToken_(getExistingTokens_(sheet)),
    encrypted_url: '',
    qr: '',
    notes: 'Safe setup test passport'
  });

  Logger.log('TEST0001 created.');
}

function deleteBlankDefaultSheet_() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName('Sheet1');

  if (!sheet) return;
  if (ss.getSheets().length <= 1) return;

  const hasData = sheet.getDataRange().getDisplayValues().some(row => {
    return row.some(cell => sanitizeText_(cell));
  });

  if (!hasData) {
    ss.deleteSheet(sheet);
  }
}

/***** Admin / Maintenance Functions *****/

function generateTestPassports() {
  generatePassportAccounts_({
    prefix: 'TEST',
    startNumber: 1,
    count: 10,
    digits: 4
  });
}

function generateRealPassports100() {
  generatePassportAccounts_({
    prefix: '26F',
    startNumber: 1,
    count: 100,
    digits: 4
  });
}

function generateRealPassports300() {
  generatePassportAccounts_({
    prefix: '26F',
    startNumber: 1,
    count: 300,
    digits: 4
  });
}

/**
 * One-click test notebook creation:
 * Creates 10 empty test passports, fills tokenized /exec URLs, and generates QR formulas.
 */
function createEmptyTokenizedTestNotebook10() {
  setupDatabaseSafe();
  generateTestPassports();
  prepareTokenizedUrlsAndQrCodes();
}

/**
 * One-click real notebook creation:
 * Creates 100 empty 26F passports, fills tokenized /exec URLs, and generates QR formulas.
 */
function createEmptyTokenizedPassportNotebook100() {
  setupDatabaseSafe();
  generateRealPassports100();
  prepareTokenizedUrlsAndQrCodes();
}

/**
 * One-click real notebook creation:
 * Creates 300 empty 26F passports, fills tokenized /exec URLs, and generates QR formulas.
 */
function createEmptyTokenizedPassportNotebook300() {
  setupDatabaseSafe();
  generateRealPassports300();
  prepareTokenizedUrlsAndQrCodes();
}

function generatePassportAccounts_(options) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);

  if (!sheet) {
    throw new Error('Participants sheet not found. Run setupDatabaseSafe() first.');
  }

  const headers = getHeaders_(sheet);
  const existingIds = getExistingPassportIds_(sheet);
  const existingTokens = getExistingTokens_(sheet);
  const webAppUrl = getWebAppUrlForQr_({ allowBlank: true });

  const rows = [];
  const currentLastRow = sheet.getLastRow();

  for (let i = 0; i < options.count; i++) {
    const number = options.startNumber + i;
    const passportId = options.prefix + String(number).padStart(options.digits, '0');

    if (existingIds.has(passportId)) {
      continue;
    }

    const token = generateUniqueToken_(existingTokens);
    existingTokens.add(token);
    const encryptedUrl = webAppUrl ? `${webAppUrl}?t=${encodeURIComponent(token)}` : '';
    const futureRowNumber = currentLastRow + rows.length + 1;
    const urlColumnNumber = headers.indexOf('encrypted_url') + 1;
    const urlColumnLetter = urlColumnNumber > 0 ? columnLetter_(urlColumnNumber) : 'K';
    const qrFormula = encryptedUrl
      ? `=IMAGE("https://quickchart.io/qr?size=300&text="&ENCODEURL(${urlColumnLetter}${futureRowNumber}))`
      : '';

    rows.push(makeRowFromHeaders_(headers, {
      passport_id: passportId,
      display_name: '',
      university: '',
      country: '',
      email: '',
      status: 'active',
      created_at: new Date(),
      name_locked: false,
      registered_at: '',
      token: token,
      encrypted_url: encryptedUrl,
      qr: qrFormula,
      notes: ''
    }));

    existingIds.add(passportId);
  }

  if (rows.length === 0) {
    Logger.log('No new passports generated. They may already exist.');
    return;
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log(`${rows.length} passport accounts generated.`);
}

/**
 * Fills missing tokens, tokenized URLs, and QR formulas for all existing participant rows.
 * This is the safest function to run after deployment and before printing cards.
 */
function prepareTokenizedUrlsAndQrCodes() {
  setupDatabaseSafe();
  ensureParticipantTokens_();
  refreshPassportUrls();
  Logger.log('Tokenized URLs and QR codes prepared.');
}

function ensureParticipantTokens_() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const headers = getHeaders_(sheet);
  const tokenCol = headers.indexOf('token') + 1;

  if (!tokenCol) {
    throw new Error('token column not found. Run setupDatabaseSafe() first.');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const existingTokens = getExistingTokens_(sheet);

  for (let row = 2; row <= lastRow; row++) {
    const token = sanitizeText_(sheet.getRange(row, tokenCol).getValue());

    if (!token) {
      const newToken = generateUniqueToken_(existingTokens);
      existingTokens.add(newToken);
      sheet.getRange(row, tokenCol).setValue(newToken);
    } else {
      existingTokens.add(token);
    }
  }
}

function refreshPassportUrls() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const webAppUrl = getWebAppUrlForQr_({ allowBlank: false });
  const headers = getHeaders_(sheet);
  const tokenCol = headers.indexOf('token') + 1;
  const urlCol = headers.indexOf('encrypted_url') + 1;
  const qrCol = headers.indexOf('qr') + 1;

  if (!tokenCol || !urlCol || !qrCol) {
    throw new Error('Required columns missing: token, encrypted_url, qr');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('No participants found.');
    return;
  }

  const existingTokens = getExistingTokens_(sheet);

  for (let row = 2; row <= lastRow; row++) {
    let token = sanitizeText_(sheet.getRange(row, tokenCol).getValue());

    if (!token) {
      token = generateUniqueToken_(existingTokens);
      existingTokens.add(token);
      sheet.getRange(row, tokenCol).setValue(token);
    } else {
      existingTokens.add(token);
    }

    const encryptedUrl = `${webAppUrl}?t=${encodeURIComponent(token)}`;

    sheet.getRange(row, urlCol).setValue(encryptedUrl);
    sheet.getRange(row, qrCol).setFormula(
      `=IMAGE("https://quickchart.io/qr?size=300&text="&ENCODEURL(${columnLetter_(urlCol)}${row}))`
    );
  }

  sheet.autoResizeColumns(1, headers.length);
  Logger.log('Passport URLs and QR codes refreshed.');
}

function getWebAppUrlForQr_(options) {
  options = options || {};

  let url = sanitizeText_(getSettingValue_('web_app_url'));

  if (!url) {
    const deployedUrl = sanitizeText_(ScriptApp.getService().getUrl());

    if (deployedUrl) {
      url = deployedUrl;
      upsertSetting_('web_app_url', url, 'Current deployed /exec web app URL');
    }
  }

  if (!url && options.allowBlank) {
    return '';
  }

  if (!url) {
    throw new Error('web_app_url is empty in Settings. Deploy the web app, paste the /exec URL into Settings.web_app_url, then run prepareTokenizedUrlsAndQrCodes().');
  }

  return url.replace(/\/dev(?:\?.*)?$/, '/exec').replace(/\?.*$/, '');
}

function saveCurrentWebAppUrlToSettings() {
  const url = sanitizeText_(ScriptApp.getService().getUrl());

  if (!url) {
    throw new Error('No deployed web app URL found. Deploy the web app first.');
  }

  upsertSetting_('web_app_url', url, 'Current deployed Apps Script web app URL');
  Logger.log('Saved web_app_url: ' + url);
}

function activateEvent(eventId) {
  eventId = sanitizeText_(eventId);

  if (!eventId) {
    throw new Error('eventId is required.');
  }

  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  const records = getRecords_(sheet);
  const headerMap = getHeaderMap_(sheet);
  const activeCol = headerMap.active;

  if (!activeCol) {
    throw new Error('active column not found.');
  }

  let found = false;

  records.records.forEach(record => {
    const rowEventId = sanitizeText_(record.obj.event_id);
    const shouldActivate = rowEventId === eventId;

    if (shouldActivate) found = true;

    sheet.getRange(record.rowNumber, activeCol).setValue(shouldActivate);
  });

  if (!found) {
    throw new Error('Event not found: ' + eventId);
  }

  Logger.log('Activated event: ' + eventId);
}

function resetTestPassport0001() {
  const ss = getDatabase_();
  const participantsSheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const attendanceSheet = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  const record = findPassportRecord_(participantsSheet, 'TEST0001');

  if (!record) {
    ensureTestPassport0001_();
  } else {
    updateRowByHeaders_(participantsSheet, record.rowNumber, {
      display_name: '',
      university: '',
      country: '',
      email: '',
      name_locked: false,
      registered_at: '',
      status: 'active'
    });
  }

  removeAttendanceForPassport_('TEST0001', attendanceSheet);
  Logger.log('TEST0001 reset for testing.');
}

/***** Public Backend Functions Called by Index.html *****/

function getPassportData(passportKey) {
  passportKey = sanitizeText_(passportKey);

  if (!passportKey) {
    return fail_('missing_key', 'Passport key is missing.');
  }

  const ss = getDatabase_();
  const participantsSheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  const attendanceSheet = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!participantsSheet || !eventsSheet || !attendanceSheet || !settingsSheet) {
    return fail_('missing_sheets', 'Database sheets are missing. Run setupDatabaseSafe() first.');
  }

  const record = findPassportRecord_(participantsSheet, passportKey);

  if (!record) {
    return fail_('passport_not_found', 'Passport not found.');
  }

  const participant = normalizeParticipant_(record.obj);

  if (participant.status !== 'active') {
    return fail_('passport_inactive', 'This passport is not active.');
  }

  const activeEventInternal = getActiveEventInternal_(eventsSheet);
  const eventsMap = getEventsMap_(eventsSheet);
  const attendance = getAttendanceHistory_(attendanceSheet, eventsMap, participant.passport_id);

  return ok_({
    requiresRegistration: !participant.display_name,
    participant: participant,
    activeEvent: activeEventInternal ? toPublicEvent_(activeEventInternal) : null,
    attendance: attendance,
    settings: getPublicSettings_(settingsSheet),
    app: {
      title: CONFIG.APP_TITLE,
      version: CONFIG.VERSION
    }
  });
}

function registerProfile(passportKey, profile, agreedToPrivacy) {
  passportKey = sanitizeText_(passportKey);

  if (!passportKey) {
    return fail_('missing_key', 'Passport key is missing.');
  }

  if (!agreedToPrivacy) {
    return fail_('privacy_required', 'Please agree to the privacy notice before registering.');
  }

  profile = profile || {};

  const displayName = sanitizeText_(profile.displayName);
  const university = sanitizeText_(profile.university);
  const email = sanitizeText_(profile.email);
  const country = sanitizeText_(profile.country);

  if (!displayName) {
    return fail_('display_name_required', 'Display name is required.');
  }

  if (email && !isLikelyEmail_(email)) {
    return fail_('invalid_email', 'Please enter a valid email address or leave it blank.');
  }

  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);

  if (!sheet) {
    return fail_('missing_participants', 'Participants sheet not found.');
  }

  const record = findPassportRecord_(sheet, passportKey);

  if (!record) {
    return fail_('passport_not_found', 'Passport not found.');
  }

  const participant = normalizeParticipant_(record.obj);

  if (participant.status !== 'active') {
    return fail_('passport_inactive', 'This passport is not active.');
  }

  if (participant.display_name && participant.name_locked === true) {
    return ok_({
      alreadyRegistered: true,
      data: getPassportData(passportKey)
    }, 'already_registered', 'This passport has already been registered.');
  }

  updateRowByHeaders_(sheet, record.rowNumber, {
    display_name: displayName,
    university: university,
    email: email,
    country: country,
    name_locked: true,
    registered_at: new Date()
  });

  return getPassportData(passportKey);
}

function checkIn(passportKey, password) {
  passportKey = sanitizeText_(passportKey);
  password = sanitizeText_(password);

  if (!passportKey) {
    return fail_('missing_key', 'Passport key is missing.');
  }

  if (!password) {
    return fail_('event_word_required', 'Please enter the event word.');
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const ss = getDatabase_();
    const participantsSheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
    const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
    const attendanceSheet = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);

    if (!participantsSheet || !eventsSheet || !attendanceSheet) {
      return fail_('missing_sheets', 'Database sheets are missing.');
    }

    const record = findPassportRecord_(participantsSheet, passportKey);

    if (!record) {
      return fail_('passport_not_found', 'Passport not found.');
    }

    const participant = normalizeParticipant_(record.obj);

    if (participant.status !== 'active') {
      return fail_('passport_inactive', 'This passport is not active.');
    }

    if (!participant.display_name) {
      return fail_('registration_required', 'Please register your profile first.');
    }

    const activeEvent = getActiveEventInternal_(eventsSheet);

    if (!activeEvent) {
      return fail_('no_active_event', 'No active event is available now.');
    }

    const checkinWindow = evaluateEventCheckinWindow_(activeEvent, new Date());

    if (!checkinWindow.allowed) {
      return fail_('checkin_outside_period', 'Cannot check-in outside of check-in period.', {
        checkinWindow: checkinWindow.public
      });
    }

    const correctPassword = sanitizeText_(activeEvent.password);

    if (password.toUpperCase() !== correctPassword.toUpperCase()) {
      return fail_('incorrect_event_word', 'Incorrect event word.');
    }

    const duplicate = alreadyCheckedIn_(attendanceSheet, participant.passport_id, activeEvent.event_id);

    if (duplicate) {
      return ok_({
        alreadyCheckedIn: true,
        data: getPassportData(passportKey)
      }, 'already_checked_in', 'You have already checked in for this event.');
    }

    appendRowByHeaders_(attendanceSheet, {
      timestamp: new Date(),
      passport_id: participant.passport_id,
      event_id: activeEvent.event_id,
      checkin_method: 'password',
      notes: ''
    });

    return ok_({
      alreadyCheckedIn: false,
      data: getPassportData(passportKey)
    }, 'checkin_done', 'Check-in completed.');

  } catch (error) {
    return fail_('server_error', error.message || String(error));
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

/***** Lookup / Normalization Helpers *****/

function findPassportRecord_(sheet, passportKey) {
  passportKey = sanitizeText_(passportKey);

  if (!passportKey || !sheet) return null;

  const data = getRecords_(sheet);

  for (let i = 0; i < data.records.length; i++) {
    const record = data.records[i];
    const token = sanitizeText_(record.obj.token);
    const passportId = sanitizeText_(record.obj.passport_id);

    if (token && token === passportKey) {
      return record;
    }

    if (passportId && passportId.toUpperCase() === passportKey.toUpperCase()) {
      return record;
    }
  }

  return null;
}

function normalizeParticipant_(obj) {
  return {
    passport_id: sanitizeText_(obj.passport_id),
    display_name: sanitizeText_(obj.display_name),
    university: sanitizeText_(obj.university),
    country: sanitizeText_(obj.country),
    email: sanitizeText_(obj.email),
    status: sanitizeText_(obj.status || 'active').toLowerCase(),
    created_at: sanitizeText_(obj.created_at),
    name_locked: normalizeBoolean_(obj.name_locked),
    registered_at: sanitizeText_(obj.registered_at),
    token: sanitizeText_(obj.token),
    encrypted_url: sanitizeText_(obj.encrypted_url)
  };
}

function getActiveEventInternal_(sheet) {
  const data = getRecords_(sheet);

  for (let i = 0; i < data.records.length; i++) {
    const event = normalizeEvent_(data.records[i].obj);

    if (normalizeBoolean_(event.active)) {
      return event;
    }
  }

  return null;
}

function normalizeEvent_(obj) {
  return {
    event_id: sanitizeText_(obj.event_id),
    event_name: sanitizeText_(obj.event_name),
    event_date: sanitizeText_(obj.event_date),
    password: sanitizeText_(obj.password),
    active: normalizeBoolean_(obj.active),
    start_time: sanitizeText_(obj.start_time),
    end_time: sanitizeText_(obj.end_time),
    checkin_open_offset_min: sanitizeText_(obj.checkin_open_offset_min),
    checkin_close_offset_min: sanitizeText_(obj.checkin_close_offset_min),
    checkin_timezone: sanitizeText_(obj.checkin_timezone),
    event_name_en: sanitizeText_(obj.event_name_en),
    event_name_ja: sanitizeText_(obj.event_name_ja),
    image_url: makeImageUrl_(obj.image_url),
    notes: sanitizeText_(obj.notes)
  };
}

function toPublicEvent_(event) {
  return {
    event_id: event.event_id,
    event_name: event.event_name,
    event_date: event.event_date,
    active: event.active,
    start_time: event.start_time,
    end_time: event.end_time,
    checkin_open_offset_min: event.checkin_open_offset_min,
    checkin_close_offset_min: event.checkin_close_offset_min,
    checkin_timezone: event.checkin_timezone || CONFIG.TIME_ZONE,
    checkin_window: getPublicCheckinWindowInfo_(event),
    event_name_en: event.event_name_en,
    event_name_ja: event.event_name_ja,
    image_url: event.image_url
  };
}

function getEventsMap_(sheet) {
  const data = getRecords_(sheet);
  const map = {};

  data.records.forEach(record => {
    const event = normalizeEvent_(record.obj);

    if (!event.event_id) return;

    map[event.event_id] = toPublicEvent_(event);
  });

  return map;
}

function getAttendanceHistory_(attendanceSheet, eventsMap, passportId) {
  const data = getRecords_(attendanceSheet);
  const history = [];

  data.records.forEach(record => {
    const row = record.obj;

    if (sanitizeText_(row.passport_id).toUpperCase() !== passportId.toUpperCase()) {
      return;
    }

    const eventId = sanitizeText_(row.event_id);
    const event = eventsMap[eventId] || {};

    history.push({
      timestamp: sanitizeText_(row.timestamp),
      passport_id: passportId,
      event_id: eventId,
      event_name: event.event_name || eventId,
      event_name_en: event.event_name_en || event.event_name || eventId,
      event_name_ja: event.event_name_ja || event.event_name || eventId,
      event_date: event.event_date || '',
      image_url: event.image_url || ''
    });
  });

  return history;
}

function alreadyCheckedIn_(sheet, passportId, eventId) {
  const data = getRecords_(sheet);

  for (let i = 0; i < data.records.length; i++) {
    const row = data.records[i].obj;

    if (
      sanitizeText_(row.passport_id).toUpperCase() === passportId.toUpperCase() &&
      sanitizeText_(row.event_id) === eventId
    ) {
      return true;
    }
  }

  return false;
}

/***** Event Check-in Period Helpers *****/

/**
 * Backend enforcement for event check-in period.
 * If outside the allowed period, users get one simple message:
 * "Cannot check-in outside of check-in period."
 */
function evaluateEventCheckinWindow_(event, now) {
  const publicInfo = getPublicCheckinWindowInfo_(event, now);

  if (!publicInfo.configured || !publicInfo.is_open) {
    return {
      allowed: false,
      code: 'checkin_outside_period',
      message: 'Cannot check-in outside of check-in period.',
      public: publicInfo
    };
  }

  return {
    allowed: true,
    code: 'checkin_open',
    message: 'Check-in is open.',
    public: publicInfo
  };
}

function getPublicCheckinWindowInfo_(event, now) {
  now = now || new Date();

  const timeZone = sanitizeText_(event.checkin_timezone) || CONFIG.TIME_ZONE || Session.getScriptTimeZone();
  const openOffsetMin = parseIntegerOrDefault_(
    event.checkin_open_offset_min,
    CONFIG.DEFAULT_CHECKIN_OPEN_OFFSET_MIN
  );
  const closeOffsetMin = parseIntegerOrDefault_(
    event.checkin_close_offset_min,
    CONFIG.DEFAULT_CHECKIN_CLOSE_OFFSET_MIN
  );

  const dateParts = parseEventDateParts_(event.event_date);
  const startTimeParts = parseTimeParts_(event.start_time);
  const endTimeParts = parseTimeParts_(event.end_time);
  const nowParts = getNowPartsInTimeZone_(now, timeZone);

  const base = {
    configured: false,
    is_open: false,
    status: 'config_error',
    timezone: timeZone,
    open_offset_min: openOffsetMin,
    close_offset_min: closeOffsetMin,
    now: nowParts ? formatDateTimeParts_(nowParts) : '',
    opens_at: '',
    closes_at: '',
    event_starts_at: '',
    event_ends_at: ''
  };

  if (!dateParts || !startTimeParts || !endTimeParts || !nowParts) {
    return base;
  }

  const eventStartMinute = toLocalSerialMinute_(dateParts, startTimeParts);
  let eventEndMinute = toLocalSerialMinute_(dateParts, endTimeParts);

  // Supports overnight events, e.g. 22:00–01:00.
  if (eventEndMinute <= eventStartMinute) {
    eventEndMinute += 24 * 60;
  }

  const windowOpenMinute = eventStartMinute + openOffsetMin;
  const windowCloseMinute = eventEndMinute + closeOffsetMin;
  let nowMinute = toLocalSerialMinute_(nowParts, nowParts);

  // If event is overnight and current time is after midnight, compare against the event's extended end day.
  if (eventEndMinute > eventStartMinute + 24 * 60 && nowMinute < eventStartMinute) {
    nowMinute += 24 * 60;
  }

  let status = 'open';

  if (nowMinute < windowOpenMinute) {
    status = 'before_window';
  } else if (nowMinute > windowCloseMinute) {
    status = 'after_window';
  }

  return {
    configured: true,
    is_open: status === 'open',
    status: status,
    timezone: timeZone,
    open_offset_min: openOffsetMin,
    close_offset_min: closeOffsetMin,
    now: formatDateTimeParts_(nowParts),
    opens_at: formatLocalSerialMinute_(windowOpenMinute),
    closes_at: formatLocalSerialMinute_(windowCloseMinute),
    event_starts_at: formatLocalSerialMinute_(eventStartMinute),
    event_ends_at: formatLocalSerialMinute_(eventEndMinute)
  };
}

function parseEventDateParts_(value) {
  const text = sanitizeText_(value);

  if (!text) return null;

  let match = text.match(/^(\d{4})[\-\/\.年](\d{1,2})[\-\/\.月](\d{1,2})日?/);

  if (match) {
    return normalizeDateParts_(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // Fallback for sheets that display dates as MM/DD/YYYY or M/D/YYYY.
  match = text.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})$/);

  if (match) {
    return normalizeDateParts_(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  return null;
}

function parseTimeParts_(value) {
  const text = sanitizeText_(value)
    .replace(/：/g, ':')
    .replace(/午前/g, 'AM')
    .replace(/午後/g, 'PM');

  if (!text) return null;

  let match = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?\s*(AM|PM)?$/i);

  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3] ? match[3].toUpperCase() : '';

    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    return normalizeTimeParts_(hour, minute);
  }

  match = text.match(/^(\d{1,2})時(?:(\d{1,2})分?)?/);

  if (match) {
    return normalizeTimeParts_(Number(match[1]), match[2] ? Number(match[2]) : 0);
  }

  return null;
}

function normalizeDateParts_(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const test = new Date(Date.UTC(year, month - 1, day));

  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() + 1 !== month ||
    test.getUTCDate() !== day
  ) {
    return null;
  }

  return { year: year, month: month, day: day };
}

function normalizeTimeParts_(hour, minute) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour: hour, minute: minute };
}

function getNowPartsInTimeZone_(now, timeZone) {
  const text = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd HH:mm');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

function toLocalSerialMinute_(dateParts, timeParts) {
  return Math.floor(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hour,
      timeParts.minute,
      0,
      0
    ) / 60000
  );
}

function formatLocalSerialMinute_(serialMinute) {
  const date = new Date(serialMinute * 60000);

  return [
    date.getUTCFullYear(),
    '-',
    pad2_(date.getUTCMonth() + 1),
    '-',
    pad2_(date.getUTCDate()),
    ' ',
    pad2_(date.getUTCHours()),
    ':',
    pad2_(date.getUTCMinutes())
  ].join('');
}

function formatDateTimeParts_(parts) {
  return [
    parts.year,
    '-',
    pad2_(parts.month),
    '-',
    pad2_(parts.day),
    ' ',
    pad2_(parts.hour),
    ':',
    pad2_(parts.minute)
  ].join('');
}

function parseIntegerOrDefault_(value, defaultValue) {
  const text = sanitizeText_(value);

  if (!text) return Number(defaultValue) || 0;

  const number = Number(text);

  return Number.isFinite(number) ? Math.trunc(number) : (Number(defaultValue) || 0);
}

function pad2_(number) {
  return String(number).padStart(2, '0');
}

function debugActiveEventCheckinWindow() {
  const ss = getDatabase_();
  const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  const activeEvent = getActiveEventInternal_(eventsSheet);

  if (!activeEvent) {
    Logger.log('No active event.');
    return;
  }

  Logger.log(JSON.stringify(getPublicCheckinWindowInfo_(activeEvent, new Date()), null, 2));
}

function setActiveEventWindowOpenNowForTesting() {
  const ss = getDatabase_();
  const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  const activeEvent = getActiveEventInternal_(eventsSheet);

  if (!activeEvent) {
    throw new Error('No active event found.');
  }

  const records = getRecords_(eventsSheet);
  const activeRecord = records.records.find(record => {
    return sanitizeText_(record.obj.event_id) === activeEvent.event_id;
  });

  if (!activeRecord) {
    throw new Error('Active event row not found.');
  }

  const nowParts = getNowPartsInTimeZone_(new Date(), CONFIG.TIME_ZONE);
  const nowMinute = toLocalSerialMinute_(nowParts, nowParts);

  updateRowByHeaders_(eventsSheet, activeRecord.rowNumber, {
    event_date: `${nowParts.year}-${pad2_(nowParts.month)}-${pad2_(nowParts.day)}`,
    start_time: formatLocalSerialMinute_(nowMinute - 10).slice(11),
    end_time: formatLocalSerialMinute_(nowMinute + 50).slice(11),
    checkin_open_offset_min: 0,
    checkin_close_offset_min: 0,
    checkin_timezone: CONFIG.TIME_ZONE
  });

  Logger.log('Active event check-in window set to open now for testing.');
}

/***** Sheet Helpers *****/

function getRecords_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();

  if (values.length < 1) {
    return {
      headers: [],
      records: []
    };
  }

  const headers = values[0].map(header => canonicalHeader_(header));
  const records = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const isBlankRow = row.every(cell => !sanitizeText_(cell));

    if (isBlankRow) continue;

    const obj = {};

    headers.forEach((header, c) => {
      if (!header) return;
      obj[header] = row[c];
    });

    records.push({
      rowNumber: r + 1,
      obj: obj
    });
  }

  return {
    headers: headers,
    records: records
  };
}

function getHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(header => canonicalHeader_(header));
}

function getHeaderMap_(sheet) {
  const headers = getHeaders_(sheet);
  const map = {};

  headers.forEach((header, index) => {
    if (header && !map[header]) {
      map[header] = index + 1;
    }
  });

  return map;
}

function updateRowByHeaders_(sheet, rowNumber, dataObject) {
  const headerMap = getHeaderMap_(sheet);

  Object.keys(dataObject).forEach(key => {
    const header = canonicalHeader_(key);
    const column = headerMap[header];

    if (column) {
      sheet.getRange(rowNumber, column).setValue(dataObject[key]);
    }
  });
}

function appendRowByHeaders_(sheet, dataObject) {
  const headers = getHeaders_(sheet);
  const row = makeRowFromHeaders_(headers, dataObject);
  sheet.appendRow(row);
}

function makeRowFromHeaders_(headers, dataObject) {
  return headers.map(header => {
    return Object.prototype.hasOwnProperty.call(dataObject, header)
      ? dataObject[header]
      : '';
  });
}

function getExistingPassportIds_(sheet) {
  const data = getRecords_(sheet);
  const set = new Set();

  data.records.forEach(record => {
    const id = sanitizeText_(record.obj.passport_id);

    if (id) {
      set.add(id);
    }
  });

  return set;
}

function getExistingTokens_(sheet) {
  const data = getRecords_(sheet);
  const set = new Set();

  data.records.forEach(record => {
    const token = sanitizeText_(record.obj.token);

    if (token) {
      set.add(token);
    }
  });

  return set;
}

function removeAttendanceForPassport_(passportId, sheet) {
  const data = getRecords_(sheet);
  const rowsToDelete = [];

  data.records.forEach(record => {
    if (sanitizeText_(record.obj.passport_id).toUpperCase() === passportId.toUpperCase()) {
      rowsToDelete.push(record.rowNumber);
    }
  });

  rowsToDelete.reverse().forEach(rowNumber => {
    sheet.deleteRow(rowNumber);
  });
}

/***** Settings Helpers *****/

function getSettingValue_(key) {
  const settingsSheet = getDatabase_().getSheetByName(CONFIG.SHEETS.SETTINGS);
  const settings = getSettings_(settingsSheet);
  return settings[key] || '';
}

function getSettings_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  const settings = {};

  for (let i = 1; i < values.length; i++) {
    const key = sanitizeText_(values[i][0]);
    const value = sanitizeText_(values[i][1]);

    if (key) {
      settings[key] = value;
    }
  }

  return settings;
}

function getPublicSettings_(sheet) {
  const settings = getSettings_(sheet);

  return {
    system_name: settings.system_name || CONFIG.APP_TITLE,
    admin_email: settings.admin_email || '',
    fosa_logo_url: makeImageUrl_(settings.fosa_logo_url || ''),
    privacy_policy_url: settings.privacy_policy_url || ''
  };
}

function upsertSetting_(key, value, notes) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  const values = sheet.getDataRange().getDisplayValues();

  for (let i = 1; i < values.length; i++) {
    if (sanitizeText_(values[i][0]) === key) {
      if (!sanitizeText_(values[i][1]) && value !== '') {
        sheet.getRange(i + 1, 2).setValue(value);
      }

      if (notes && !sanitizeText_(values[i][2])) {
        sheet.getRange(i + 1, 3).setValue(notes);
      }

      return;
    }
  }

  sheet.appendRow([key, value, notes || '']);
}

/***** Utilities *****/

function canonicalHeader_(value) {
  const raw = sanitizeText_(value);
  const normalized = raw
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return HEADER_ALIASES[normalized] || normalized;
}

function sanitizeText_(value) {
  if (value === null || typeof value === 'undefined') return '';

  return String(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBoolean_(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text = sanitizeText_(value).toUpperCase();
  return text === 'TRUE' || text === 'YES' || text === '1' || text === 'ON';
}

function isLikelyEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken_() {
  const alphabet = CONFIG.TOKEN_ALPHABET;
  const tokenLength = CONFIG.TOKEN_LENGTH;
  let token = '';

  // Two UUIDs give enough random material for short, non-predictable tokens.
  const seed = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

  for (let i = 0; i < tokenLength; i++) {
    const pair = seed.substring(i * 2, i * 2 + 2);
    const number = parseInt(pair, 16);
    token += alphabet[number % alphabet.length];
  }

  return token;
}

function generateUniqueToken_(existingTokens) {
  existingTokens = existingTokens || new Set();

  for (let attempt = 0; attempt < 25; attempt++) {
    const token = generateToken_();

    if (!existingTokens.has(token)) {
      return token;
    }
  }

  throw new Error('Could not generate a unique passport token. Please try again.');
}

function columnLetter_(columnNumber) {
  let letter = '';

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return letter;
}

function makeImageUrl_(value) {
  const input = sanitizeText_(value);

  if (!input) return '';

  const bareDriveIdPattern = /^[a-zA-Z0-9_-]{20,}$/;

  if (bareDriveIdPattern.test(input) && !input.startsWith('http')) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(input)}&sz=w600`;
  }

  if (input.includes('drive.google.com')) {
    const patterns = [
      /\/d\/([a-zA-Z0-9_-]{20,})/,
      /id=([a-zA-Z0-9_-]{20,})/
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = input.match(patterns[i]);

      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w600`;
      }
    }
  }

  return input;
}

function ok_(data, code, message) {
  const result = { ok: true };

  if (code) result.code = code;
  if (message) result.message = message;

  return Object.assign(result, data || {});
}

function fail_(code, message, extra) {
  return Object.assign({
    ok: false,
    code: code || 'error',
    message: message || 'Something went wrong.'
  }, extra || {});
}

function jsonOutput_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object, null, 2))
    .setMimeType(ContentService.MimeType.TEXT);
}

/***** Debug Functions *****/

function hardDebug_(passportKey) {
  const ss = getDatabase_();
  const participantsSheet = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  const eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  const activeEvent = eventsSheet ? getActiveEventInternal_(eventsSheet) : null;

  const result = {
    receivedKey: passportKey,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    configuredSpreadsheetId: CONFIG.SPREADSHEET_ID,
    participantsSheetExists: Boolean(participantsSheet),
    eventsSheetExists: Boolean(eventsSheet),
    lastRow: participantsSheet ? participantsSheet.getLastRow() : null,
    lastColumn: participantsSheet ? participantsSheet.getLastColumn() : null,
    headers: null,
    firstTenPassportIds: [],
    found: false,
    foundRow: null,
    foundObject: null,
    activeEvent: activeEvent ? toPublicEvent_(activeEvent) : null,
    activeEventCheckinWindow: activeEvent ? getPublicCheckinWindowInfo_(activeEvent, new Date()) : null,
    appVersion: CONFIG.VERSION
  };

  if (!participantsSheet) return result;

  const records = getRecords_(participantsSheet);
  result.headers = records.headers;

  records.records.slice(0, 10).forEach(record => {
    result.firstTenPassportIds.push(sanitizeText_(record.obj.passport_id));
  });

  const found = findPassportRecord_(participantsSheet, passportKey);

  if (found) {
    result.found = true;
    result.foundRow = found.rowNumber;
    result.foundObject = found.obj;
  }

  return result;
}

function debugDirectPassportTest() {
  const result = getPassportData('TEST0001');
  Logger.log(JSON.stringify(result, null, 2));
}

function debugDatabaseConnection() {
  const ss = getDatabase_();
  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());

  const participants = ss.getSheetByName(CONFIG.SHEETS.PARTICIPANTS);
  Logger.log('Participants sheet found: ' + Boolean(participants));

  if (participants) {
    const record = findPassportRecord_(participants, 'TEST0001');
    Logger.log(record ? JSON.stringify(record, null, 2) : 'TEST0001 NOT FOUND');
  }
}
