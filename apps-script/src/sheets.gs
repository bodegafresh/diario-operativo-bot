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
  // Daily
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

  // Checkins
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

  // Pomodoro
  getOrCreateSheet_(SHEETS.POMODORO, [
    "timestamp",
    "date",
    "event",
    "phase",
    "cycle",
    "meta",
  ]);

  // Coach V2 (una sola hoja)
  getOrCreateSheet_(SHEETS.COACH, [
    "timestamp",
    "date",
    "level",
    "day21",
    "week",
    "train_day14",
    "score_0_6",
    "alcohol",
    "workout",
    "read",
    "voice",
    "english",
    "story",
    "ritual",
  ]);
}

function fullNameFromMsg_(msg) {
  const f = msg.from && msg.from.first_name ? msg.from.first_name : "";
  const l = msg.from && msg.from.last_name ? msg.from.last_name : "";
  return (f + " " + l).trim();
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

/**
 * Coach V2 logger (lo llama coach.gs)
 * appendCoachV2Log_(new Date(), { level, score, drank, tasks })
 */
function appendCoachV2Log_(ts, data) {
  const sh = getOrCreateSheet_(SHEETS.COACH, null);

  // state v2 viene de coach.gs
  const st = typeof coachState_ === "function" ? coachState_() : null;

  sh.appendRow([
    ts || new Date(),
    isoDate_(new Date()),
    (data && data.level) || "",
    st ? st.day21 : "",
    st ? st.week : "",
    st ? st.trainDay : "",
    data && data.score != null ? data.score : "",
    data && data.drank ? "true" : "false",
    data && data.tasks && data.tasks.workout ? 1 : 0,
    data && data.tasks && data.tasks.read ? 1 : 0,
    data && data.tasks && data.tasks.voice ? 1 : 0,
    data && data.tasks && data.tasks.english ? 1 : 0,
    data && data.tasks && data.tasks.story ? 1 : 0,
    data && data.tasks && data.tasks.ritual ? 1 : 0,
  ]);
}
