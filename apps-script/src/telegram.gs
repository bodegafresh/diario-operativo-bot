/**
 * telegram.gs
 * - Webhook router
 * - Seguridad: chat privado + single-user (CHAT_ID)
 * - Reply handlers: DIARIO, CHECK-IN, COACH-CHECK
 * - Comandos: /help /status /diario /pomodoro + coach v2 (/coach, /nivel, /entreno, /plan)
 */

const TG_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

function doPost(e) {
  try {
    const expectedSecret = cfgGet_(PROP.TG_WEBHOOK_SECRET, "");
    if (expectedSecret) {
      const got =
        (e &&
          e.headers &&
          (e.headers[TG_SECRET_HEADER] ||
            e.headers[String(TG_SECRET_HEADER).toLowerCase()])) ||
        "";
      if (got && String(got) !== String(expectedSecret)) {
        return ContentService.createTextOutput("ok").setMimeType(
          ContentService.MimeType.TEXT
        );
      }
    }

    const update = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (update.update_id != null && !shouldProcessUpdate_(update.update_id)) {
      return ContentService.createTextOutput("ok");
    }

    if (update.message) handleMessage_(update.message);
  } catch (err) {
    console.error(err);
  }

  return ContentService.createTextOutput("ok").setMimeType(
    ContentService.MimeType.TEXT
  );
}

function doGet(e) {
  return ContentService.createTextOutput("ok").setMimeType(
    ContentService.MimeType.TEXT
  );
}

function handleMessage_(msg) {
  const chatId = msg && msg.chat && msg.chat.id ? String(msg.chat.id) : "";
  const text = msg && msg.text ? String(msg.text).trim() : "";
  if (!chatId || !text) return;

  if (!isPrivateChat_(msg)) return;
  if (!authorizeOrLearnChat_(chatId)) return;

  // asegura triggers base al primer contacto autorizado
  ensureBaseAutomation_();

  if (text.startsWith("/")) {
    handleCommand_(chatId, msg.message_id, text);
    return;
  }

  const reply = msg.reply_to_message;
  const repliedToBot = !!(reply && reply.from && reply.from.is_bot);
  if (!repliedToBot) {
    tgSend_(chatId, helpShort_(), msg.message_id);
    return;
  }

  const prompt = reply && reply.text ? String(reply.text) : "";

  if (prompt.indexOf("[DIARIO]") !== -1) {
    const norm = parseDiaryText_(text);
    appendDaily_(msg, norm, text);
    tgSend_(
      chatId,
      "✅ Diario guardado en Google Sheets (Daily).",
      msg.message_id
    );
    return;
  }

  if (prompt.indexOf("[CHECK-IN]") !== -1) {
    const parsed = parseCheckinAnswer_(text);
    appendCheckin_(msg, {
      question: extractCheckinQuestion_(prompt),
      intensity: parsed.intensity,
      answer_raw: text,
    });
    tgSend_(chatId, "✅ Check-in guardado.", msg.message_id);
    return;
  }

  if (prompt.indexOf("[COACH-CHECK]") !== -1) {
    const parsed = parseCoachCheckAnswer_(text);
    if (!parsed) {
      tgSend_(
        chatId,
        "Formato inválido. Responde: si si si si si si no (entreno lectura voz ingles story ritual alcohol)",
        msg.message_id
      );
      return;
    }

    const result = coachApplyNightResult_(parsed);

    if (result.action === "reset") {
      const why =
        result.reason === "alcohol" ? "por alcohol" : "por cumplimiento";
      tgSend_(
        chatId,
        `🔁 Reinicio del ciclo 21 días (${why}).\nSin castigo. Sin culpa.\nMañana vuelves a Día 1 con foco liviano.`,
        msg.message_id
      );
      return;
    }

    const badge = result.tier === "valid" ? "✅" : "⚠️";
    tgSend_(
      chatId,
      `${badge} Cierre registrado. Score=${result.score}/6.\nMañana: día ${result.next21}/21 | Entreno día ${result.next14}/14`,
      msg.message_id
    );
    return;
  }

  tgSend_(chatId, "Te leo. Usa /diario, /plan o /coach 🙂", msg.message_id);
}

/** --- Seguridad helpers --- */
function isPrivateChat_(msg) {
  const t = msg && msg.chat && msg.chat.type ? String(msg.chat.type) : "";
  return t === "private";
}

function authorizeOrLearnChat_(chatId) {
  const allowed = getChatId_();
  if (!allowed) {
    setChatId_(chatId);
    return true;
  }
  return String(allowed) === String(chatId);
}

/** Telegram sendMessage */
function tgSend_(chatId, text, replyToMessageId) {
  const url = "https://api.telegram.org/bot" + getBotToken_() + "/sendMessage";
  const payload = { chat_id: chatId, text: String(text || "") };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code >= 300) {
    console.error(body);
    throw new Error("Telegram error " + code);
  }

  try {
    const j = JSON.parse(body);
    return j && j.result && j.result.message_id ? j.result.message_id : null;
  } catch (_) {
    return null;
  }
}

function tgSendSafe_(chatId, text, replyToMessageId) {
  const s = String(text || "");
  const MAX = 3500;

  if (s.length <= MAX) return tgSend_(chatId, s, replyToMessageId);

  const lines = s.split("\n");
  let buf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((buf + "\n" + line).length > MAX) {
      tgSend_(chatId, buf, replyToMessageId);
      replyToMessageId = null;
      buf = line;
    } else {
      buf = buf ? buf + "\n" + line : line;
    }
  }
  if (buf) tgSend_(chatId, buf, replyToMessageId);
}

/** Help / status */
function helpShort_() {
  return [
    "Comandos:",
    "/diario",
    "/pomodoro start | stop | status",
    "/coach on | off | status | reset21",
    "/nivel suave | estandar | desafiante",
    "/plan",
    "/entreno",
    "/status",
    "/help",
  ].join("\n");
}

function helpLong_() {
  return [
    "Comandos:",
    "",
    "• /diario → registrar día (responde al template)",
    "• /pomodoro start|stop|status → 25/5 x4 + 15 (Lun–Vie 09–18 Chile)",
    "• /coach on|off|status|reset21 → coach v2 (21 días + sprint + recordatorios)",
    "• /nivel suave|estandar|desafiante → dificultad del coach",
    "• /plan → envía el plan del día ahora",
    "• /entreno → envía rutina A/B de hoy",
    "• /status → estado del sistema",
    "• /help → ayuda",
    "",
    "Automático:",
    "• Recordatorio diario para /diario",
    "• 3 check-ins diarios (06–22)",
    "• Coach: plan 08:30 + recordatorios 10:30/14:00/17:30/20:30 + check 22:30",
  ].join("\n");
}

function status_() {
  const pomo = cfgGet_(PROP.POMO_ENABLED, "false") === "true";
  const ck = cfgGet_(PROP.CHECKINS_SETUP, "false") === "true";
  const dr = cfgGet_(PROP.DIARY_REMINDER_SETUP, "false") === "true";
  const coachTriggers = cfgGet_(PROP.COACH_SETUP, "false") === "true";
  const auth = !!getChatId_();

  const coachMode =
    typeof coachEnabled_ === "function" ? coachEnabled_() : false;

  return [
    "Estado:",
    "auth: " + (auth ? "single-user (CHAT_ID fijado)" : "pendiente"),
    "chat: private-only",
    "checkins: " + (ck ? "ON" : "OFF"),
    "diario reminder: " + (dr ? "ON" : "OFF"),
    "pomodoro: " + (pomo ? "ON" : "OFF"),
    "coach triggers: " + (coachTriggers ? "OK" : "OFF"),
    "coach mode: " + (coachMode ? "ON" : "OFF"),
  ].join("\n");
}

/** Router de comandos */
function handleCommand_(chatId, messageId, text) {
  const parts = text.split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const arg = (parts[1] || "").toLowerCase();

  // Coach v2 router
  if (typeof coachHandleCommand_ === "function") {
    try {
      const handled = coachHandleCommand_(chatId, messageId, cmd, arg);
      if (handled) return;
    } catch (err) {
      console.error(err);
      tgSend_(
        chatId,
        "⚠️ Error en coach: " +
          (err && err.message ? err.message : String(err)),
        messageId
      );
      return;
    }
  }

  if (cmd === "/start" || cmd === "/help") {
    tgSend_(chatId, helpLong_(), messageId);
    return;
  }

  if (cmd === "/status") {
    tgSend_(chatId, status_(), messageId);
    return;
  }

  if (cmd === "/diario") {
    tgSendSafe_(chatId, diaryPrompt_(), messageId);
    return;
  }

  if (cmd === "/pomodoro") {
    if (arg === "start" || arg === "on") {
      pomodoroStart_();
      tgSend_(
        chatId,
        "🍅 Pomodoro ON. Te avisaré cada cambio de fase (solo Lun–Vie 09–18).",
        messageId
      );
      return;
    }
    if (arg === "stop" || arg === "off") {
      pomodoroStop_();
      tgSend_(chatId, "🛑 Pomodoro OFF.", messageId);
      return;
    }
    if (arg === "status") {
      tgSend_(chatId, pomodoroStatus_(), messageId);
      return;
    }
    tgSend_(chatId, "Uso: /pomodoro start | stop | status", messageId);
    return;
  }

  tgSend_(chatId, "Comando no reconocido. Usa /help.", messageId);
}

/** Update dedupe */
function shouldProcessUpdate_(updateId) {
  const props = PropertiesService.getScriptProperties();
  const lastRaw = props.getProperty(PROP.LAST_UPDATE_ID);
  const last = lastRaw ? Number(lastRaw) : 0;
  const cur = Number(updateId);

  if (!isFinite(cur) || cur <= 0) return true;

  if (last > 5000000000) {
    props.setProperty(PROP.LAST_UPDATE_ID, String(cur));
    return true;
  }

  if (last && cur <= last) return false;

  props.setProperty(PROP.LAST_UPDATE_ID, String(cur));
  return true;
}
