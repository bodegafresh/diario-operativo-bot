/**
 * telegram.gs (versión mejorada)
 * - Seguridad: uso personal (solo 1 chat permitido) + solo chat privado
 * - (Opcional) valida secret token del webhook si lo configuras
 * - No expone chat_id en /status
 *
 * Reusa tu property CHAT_ID como ALLOWED_CHAT_ID (single-user).
 *  - Si CHAT_ID está vacío: lo “aprende” en el primer mensaje privado
 *  - Si alguien más escribe: se ignora silenciosamente
 */

// Opcional: si usas secret_token en setWebhook (recomendado), setea esta property
// TG_WEBHOOK_SECRET = "cadena_larga_random"
// y pásala en setWebhookToWorker_ (más abajo) con secret_token.
const TG_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

function doPost(e) {
  try {
    // (Opcional PRO) Validación webhook secret token
    const expectedSecret = cfgGet_("TG_WEBHOOK_SECRET", "");
    if (expectedSecret) {
      const got =
        (e &&
          e.headers &&
          (e.headers[TG_SECRET_HEADER] ||
            e.headers[TG_SECRET_HEADER.toLowerCase()])) ||
        "";
      if (String(got) !== String(expectedSecret)) {
        // Respuesta 200 igual para no dar señales
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

/**
 * Seguridad:
 * - Solo chats privados (evita grupos)
 * - Solo 1 chat permitido (property CHAT_ID)
 *   - si no existe, se fija al primer chat privado que escriba
 *   - el resto se ignora sin responder
 */
function handleMessage_(msg) {
  const chatId = msg && msg.chat && msg.chat.id ? String(msg.chat.id) : "";
  const text = msg && msg.text ? String(msg.text).trim() : "";
  if (!chatId || !text) return;

  // 1) Solo privado (bloquea grupos/canales)
  if (!isPrivateChat_(msg)) return;

  // 2) Single-user: usa CHAT_ID como allowlist
  if (!authorizeOrLearnChat_(chatId)) return;

  // 3) asegura triggers base al primer contacto autorizado
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

  tgSend_(
    chatId,
    "Te leo. Usa /diario o responde a un check-in 🙂",
    msg.message_id
  );
}

/** --- Seguridad helpers --- */
function isPrivateChat_(msg) {
  // Telegram: "private" | "group" | "supergroup" | "channel"
  const t = msg && msg.chat && msg.chat.type ? String(msg.chat.type) : "";
  return t === "private";
}

function authorizeOrLearnChat_(chatId) {
  // Reutiliza tu property CHAT_ID como ALLOWED_CHAT_ID
  // (No cambiamos helpers existentes: getChatId_/setChatId_).
  const allowed = getChatId_();

  // Si no hay allowed todavía, lo fija al primer chat privado que hable.
  if (!allowed) {
    setChatId_(chatId);
    return true;
  }

  // Si existe, solo ese chat puede usar el bot.
  if (String(allowed) !== String(chatId)) {
    // Silencioso: no responder, no loggear
    return false;
  }
  return true;
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

function tgSendSafe_(chatId, text, replyToMessageId) {
  const s = String(text || "");
  const MAX = 3500; // margen bajo 4096

  if (s.length <= MAX) {
    return tgSend_(chatId, s, replyToMessageId);
  }

  const lines = s.split("\n");
  let buf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((buf + "\n" + line).length > MAX) {
      tgSend_(chatId, buf, replyToMessageId);
      replyToMessageId = null; // solo el primer chunk como reply
      buf = line;
    } else {
      buf = buf ? buf + "\n" + line : line;
    }
  }
  if (buf) tgSend_(chatId, buf, replyToMessageId);
}

/** --- Prompts / help --- */
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
  // Seguridad: NO mostramos chat_id
  const allowedSet = !!getChatId_();
  const pomo = cfgGet_(PROP.POMO_ENABLED, "false") === "true";
  const ck = cfgGet_(PROP.CHECKINS_SETUP, "false") === "true";
  const dr = cfgGet_(PROP.DIARY_REMINDER_SETUP, "false") === "true";

  return [
    "Estado:",
    "auth: " +
      (allowedSet
        ? "single-user (CHAT_ID fijado)"
        : "pendiente (escríbele al bot 1 vez)"),
    "chat: private-only",
    "checkins: " + (ck ? "ON" : "OFF"),
    "diario reminder: " + (dr ? "ON" : "OFF"),
    "pomodoro: " + (pomo ? "ON" : "OFF"),
  ].join("\n");
}

/** --- Router de comandos --- */
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

/** --- Update dedupe --- */
function shouldProcessUpdate_(updateId) {
  const props = PropertiesService.getScriptProperties();
  const lastRaw = props.getProperty(PROP.LAST_UPDATE_ID);
  const last = lastRaw ? Number(lastRaw) : 0;
  const cur = Number(updateId);

  if (!isFinite(cur) || cur <= 0) return true;

  // Si alguien guardó Date.now() u otro gigante, resetea
  if (last > 5000000000) {
    props.setProperty(PROP.LAST_UPDATE_ID, String(cur));
    return true;
  }

  if (last && cur <= last) return false;

  props.setProperty(PROP.LAST_UPDATE_ID, String(cur));
  return true;
}

/** --- Webhook helpers --- */
function setWebhook() {
  let webAppUrl = cfgGet_("WEBAPP_URL", "");
  if (!webAppUrl) throw new Error("Falta WEBAPP_URL en Script Properties.");

  if (!/\/exec(\?.*)?$/.test(webAppUrl)) {
    webAppUrl = webAppUrl.replace(/\/$/, "") + "/exec";
  }

  const url =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/setWebhook?url=" +
    encodeURIComponent(webAppUrl);

  Logger.log(UrlFetchApp.fetch(url).getContentText());
  setWebhookSmart_();
}

function setWebhookSmart_() {
  const execUrl = normalizeExecUrl_(cfgGet_("WEBAPP_URL", ""));
  if (!execUrl) throw new Error("Falta WEBAPP_URL en Script Properties.");

  const res = UrlFetchApp.fetch(execUrl, {
    method: "get",
    followRedirects: false,
    muteHttpExceptions: true,
  });

  let hookUrl = execUrl;

  if (res.getResponseCode() === 302) {
    const loc = res.getHeaders()["Location"] || res.getAllHeaders()?.Location;
    if (!loc)
      throw new Error("302 sin Location. No puedo derivar webhook final.");
    hookUrl = String(loc);
  }

  const setUrl =
    "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook";
  const setRes = UrlFetchApp.fetch(setUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ url: hookUrl, drop_pending_updates: true }),
    muteHttpExceptions: true,
  });

  PropertiesService.getScriptProperties().setProperty(
    "WEBHOOK_URL_EFFECTIVE",
    hookUrl
  );

  Logger.log("execUrl=" + execUrl);
  Logger.log("hookUrl=" + hookUrl);
  Logger.log("setWebhook=" + setRes.getContentText());
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

/**
 * ✅ Recomendado: Setea el webhook al Cloudflare Worker.
 * (Opcional PRO) si setéas TG_WEBHOOK_SECRET, lo enviamos como secret_token.
 */
function setWebhookToWorker_() {
  const workerUrl =
    PropertiesService.getScriptProperties().getProperty("WORKER_URL");
  if (!workerUrl) throw new Error("Falta WORKER_URL en Script Properties");

  const payload = {
    url: workerUrl,
    drop_pending_updates: true,
  };

  const secret = cfgGet_("TG_WEBHOOK_SECRET", "");
  if (secret) payload.secret_token = secret; // Telegram enviará header en cada update

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
