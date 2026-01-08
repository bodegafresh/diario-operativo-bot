/**
 * config.gs
 * Toda configuración se lee desde Script Properties para evitar credenciales en código.
 */

const PROP = {
  BOT_TOKEN: "BOT_TOKEN",
  CHAT_ID: "CHAT_ID", // se auto-aprende, pero puedes fijarlo
  SPREADSHEET_ID: "SPREADSHEET_ID",

  CHECKINS_SETUP: "CHECKINS_SETUP",
  DIARY_REMINDER_SETUP: "DIARY_REMINDER_SETUP",

  POMO_ENABLED: "POMO_ENABLED",
  POMO_PHASE: "POMO_PHASE",
  POMO_CYCLE: "POMO_CYCLE",
  POMO_END_MS: "POMO_END_MS",

  LAST_UPDATE_ID: "LAST_UPDATE_ID",
};

const SHEETS = {
  DAILY: "Daily",
  CHECKINS: "Checkins",
  POMODORO: "Pomodoro",
};

const DEFAULTS = {
  // Ventanas Chile
  CHECKIN_START_H: 6,
  CHECKIN_END_H: 22,
  CHECKINS_PER_DAY: 3,
  CHECKIN_MIN_GAP_MIN: 90,

  DIARY_REMINDER_H: 21,
  DIARY_REMINDER_M: 30,

  POMO_START_H: 9,
  POMO_END_H: 18,

  POMO_WORK_MIN: 25,
  POMO_SHORT_BREAK_MIN: 5,
  POMO_LONG_BREAK_MIN: 15,
  POMO_SET_SIZE: 4,
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
