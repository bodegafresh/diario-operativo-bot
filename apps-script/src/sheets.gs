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

  // EnglishVoice
  getOrCreateSheet_(SHEETS.ENGLISH_VOICE, [
    "timestamp",
    "date",
    "chat_id",
    "message_id",
    "reply_to_message_id",
    "file_id",
    "file_unique_id",
    "mime_type",
    "file_size_bytes",
    "duration_seconds",
    "drive_file_id",
    "drive_file_url",
    "status",
    "transcript_full",
    "transcript_short",
    "fixes_1",
    "fixes_2",
    "fixes_3",
    "better_version",
    "tomorrow_drill",
    "verb_focus",
    "error_message",
    "updated_at",
  ]);

  // CoachState: state tracking for Coach v3 (replaces properties)
  getOrCreateSheet_(SHEETS.COACH_STATE, [
    "timestamp",
    "date",
    "week_index",
    "day90",
    "day21",
    "cycle21",
    "train_day14",
    "impulse_count",
    "last_am",
    "last_pm",
    "last_rem_1",
    "last_rem_2",
    "last_rem_3",
    "last_rem_4",
    "ritual_daily_date",
    "ritual_daily_affirmations",
  ]);

  // PomodoroState: state tracking for Pomodoro (replaces properties)
  getOrCreateSheet_(SHEETS.POMO_STATE, [
    "timestamp",
    "date",
    "phase",
    "cycle",
    "end_ms",
    "last_date",
  ]);

  // Coach V2 (una sola hoja - legacy, ya no se usa)
  // getOrCreateSheet_(SHEETS.COACH, [...]);

  // Coach V3 (misma hoja "Coach", headers actualizados)
  ensureCoachV3Sheet_();
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

function appendEnglishVoice_(chatId, messageId, replyToMsgId, voiceMeta) {
  // voiceMeta: { file_id, file_unique_id, duration, mime_type, file_size }
  // Append inicial con status RECEIVED
  const sh = getOrCreateSheet_(SHEETS.ENGLISH_VOICE, null);
  sh.appendRow([
    new Date(),                          // timestamp
    isoDate_(new Date()),                // date
    chatId,                              // chat_id
    messageId,                           // message_id
    replyToMsgId || "",                  // reply_to_message_id
    voiceMeta.file_id || "",             // file_id
    voiceMeta.file_unique_id || "",      // file_unique_id
    voiceMeta.mime_type || "",           // mime_type
    voiceMeta.file_size || 0,            // file_size_bytes
    voiceMeta.duration || 0,             // duration_seconds
    "",                                  // drive_file_id (será llenado luego)
    "",                                  // drive_file_url
    "RECEIVED",                          // status
    "",                                  // transcript_full
    "",                                  // transcript_short
    "",                                  // fixes_1
    "",                                  // fixes_2
    "",                                  // fixes_3
    "",                                  // better_version
    "",                                  // tomorrow_drill
    "",                                  // verb_focus
    "",                                  // error_message
    isoDateTime_(new Date()),            // updated_at
  ]);
}

function updateEnglishVoiceLog_(messageId, updates) {
  // updates: { status?, drive_file_id?, drive_file_url?, transcript_full?, transcript_short?,
  //            fixes_1?, fixes_2?, fixes_3?, better_version?, tomorrow_drill?, verb_focus?, error_message? }
  const sh = getOrCreateSheet_(SHEETS.ENGLISH_VOICE, null);
  const data = sh.getDataRange().getValues();
  
  // Encabezados: [0]
  const headers = data[0];
  const msgIdIdx = headers.indexOf("message_id");
  if (msgIdIdx < 0) return; // No encontru columna
  
  // Buscar fila por message_id
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][msgIdIdx]) === String(messageId)) {
      rowIdx = i + 1; // +1 porque sheets usa 1-indexed
      break;
    }
  }
  
  if (rowIdx < 0) return; // Fila no encontrada
  
  // Actualizar campos
  const fieldsToUpdate = [
    "status", "drive_file_id", "drive_file_url", "transcript_full", "transcript_short",
    "fixes_1", "fixes_2", "fixes_3", "better_version", "tomorrow_drill", "verb_focus",
    "error_message", "updated_at"
  ];
  
  for (const field of fieldsToUpdate) {
    const colIdx = headers.indexOf(field);
    if (colIdx >= 0 && updates.hasOwnProperty(field)) {
      let value = updates[field];
      if (field === "updated_at" && !value) {
        value = isoDateTime_(new Date());
      }
      sh.getRange(rowIdx, colIdx + 1).setValue(value);
    }
  }
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
  getOrCreateSheet_(SHEETS.COACH_V3, [
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
  const sh = getOrCreateSheet_(SHEETS.COACH_V3, null);

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
