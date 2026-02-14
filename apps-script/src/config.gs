/**
 * config.gs
 * Config + Script Properties
 */

const PROP = {
  BOT_TOKEN: "BOT_TOKEN",
  SPREADSHEET_ID: "SPREADSHEET_ID",
  CHAT_ID: "CHAT_ID",

  WEBAPP_URL: "WEBAPP_URL",
  WORKER_URL: "WORKER_URL",
  TG_WEBHOOK_SECRET: "TG_WEBHOOK_SECRET",

  CHECKINS_SETUP: "CHECKINS_SETUP",
  DIARY_REMINDER_SETUP: "DIARY_REMINDER_SETUP",
  COACH_SETUP: "COACH_SETUP",

  LAST_UPDATE_ID: "LAST_UPDATE_ID",
  CHECKIN_QUESTION_HISTORY: "CHECKIN_QUESTION_HISTORY",

  // Coach: solo configuración (estado va en Sheets "CoachState")
  COACH_ENABLED: "COACH_ENABLED",
  COACH_LEVEL: "COACH_LEVEL",
  COACH_START_ISO: "COACH_START_ISO",

  // Pomodoro: estado + configuración (almacenado en Properties por simplicidad)
  POMO_ENABLED: "POMO_ENABLED",
  POMO_PHASE: "POMO_PHASE",           // "work" | "short_break" | "long_break"
  POMO_CYCLE: "POMO_CYCLE",           // 1-4
  POMO_END_MS: "POMO_END_MS",         // milliseconds when current phase ends
  POMO_LAST_DATE: "POMO_LAST_DATE",   // YYYY-MM-DD to detect day changes

  // OpenAI
  OPENAI_API_KEY: "OPENAI_API_KEY",
  ENGLISH_CONFIG: "ENGLISH_CONFIG",
  ENGLISH_COACH_LANG: "ENGLISH_COACH_LANG",
};

const SHEETS = {
  DAILY: "Daily",
  CHECKINS: "Checkins",
  POMODORO: "Pomodoro",
  POMO_STATE: "PomodoroState", // DEPRECATED: No longer used (state in Properties)
  COACH: "Coach",
  COACH_STATE: "CoachState",
  ENGLISH_VOICE: "EnglishVoice",
};

const DEFAULTS = {
  CHECKIN_START_H: 6,
  CHECKIN_END_H: 22,
  CHECKINS_PER_DAY: 3,
  CHECKIN_MIN_GAP_MIN: 90,

  DIARY_REMINDER_H: 21,
  DIARY_REMINDER_M: 30,

  // Pomodoro: horario permitido (formato 24h)
  POMO_START_H: 9,
  POMO_END_H: 19,
  // Pomodoro: días permitidos (1=Lun, 2=Mar, ..., 5=Vie, 6=Sáb, 0=Dom)
  // Por defecto solo Lun-Vie
  POMO_ALLOWED_DAYS: [1, 2, 3, 4, 5],

  POMO_WORK_MIN: 25,
  POMO_SHORT_BREAK_MIN: 5,
  POMO_LONG_BREAK_MIN: 15,
  POMO_SET_SIZE: 4,
  // English AI (uses LockService, no properties needed for lock)
  ENGLISH_MAX_MB: 25,
  ENGLISH_PROCESSING_TIMEOUT_MIN: 5,
};

function cfgGet_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === "" ? fallback : v;
}

function cfgSet_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function cfgDel_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function getBotToken_() {
  const token = cfgGet_(PROP.BOT_TOKEN, "");
  if (!token) throw new Error("Falta BOT_TOKEN en Script Properties.");
  return token;
}

function getSpreadsheetId_() {
  const id = cfgGet_(PROP.SPREADSHEET_ID, "");
  if (!id) throw new Error("Falta SPREADSHEET_ID en Script Properties.");
  return id;
}

function getChatId_() {
  return cfgGet_(PROP.CHAT_ID, "");
}

function setChatId_(chatId) {
  cfgSet_(PROP.CHAT_ID, chatId);
}
