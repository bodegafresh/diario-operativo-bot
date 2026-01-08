/**
 * sheets.gs
 */

function ss_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getOrCreateSheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.appendRow(headers);
  }
  return sh;
}

function ensureCoreSheets_() {
  getOrCreateSheet_(SHEETS.DAILY, [
    "timestamp",
    "date",
    "from_name",
    "from_user",
    "chat_id",
    "message_id",
    "reply_to_message_id",
    "sleep_hours",
    "energy",
    "mood",
    "focus_type",
    "focus_minutes",
    "training_json",
    "alcohol_consumed",
    "alcohol_context",
    "alcohol_units",
    "stalk_occurred",
    "stalk_intensity",
    "trading_trades",
    "game_commits",
    "feature_done",
    "notes",
    "raw",
  ]);

  getOrCreateSheet_(SHEETS.CHECKINS, [
    "timestamp",
    "date",
    "from_name",
    "from_user",
    "chat_id",
    "message_id",
    "question",
    "intensity_0_10",
    "answer_raw",
  ]);

  getOrCreateSheet_(SHEETS.POMODORO, [
    "timestamp",
    "date",
    "event",
    "phase",
    "cycle",
    "meta",
  ]);
}

function appendDaily_(msg, normalized, rawText) {
  const sh = getOrCreateSheet_(SHEETS.DAILY, null);
  sh.appendRow([
    new Date(),
    normalized.date || isoDate_(new Date()),
    fullNameFromMsg_(msg),
    msg.from && msg.from.username ? msg.from.username : "",
    msg.chat ? msg.chat.id : "",
    msg.message_id || "",
    msg.reply_to_message ? msg.reply_to_message.message_id : "",
    normalized.sleep_hours,
    normalized.energy,
    normalized.mood,

    normalized.focus_type,
    normalized.focus_minutes,

    JSON.stringify(normalized.training || []),

    normalized.alcohol_consumed,
    normalized.alcohol_context,
    normalized.alcohol_units,

    normalized.stalk_occurred,
    normalized.stalk_intensity,

    normalized.trading_trades,
    normalized.game_commits,
    normalized.feature_done,

    normalized.notes || "",
    rawText || "",
  ]);
}

function appendCheckin_(msg, row) {
  const sh = getOrCreateSheet_(SHEETS.CHECKINS, null);
  sh.appendRow([
    new Date(),
    isoDate_(new Date()),
    fullNameFromMsg_(msg),
    msg.from && msg.from.username ? msg.from.username : "",
    msg.chat ? msg.chat.id : "",
    msg.message_id || "",
    row.question || "",
    row.intensity,
    row.answer_raw || "",
  ]);
}

function logPomodoro_(event, phase, cycle, meta) {
  const sh = getOrCreateSheet_(SHEETS.POMODORO, null);
  sh.appendRow([
    new Date(),
    isoDate_(new Date()),
    event,
    phase || "",
    cycle || "",
    meta ? JSON.stringify(meta) : "",
  ]);
}

function fullNameFromMsg_(msg) {
  const f = msg.from && msg.from.first_name ? msg.from.first_name : "";
  const l = msg.from && msg.from.last_name ? msg.from.last_name : "";
  return (f + " " + l).trim();
}
