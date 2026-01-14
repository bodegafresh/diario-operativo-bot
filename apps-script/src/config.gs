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

  POMO_ENABLED: "POMO_ENABLED",
  POMO_PHASE: "POMO_PHASE",
  POMO_CYCLE: "POMO_CYCLE",
  POMO_END_MS: "POMO_END_MS",

  LAST_UPDATE_ID: "LAST_UPDATE_ID",
  CHECKIN_QUESTION_HISTORY: "CHECKIN_QUESTION_HISTORY",
};

const SHEETS = {
  DAILY: "Daily",
  CHECKINS: "Checkins",
  POMODORO: "Pomodoro",
  COACH: "Coach", // hoja del coach (v2 legacy, ya no se usa)
  COACH_V3: "Coach", // hoja del coach v3 con headers expandidos (mismo nombre, nuevos headers)
};

const DEFAULTS = {
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
