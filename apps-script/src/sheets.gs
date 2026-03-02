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

  // coach
  getOrCreateSheet_(SHEETS.COACH, [
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

function fullNameFromMsg_(msg) {
  const f = msg.from && msg.from.first_name ? msg.from.first_name : "";
  const l = msg.from && msg.from.last_name ? msg.from.last_name : "";
  return (f + " " + l).trim();
}

function appendDaily_(msg, normalized, rawText) {
  const ts = new Date();
  const dt = normalized.date || isoDate_(ts);
  const usr = msg.from && msg.from.username ? msg.from.username : "";

  const sh = getOrCreateSheet_(SHEETS.DAILY, null);
  sh.appendRow([
    ts,
    dt,
    fullNameFromMsg_(msg),
    usr,
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

  try {
    sbUpsert_(
      "daily",
      [
        {
          recorded_at: ts.toISOString(),
          date: dt,
          from_name: fullNameFromMsg_(msg),
          from_user: usr,
          chat_id: String(msg.chat ? msg.chat.id : ""),
          message_id: String(msg.message_id || ""),
          reply_to_message_id: String(
            msg.reply_to_message ? msg.reply_to_message.message_id : "",
          ),
          sleep_hours: normalized.sleep_hours,
          energy: normalized.energy,
          mood: normalized.mood,
          focus_type: normalized.focus_type || "none",
          focus_minutes: normalized.focus_minutes || 0,
          training_json: normalized.training || [],
          alcohol_consumed: !!normalized.alcohol_consumed,
          alcohol_context: normalized.alcohol_context || "unknown",
          alcohol_units: normalized.alcohol_units || 0,
          stalk_occurred: !!normalized.stalk_occurred,
          stalk_intensity: normalized.stalk_intensity || "none",
          trading_trades: normalized.trading_trades || 0,
          game_commits: normalized.game_commits || 0,
          feature_done: !!normalized.feature_done,
          notes: normalized.notes || null,
          raw: rawText || null,
        },
      ],
      "date,from_user",
      false,
    );
  } catch (e) {
    Logger.log("[SB daily] " + e.message);
  }
}

function appendCheckin_(msg, row) {
  const ts = new Date();
  const dt = isoDate_(ts);
  const usr = msg.from && msg.from.username ? msg.from.username : "";
  const mid = String(msg.message_id || "");

  const sh = getOrCreateSheet_(SHEETS.CHECKINS, null);
  sh.appendRow([
    ts,
    dt,
    fullNameFromMsg_(msg),
    usr,
    msg.chat ? msg.chat.id : "",
    mid,
    row.question || "",
    row.intensity,
    row.answer_raw || "",
  ]);

  try {
    sbUpsert_(
      "checkins",
      [
        {
          recorded_at: ts.toISOString(),
          date: dt,
          from_name: fullNameFromMsg_(msg),
          from_user: usr,
          chat_id: String(msg.chat ? msg.chat.id : ""),
          message_id: mid,
          question: row.question || "",
          intensity_0_10: row.intensity,
          answer_raw: row.answer_raw || null,
        },
      ],
      "message_id",
      false,
    );
  } catch (e) {
    Logger.log("[SB checkin] " + e.message);
  }
}

function appendEnglishVoice_(chatId, messageId, replyToMsgId, voiceMeta) {
  // voiceMeta: { file_id, file_unique_id, duration, mime_type, file_size }
  // Append inicial con status RECEIVED
  const ts = new Date();
  const dt = isoDate_(ts);

  const sh = getOrCreateSheet_(SHEETS.ENGLISH_VOICE, null);
  sh.appendRow([
    ts, // timestamp
    dt, // date
    chatId, // chat_id
    messageId, // message_id
    replyToMsgId || "", // reply_to_message_id
    voiceMeta.file_id || "", // file_id
    voiceMeta.file_unique_id || "", // file_unique_id
    voiceMeta.mime_type || "", // mime_type
    voiceMeta.file_size || 0, // file_size_bytes
    voiceMeta.duration || 0, // duration_seconds
    "", // drive_file_id (será llenado luego)
    "", // drive_file_url
    "RECEIVED", // status
    "", // transcript_full
    "", // transcript_short
    "", // fixes_1
    "", // fixes_2
    "", // fixes_3
    "", // better_version
    "", // tomorrow_drill
    "", // verb_focus
    "", // error_message
    isoDateTime_(ts), // updated_at
  ]);

  console.log("[SB] appendEnglishVoice_ reached, message_id=" + String(messageId));
  try {
    sbUpsert_(
      "english_voice",
      [
        {
          recorded_at: ts.toISOString(),
          updated_at: ts.toISOString(),
          date: dt,
          chat_id: String(chatId),
          message_id: String(messageId),
          reply_to_message_id: String(replyToMsgId || ""),
          file_id: voiceMeta.file_id || null,
          file_unique_id: voiceMeta.file_unique_id || null,
          mime_type: voiceMeta.mime_type || null,
          file_size_bytes: voiceMeta.file_size || null,
          duration_seconds: voiceMeta.duration || null,
          status: "RECEIVED",
        },
      ],
      "message_id",
      false,
    ); // DO UPDATE: si ya existe la fila, actualiza los metadatos (audio, date, etc.) pero el status avanzado se preserva vía updateEnglishVoiceLog_
    console.log("[SB] appendEnglishVoice_ sbUpsert_ completed OK");
  } catch (e) {
    console.log("[SB english_voice init] ERROR: " + e.message);
  }
}

function updateEnglishVoiceLog_(messageId, updates) {
  // updates: { status?, drive_file_id?, drive_file_url?, transcript_full?, transcript_short?,
  //            fixes_1?, fixes_2?, fixes_3?, better_version?, tomorrow_drill?, verb_focus?, error_message? }

  const fieldsToUpdate = [
    "status",
    "drive_file_id",
    "drive_file_url",
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
  ];

  // ── Supabase PATCH (independiente de Sheets — corre siempre) ────────────────
  try {
    const patch = {};
    fieldsToUpdate.forEach(function (f) {
      if (updates.hasOwnProperty(f)) patch[f] = updates[f];
    });
    if (!patch.updated_at) patch.updated_at = new Date().toISOString();
    sbUpdate_("english_voice", { message_id: "eq." + String(messageId) }, patch);
  } catch (e) {
    console.log("[SB english_voice update] " + e.message);
  }

  // ── Google Sheets update ────────────────────────────────────────────────────
  const sh = getOrCreateSheet_(SHEETS.ENGLISH_VOICE, null);
  const data = sh.getDataRange().getValues();

  const headers = data[0];
  const msgIdIdx = headers.indexOf("message_id");
  if (msgIdIdx < 0) return;

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][msgIdIdx]) === String(messageId)) {
      rowIdx = i + 1; // +1 porque sheets usa 1-indexed
      break;
    }
  }

  if (rowIdx < 0) return;

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
  const ts = new Date();
  const dt = isoDate_(ts);

  const sh = getOrCreateSheet_(SHEETS.POMODORO, null);
  sh.appendRow([
    ts,
    dt,
    event,
    phase || "",
    cycle || "",
    meta ? JSON.stringify(meta) : "",
  ]);

  try {
    sbUpsert_(
      "pomodoro",
      [
        {
          recorded_at: ts.toISOString(),
          date: dt,
          event: event,
          phase: phase || null,
          cycle: cycle || null,
          meta: meta || {},
        },
      ],
      "recorded_at",
      true,
    ); // ignore on conflict
  } catch (e) {
    Logger.log("[SB pomodoro] " + e.message);
  }
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
  const sh = getOrCreateSheet_(SHEETS.COACH, null);

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

  try {
    sbUpsert_(
      "coach",
      [
        {
          recorded_at: (ts || new Date()).toISOString(),
          date: isoDate_(ts || new Date()),
          level: (data && data.level) || null,
          start_iso: st ? st.startIso : null,
          day90: st ? st.day90 : null,
          week_1_12: st ? st.week : null,
          cycle21_1_4: st ? st.cycle21 : null,
          day21_1_21: st ? st.day21 : null,
          train_day14_1_14: st ? st.trainDay : null,
          phase: ph ? ph.phase : null,
          theme21: th ? th.name : null,
          score_0_6: data && data.score != null ? data.score : null,
          tier: tier || null,
          alcohol_bool: !!(data && data.drank),
          impulses_count: data && data.impulses != null ? data.impulses : 0,
          workout_done: !!(tasks.workout),
          read_done: !!(tasks.read),
          voice_done: !!(tasks.voice),
          english_done: !!(tasks.english),
          story_done: !!(tasks.story),
          ritual_done: !!(tasks.ritual),
          note: (data && data.note) || null,
          raw_json: data || {},
        },
      ],
      "date",
      false,
    );
  } catch (e) {
    Logger.log("[SB coach] " + e.message);
  }
}
