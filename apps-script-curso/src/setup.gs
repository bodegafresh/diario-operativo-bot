/**
 * setup.gs
 * Inicializa hojas y siembra preguntas de ejemplo.
 */

function setup() {
  ensureCoreSheets_();
  seedExampleQuestions_();

  Logger.log("✅ setup listo.");
  Logger.log(
    "1) Setea Script Properties: BOT_TOKEN, SPREADSHEET_ID, WEBAPP_URL (opcional TG_WEBHOOK_SECRET)."
  );
  Logger.log("2) Deploy → Web app → copia la URL /exec a WEBAPP_URL.");
  Logger.log("3) Ejecuta setWebhook() para registrar el webhook en Telegram.");
  Logger.log(
    "4) Sube los videos a Drive y pega los video_file_id en la columna correspondiente del Sheet Questions."
  );
}

/**
 * Siembra 5 preguntas básicas sobre colores si la hoja Questions está vacía.
 * Solo agrega filas si la hoja solo tiene el header (lastRow <= 1).
 */
function seedExampleQuestions_() {
  const sh = getOrCreateSheet_(SHEETS.QUESTIONS);
  if (sh.getLastRow() > 1) {
    Logger.log("Questions ya tiene datos; no se siembra ejemplo.");
    return;
  }

  const samples = [
    [
      1,
      "Colores básicos",
      "¿Qué color resulta de mezclar amarillo y azul?",
      "Verde",
      "Naranja",
      "Morado",
      "Café",
      "A",
      "",
      "Amarillo + azul = verde. Es una mezcla sustractiva clásica.",
      true,
    ],
    [
      2,
      "Colores básicos",
      "¿Cuál de estos es un color primario?",
      "Verde",
      "Rojo",
      "Naranja",
      "Rosa",
      "B",
      "",
      "Los primarios tradicionales son rojo, amarillo y azul.",
      true,
    ],
    [
      3,
      "Colores básicos",
      "¿Qué color se obtiene al mezclar rojo y azul?",
      "Verde",
      "Naranja",
      "Morado",
      "Gris",
      "C",
      "",
      "Rojo + azul = morado (violeta).",
      true,
    ],
    [
      4,
      "Temperatura",
      "¿Cuál es un color cálido?",
      "Azul",
      "Verde",
      "Violeta",
      "Rojo",
      "D",
      "",
      "Los cálidos son rojos, naranjas y amarillos.",
      true,
    ],
    [
      5,
      "Complementarios",
      "¿Cuál es el color complementario del rojo?",
      "Verde",
      "Azul",
      "Amarillo",
      "Negro",
      "A",
      "",
      "El complementario del rojo es el verde (opuesto en el círculo cromático).",
      true,
    ],
  ];

  samples.forEach((row) => sh.appendRow(row));
  Logger.log("✅ Sembradas " + samples.length + " preguntas de ejemplo.");
}

/** Webhook helpers */
function setWebhook() {
  let webAppUrl = cfgGet_(PROP.WEBAPP_URL, "");
  if (!webAppUrl) throw new Error("Falta WEBAPP_URL en Script Properties.");
  webAppUrl = normalizeExecUrl_(webAppUrl);

  const url = "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook";
  const payload = { url: webAppUrl, drop_pending_updates: true };

  const secret = cfgGet_(PROP.TG_WEBHOOK_SECRET, "");
  if (secret) payload.secret_token = secret;

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
