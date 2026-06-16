/**
 * telegram.gs
 * Webhook router del bot del curso.
 * Maneja:
 *  - update.message (comandos: /start, /pregunta, /progreso, /reset, /help)
 *  - update.callback_query (clicks en alternativas A/B/C/D y confirmación de reset)
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

    if (update.callback_query) {
      handleCallbackQuery_(update.callback_query);
    } else if (update.message) {
      handleMessage_(update.message);
    }
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

function handleMessage_(msg) {
  const chatId = msg && msg.chat && msg.chat.id ? String(msg.chat.id) : "";
  const text = msg && msg.text ? String(msg.text).trim() : "";
  if (!chatId) return;

  if (!isPrivateChat_(msg)) return;

  if (text && text.startsWith("/")) {
    handleCommand_(chatId, msg);
    return;
  }

  // No es comando: muestra ayuda corta
  tgSend_(chatId, helpShort_(), msg.message_id);
}

function isPrivateChat_(msg) {
  const t = msg && msg.chat && msg.chat.type ? String(msg.chat.type) : "";
  return t === "private";
}

function handleCommand_(chatId, msg) {
  const text = String(msg.text || "").trim();
  const parts = text.split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const username = fullNameFromMsg_(msg);

  if (cmd === "/start") {
    courseStart_(chatId, username, msg.message_id);
    return;
  }

  if (cmd === "/help") {
    tgSend_(chatId, helpLong_(), msg.message_id);
    return;
  }

  if (cmd === "/pregunta") {
    courseSendCurrent_(chatId, username, msg.message_id);
    return;
  }

  if (cmd === "/progreso") {
    tgSend_(chatId, progressSummaryText_(chatId), msg.message_id);
    return;
  }

  if (cmd === "/reset") {
    sendResetConfirm_(chatId, msg.message_id);
    return;
  }

  tgSend_(chatId, "Comando no reconocido. Usa /help.", msg.message_id);
}

function handleCallbackQuery_(cb) {
  const chatId = cb && cb.message && cb.message.chat && cb.message.chat.id
    ? String(cb.message.chat.id)
    : "";
  const messageId = cb && cb.message && cb.message.message_id;
  const cbId = cb && cb.id;
  const data = String((cb && cb.data) || "");
  const username = (cb && cb.from)
    ? fullNameFromMsg_({ from: cb.from })
    : "";

  if (!chatId || !data) {
    if (cbId) tgAnswerCallbackQuery_(cbId, "");
    return;
  }

  const parts = data.split(":");
  const kind = parts[0];

  if (kind === DEFAULTS.CALLBACK_PREFIX) {
    const lessonId = toInt_(parts[1]);
    const letter = String(parts[2] || "").toUpperCase();
    if (lessonId == null || !letter) {
      tgAnswerCallbackQuery_(cbId, "");
      return;
    }
    processAnswer_(chatId, username, lessonId, letter, cbId, messageId);
    return;
  }

  if (kind === DEFAULTS.RESET_CALLBACK_PREFIX) {
    const choice = String(parts[1] || "").toLowerCase();
    if (choice === "yes") {
      resetProgress_(chatId);
      tgAnswerCallbackQuery_(cbId, "Progreso reiniciado");
      tgEditMessageText_(chatId, messageId, "🔄 Progreso reiniciado. Empezamos de nuevo.");
      courseSendCurrent_(chatId, username, null);
    } else {
      tgAnswerCallbackQuery_(cbId, "Cancelado");
      tgEditMessageText_(chatId, messageId, "Cancelado. Tu progreso se mantiene.");
    }
    return;
  }

  tgAnswerCallbackQuery_(cbId, "");
}

/* =========================
 *  Telegram API helpers
 * ========================= */

function tgSend_(chatId, text, replyToMessageId, replyMarkup) {
  const url = "https://api.telegram.org/bot" + getBotToken_() + "/sendMessage";
  const payload = { chat_id: chatId, text: String(text || "") };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
  if (replyMarkup) payload.reply_markup = replyMarkup;

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
    return null;
  }
  try {
    const j = JSON.parse(body);
    return j && j.result && j.result.message_id ? j.result.message_id : null;
  } catch (_) {
    return null;
  }
}

function tgAnswerCallbackQuery_(callbackQueryId, text) {
  if (!callbackQueryId) return;
  const url =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/answerCallbackQuery";
  const payload = { callback_query_id: callbackQueryId };
  if (text) payload.text = String(text);

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function tgEditMessageText_(chatId, messageId, text, replyMarkup) {
  if (!chatId || !messageId) return;
  const url =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/editMessageText";
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: String(text || ""),
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

/* =========================
 *  Help / textos UI
 * ========================= */

function helpShort_() {
  return [
    "🎓 Curso Bot",
    "",
    "Comandos:",
    "/start → empezar / continuar",
    "/pregunta → reenviar la pregunta actual",
    "/progreso → ver dónde vas",
    "/reset → reiniciar progreso",
    "/help → ayuda",
  ].join("\n");
}

function helpLong_() {
  return [
    "🎓 Bot del curso (preguntas + videos)",
    "",
    "Cada pregunta tiene alternativas A/B/C/D como botones.",
    "Si aciertas, te envío un video corto con la explicación y avanzo a la siguiente lección.",
    "Si fallas, vuelves a intentar la misma pregunta.",
    "",
    "Comandos:",
    "• /start → comenzar (o seguir donde quedaste)",
    "• /pregunta → reenviar la pregunta actual",
    "• /progreso → tu lección actual + estadísticas",
    "• /reset → reiniciar progreso a la lección 1",
    "• /help → esta ayuda",
  ].join("\n");
}

function sendResetConfirm_(chatId, replyToMessageId) {
  const markup = {
    inline_keyboard: [
      [
        { text: "Sí, reiniciar", callback_data: DEFAULTS.RESET_CALLBACK_PREFIX + ":yes" },
        { text: "No", callback_data: DEFAULTS.RESET_CALLBACK_PREFIX + ":no" },
      ],
    ],
  };
  tgSend_(
    chatId,
    "¿Seguro que quieres reiniciar tu progreso a la lección 1?",
    replyToMessageId,
    markup
  );
}
