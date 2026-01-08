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
