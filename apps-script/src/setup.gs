/**
 * setup.gs
 * Inicializa hojas y triggers.
 */

function setup() {
  ensureCoreSheets_();
  ensureBaseAutomation_();

  // Coach triggers (plan fijo + scheduler aleatorio + check fijo)
  if (typeof ensureCoachTriggers_ === "function") {
    ensureCoachTriggers_();
  }

  Logger.log("✅ setup listo.");
  Logger.log(
    "1) Setea Script Properties: BOT_TOKEN, SPREADSHEET_ID, WEBAPP_URL, WORKER_URL (opcional TG_WEBHOOK_SECRET)."
  );
  Logger.log(
    "2) Ejecuta run_setWebhookToWorker() si usas Worker, o setWebhook() si vas directo a GAS."
  );
  Logger.log(
    "3) Escríbele al bot 1 vez en chat privado para que aprenda CHAT_ID."
  );
}

/**
 * Triggers base:
 * - scheduleDailyCheckins_ (00:05)
 * - sendDiaryReminder_ (21:30)
 */
function ensureBaseAutomation_() {
  // Checkins scheduler diario
  if (cfgGet_(PROP.CHECKINS_SETUP, "false") !== "true") {
    deleteTriggersByHandler_("scheduleDailyCheckins_");
    ScriptApp.newTrigger("scheduleDailyCheckins_")
      .timeBased()
      .everyDays(1)
      .atHour(0)
      .nearMinute(5)
      .create();

    scheduleDailyCheckins_();
    cfgSet_(PROP.CHECKINS_SETUP, "true");
  }

  // Reminder diario /diario
  if (cfgGet_(PROP.DIARY_REMINDER_SETUP, "false") !== "true") {
    deleteTriggersByHandler_("sendDiaryReminder_");
    ScriptApp.newTrigger("sendDiaryReminder_")
      .timeBased()
      .everyDays(1)
      .atHour(DEFAULTS.DIARY_REMINDER_H)
      .nearMinute(DEFAULTS.DIARY_REMINDER_M)
      .create();
    cfgSet_(PROP.DIARY_REMINDER_SETUP, "true");
  }
}

function sendDiaryReminder_() {
  const chatId = getChatId_();
  if (!chatId) return;

  tgSend_(
    chatId,
    [
      "📝 Recordatorio diario:",
      "Registra tu día con /diario",
      "",
      "Tip: responde al template para que quede ordenado.",
    ].join("\n")
  );
}

/** Webhook helpers */
function setWebhook() {
  let webAppUrl = cfgGet_(PROP.WEBAPP_URL, "");
  if (!webAppUrl) throw new Error("Falta WEBAPP_URL en Script Properties.");
  webAppUrl = normalizeExecUrl_(webAppUrl);

  const url = "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook";
  const payload = { url: webAppUrl, drop_pending_updates: true };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log(res.getContentText());
}

function normalizeExecUrl_(url) {
  url = String(url || "").trim();
  if (!url) return "";
  if (!/\/exec(\?.*)?$/.test(url)) url = url.replace(/\/$/, "") + "/exec";
  if (url.includes("/macros/library/")) {
    throw new Error(
      "WEBAPP_URL apunta a /macros/library/. Debe ser /macros/s/.../exec"
    );
  }
  return url;
}

function run_getWebhookInfo() {
  const url =
    "https://api.telegram.org/bot" + getBotToken_() + "/getWebhookInfo";
  const res = UrlFetchApp.fetch(url);
  Logger.log(res.getContentText());
}

function run_resetWebhook() {
  const del =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/deleteWebhook?drop_pending_updates=true";
  Logger.log(UrlFetchApp.fetch(del).getContentText());
}

/**
 * Setea el webhook al Cloudflare Worker.
 * Si existe TG_WEBHOOK_SECRET en Script Properties, lo manda como secret_token.
 */
function setWebhookToWorker_() {
  const workerUrl = cfgGet_(PROP.WORKER_URL, "");
  if (!workerUrl) throw new Error("Falta WORKER_URL en Script Properties");

  const payload = {
    url: workerUrl.replace(/\/+$/, ""),
    drop_pending_updates: true,
  };

  const secret = cfgGet_(PROP.TG_WEBHOOK_SECRET, "");
  if (secret) payload.secret_token = secret;

  const url = "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook";
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log(res.getContentText());
}

function run_setWebhookToWorker() {
  setWebhookToWorker_();
}
