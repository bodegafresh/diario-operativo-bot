/**
 * telegram.gs
 * Webhook + router + envío Telegram
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return ContentService.createTextOutput("busy");

  try {
    const update = JSON.parse(
      e && e.postData && e.postData.contents ? e.postData.contents : "{}"
    );

    // Dedupe por update_id (Telegram reintenta)
    if (update && update.update_id != null) {
      const last = toInt_(cfgGet_(PROP.LAST_UPDATE_ID, ""));
      if (last != null && update.update_id <= last) {
        return ContentService.createTextOutput("ok");
      }
      cfgSet_(PROP.LAST_UPDATE_ID, String(update.update_id));
    }

    if (update.message) handleMessage_(update.message);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    // No spamear usuario en caso de error (solo logs)
    console.error(err);
    return ContentService.createTextOutput("error");
  } finally {
    lock.releaseLock();
  }
}

function handleMessage_(msg) {
  const chatId = msg && msg.chat && msg.chat.id ? String(msg.chat.id) : "";
  const text = msg && msg.text ? String(msg.text).trim() : "";
  if (!chatId || !text) return;

  // aprende chat_id
  if (!getChatId_() || getChatId_() !== chatId) setChatId_(chatId);

  // asegura triggers base al primer contacto
  ensureBaseAutomation_();

  if (text.startsWith("/")) {
    handleCommand_(chatId, msg.message_id, text);
    return;
  }

  // respuestas (reply) a prompts del bot
  const reply = msg.reply_to_message;
  const repliedToBot = !!(reply && reply.from && reply.from.is_bot);
  if (!repliedToBot) {
    // no spam: una sola ayuda corta
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

  // fallback
  tgSend_(
    chatId,
    "Te leo. Usa /diario o responde a un check-in 🙂",
    msg.message_id
  );
}

/** Telegram sendMessage */
function tgSend_(chatId, text, replyToMessageId) {
  const url = "https://api.telegram.org/bot" + getBotToken_() + "/sendMessage";
  const payload = { chat_id: chatId, text: text };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code >= 300) {
    console.error(res.getContentText());
    throw new Error("Telegram error " + code);
  }
}

function helpShort_() {
  return [
    "Comandos:",
    "/diario",
    "/pomodoro start | stop | status",
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
    "• /status → estado del sistema",
    "• /help → ayuda",
    "",
    "Automático:",
    "• Recordatorio diario para llenar /diario",
    "• 3 check-ins aleatorios diarios (06–22)",
  ].join("\n");
}

function status_() {
  const cid = getChatId_() || "(no aprendido aún)";
  const pomo = cfgGet_(PROP.POMO_ENABLED, "false") === "true";
  const ck = cfgGet_(PROP.CHECKINS_SETUP, "false") === "true";
  const dr = cfgGet_(PROP.DIARY_REMINDER_SETUP, "false") === "true";

  return [
    "Estado:",
    "chat_id: " + cid,
    "checkins: " + (ck ? "ON" : "OFF"),
    "diario reminder: " + (dr ? "ON" : "OFF"),
    "pomodoro: " + (pomo ? "ON" : "OFF"),
  ].join("\n");
}

function handleCommand_(chatId, messageId, text) {
  const parts = text.split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const arg = (parts[1] || "").toLowerCase();

  if (cmd === "/start" || cmd === "/help") {
    tgSend_(chatId, helpLong_(), messageId);
    return;
  }

  if (cmd === "/status") {
    tgSend_(chatId, status_(), messageId);
    return;
  }

  if (cmd === "/diario") {
    tgSend_(chatId, diaryPrompt_(), messageId);
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

/** Webhook helper */
function setWebhook() {
  const webAppUrl = cfgGet_("WEBAPP_URL", "");
  if (!webAppUrl)
    throw new Error(
      "Setea WEBAPP_URL en Script Properties (URL /exec del deploy)."
    );
  const url =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/setWebhook?url=" +
    encodeURIComponent(webAppUrl);
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}
