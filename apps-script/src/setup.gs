/**
 * setup.gs
 * Inicializa hojas y triggers.
 */

function setup() {
  ensureCoreSheets_();
  ensureBaseAutomation_();
  Logger.log(
    "✅ setup listo. Ahora: setea Script Properties (BOT_TOKEN, SPREADSHEET_ID, WEBAPP_URL) y ejecuta setWebhook()."
  );
}

function getWebhookInfo_() {
  const url =
    "https://api.telegram.org/bot" + getBotToken_() + "/getWebhookInfo";
  const res = UrlFetchApp.fetch(url);
  Logger.log(res.getContentText());
}

function resetWebhook_() {
  const del =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/deleteWebhook?drop_pending_updates=true";
  Logger.log(UrlFetchApp.fetch(del).getContentText());

  // vuelve a setear con WEBAPP_URL
  setWebhook();
}

/**
 * Se asegura de dejar:
 * - trigger diario 00:05 para programar check-ins
 * - trigger diario (hora noche) para reminder /diario
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

    // además agenda para hoy/mañana inmediatamente
    scheduleDailyCheckins_();

    cfgSet_(PROP.CHECKINS_SETUP, "true");
  }

  // Reminder diario
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

function run_getWebhookInfo() {
  getWebhookInfo_();
}

function run_resetWebhook() {
  resetWebhook_();
}

function webhookHealthcheck_() {
  const info = getWebhookInfoJson_(); // te dejo abajo
  const url = String(info.result?.url || "");
  const lastErr = String(info.result?.last_error_message || "");

  let expected = cfgGet_("WEBAPP_URL", "");
  if (expected && !/\/exec(\?.*)?$/.test(expected)) {
    expected = expected.replace(/\/$/, "") + "/exec";
  }

  const bad = !url || (expected && url !== expected) || lastErr.includes("302");

  if (bad) {
    resetWebhook_(); // delete + setWebhook()
  }
}

function getWebhookInfoJson_() {
  const url =
    "https://api.telegram.org/bot" + getBotToken_() + "/getWebhookInfo";
  const res = UrlFetchApp.fetch(url);
  return JSON.parse(res.getContentText());
}

function ensureWebhookHealthcheckTrigger_() {
  // borra triggers anteriores de esta función
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "webhookHealthcheck_")
      ScriptApp.deleteTrigger(t);
  });

  // corre cada 15 minutos
  ScriptApp.newTrigger("webhookHealthcheck_")
    .timeBased()
    .everyMinutes(15)
    .create();
}

function fixWebhookNow_() {
  // 1) Lee WEBAPP_URL
  let webAppUrl = cfgGet_("WEBAPP_URL", "");
  if (!webAppUrl) throw new Error("Falta WEBAPP_URL en Script Properties.");

  // 2) Fuerza /exec sí o sí
  webAppUrl = webAppUrl.trim();
  if (!/\/exec(\?.*)?$/.test(webAppUrl)) {
    webAppUrl = webAppUrl.replace(/\/$/, "") + "/exec";
  }

  // 3) deleteWebhook + drop pending
  const del =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/deleteWebhook?drop_pending_updates=true";
  Logger.log("deleteWebhook: " + UrlFetchApp.fetch(del).getContentText());

  // 4) setWebhook (POST, no GET)
  const setUrl =
    "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook";
  const setRes = UrlFetchApp.fetch(setUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ url: webAppUrl }),
    muteHttpExceptions: true,
  });
  Logger.log("setWebhook: " + setRes.getContentText());

  // 5) getWebhookInfo (verificación inmediata)
  const infoUrl =
    "https://api.telegram.org/bot" + getBotToken_() + "/getWebhookInfo";
  const infoText = UrlFetchApp.fetch(infoUrl).getContentText();
  Logger.log("getWebhookInfo: " + infoText);

  // 6) Validación simple en logs
  const info = JSON.parse(infoText);
  const u = String(info.result && info.result.url ? info.result.url : "");
  const err = String(
    info.result && info.result.last_error_message
      ? info.result.last_error_message
      : ""
  );
  Logger.log("FINAL url=" + u);
  Logger.log("FINAL last_error_message=" + err);
}

function run_fixWebhookNow() {
  fixWebhookNow_();
}

function debugWebAppHttp_() {
  let url = cfgGet_("WEBAPP_URL", "");
  if (!/\/exec(\?.*)?$/.test(url)) url = url.replace(/\/$/, "") + "/exec";

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    followRedirects: false,
    muteHttpExceptions: true,
  });

  Logger.log("status=" + res.getResponseCode());
  Logger.log("headers=" + JSON.stringify(res.getAllHeaders(), null, 2));
  Logger.log("body=" + res.getContentText());
}

function run_debugWebAppHttp() {
  debugWebAppHttp_();
}

function debugEffectiveWebhook_() {
  const hookUrl = PropertiesService.getScriptProperties().getProperty(
    "WEBHOOK_URL_EFFECTIVE"
  );
  if (!hookUrl)
    throw new Error(
      "No existe WEBHOOK_URL_EFFECTIVE. Ejecuta setWebhookSmart_() primero."
    );

  const res = UrlFetchApp.fetch(hookUrl, {
    method: "get",
    followRedirects: false,
    muteHttpExceptions: true,
  });

  Logger.log("hookUrl=" + hookUrl);
  Logger.log("status=" + res.getResponseCode());
  Logger.log("headers=" + JSON.stringify(res.getAllHeaders(), null, 2));
  Logger.log("body=" + res.getContentText());
}

function run_debugEffectiveWebhook() {
  debugEffectiveWebhook_();
}

function debugWebhookPost_() {
  const url = normalizeExecUrl_(cfgGet_("WEBAPP_URL", "")); // /macros/s/.../exec
  const payload = JSON.stringify({
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: 1 },
      text: "/status",
      from: { is_bot: false },
    },
  });

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload,
    followRedirects: false,
    muteHttpExceptions: true,
  });

  Logger.log("POST status=" + res.getResponseCode());
  Logger.log("POST headers=" + JSON.stringify(res.getAllHeaders(), null, 2));
  Logger.log("POST body=" + res.getContentText());
}

function debugWebhookPost() {
  debugWebhookPost_();
}
