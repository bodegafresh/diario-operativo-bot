/**
 * config.gs
 * Config + Script Properties
 */

const PROP = {
  BOT_TOKEN: "BOT_TOKEN",
  SPREADSHEET_ID: "SPREADSHEET_ID",

  WEBAPP_URL: "WEBAPP_URL",
  TG_WEBHOOK_SECRET: "TG_WEBHOOK_SECRET",

  LAST_UPDATE_ID: "LAST_UPDATE_ID",
};

const SHEETS = {
  QUESTIONS: "Questions",
  PROGRESS: "Progress",
  ATTEMPTS: "Attempts",
};

const DEFAULTS = {
  CALLBACK_PREFIX: "ans", // payload format: "ans:<lesson_id>:<letter>"
  RESET_CALLBACK_PREFIX: "rst", // payload format: "rst:<yes|no>"
  TELEGRAM_VIDEO_LIMIT_BYTES: 50 * 1024 * 1024, // 50 MB (límite bots)
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
