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
 * appendCoachV3Log_ (para sheets.gs)
 *
 * Recomendación: crea una nueva hoja "CoachV3" (o reutiliza SHEETS.COACH si quieres),
 * pero ideal separar v2 y v3 para no mezclar columnas.
 *
 * Este logger está diseñado para:
 * - 90 días + 12 semanas + ciclos 21 días
 * - score (0..6), alcohol, impulsos
 * - flags de tareas (workout/read/voice/english/story/ritual)
 *
 * Se llama desde coach.gs así:
 * appendCoachV3Log_(new Date(), { level, score, drank, impulses, tasks })
 */

/** Asegura hoja CoachV3 con headers (llámalo desde ensureCoreSheets_()) */
function ensureCoachV3Sheet_() {
  // Si ya tienes un enum SHEETS, agrega: SHEETS.COACH_V3 = "CoachV3"
  const sheetName =
    typeof SHEETS !== "undefined" && SHEETS.COACH_V3
      ? SHEETS.COACH_V3
      : "CoachV3";

  getOrCreateSheet_(sheetName, [
    "timestamp",
    "date",
    "level",

    "start_iso",
    "day90",
    "week_1_12",

    "cycle21_1_4",
    "day21_1_21",

    "train_day14_1_14",

    "phase", // FUNDAMENTO / CONSTRUCCIÓN / INTEGRACIÓN
    "theme21", // CONTROL DE IMPULSOS / DISCIPLINA ESTABLE / ...

    "score_0_6",
    "tier", // valid / fragile
    "alcohol_bool",
    "impulses_count",

    "workout_done",
    "read_done",
    "voice_done",
    "english_done",
    "story_done",
    "ritual_done",

    "note", // opcional
    "raw_json", // payload completo por si quieres auditar luego
  ]);
}

/** Helper: seguro boolean->1/0 */
function b01_(v) {
  return v ? 1 : 0;
}

/**
 * Logger V3
 * @param {Date} ts
 * @param {Object} data { level, score, drank, impulses, tasks, tier?, note? }
 */
function appendCoachV3Log_(ts, data) {
  const sheetName =
    typeof SHEETS !== "undefined" && SHEETS.COACH_V3
      ? SHEETS.COACH_V3
      : "CoachV3";
  const sh = getOrCreateSheet_(sheetName, null);

  // Estado del coach v3 (viene de coach.gs)
  const st = typeof coachState_ === "function" ? coachState_() : null;

  // Fase y tema (desde coach.gs)
  const ph =
    st && typeof coachPhaseByWeek_ === "function"
      ? coachPhaseByWeek_(st.week)
      : null;

  const th =
    st && typeof coachTheme21_ === "function"
      ? coachTheme21_(st.cycle21)
      : null;

  // Deriva tier si no viene (regla: >= validMin -> valid; si no -> fragile)
  let tier = (data && data.tier) || "";
  if (
    !tier &&
    typeof coachParams_ === "function" &&
    data &&
    data.score != null
  ) {
    const p = coachParams_();
    tier = data.score < p.validMin ? "fragile" : "valid";
  }

  const tasks = (data && data.tasks) || {};

  const row = [
    ts || new Date(),
    isoDate_(ts || new Date()),
    (data && data.level) || "",

    st ? st.startIso : "",
    st ? st.day90 : "",
    st ? st.week : "",

    st ? st.cycle21 : "",
    st ? st.day21 : "",

    st ? st.trainDay : "",

    ph ? ph.phase : "",
    th ? th.name : "",

    data && data.score != null ? data.score : "",
    tier,
    b01_(data && data.drank),
    data && data.impulses != null ? data.impulses : 0,

    b01_(tasks.workout),
    b01_(tasks.read),
    b01_(tasks.voice),
    b01_(tasks.english),
    b01_(tasks.story),
    b01_(tasks.ritual),

    (data && data.note) || "",
    data ? JSON.stringify(data) : "",
  ];

  sh.appendRow(row);
}
