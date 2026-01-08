/**
 * checkins.gs
 * 3 check-ins aleatorios diarios 06:00–22:00 (Chile).
 */

const CHECKIN_PROMPTS = [
  "Pausa 20s. ¿Qué pensamiento estás repitiendo ahora mismo?",
  "¿Qué emoción estás practicando sin darte cuenta? Nómbrala en 1 palabra.",
  "¿Esto que piensas es un hecho… o una historia repetida?",
  "¿Qué parte de ti está al volante: automático o consciente?",
  "¿Qué estás anticipando que aún no ocurre?",
  "Si cambiaras de estado ahora, ¿cuál eliges (calma/confianza/gratitud)?",
  "¿Qué hábito mental estás reforzando en este momento?",
  "¿Qué elegiría tu versión más consciente en los próximos 2 minutos?",
  "¿Qué sensación hay en el cuerpo justo ahora (pecho/estómago/garganta)?",
  "¿Qué puedes soltar hoy por 1 hora?",
];

function checkinMessage_(question) {
  return [
    "🧠 [CHECK-IN]",
    question,
    "",
    "Responde a ESTE mensaje con:",
    "intensidad 0–10 + tu respuesta",
    "Ej: 7 me estoy anticipando y tensando el cuerpo",
  ].join("\n");
}

function parseCheckinAnswer_(text) {
  const t = String(text).trim();
  const re = /^(\d{1,2})(?:\s*\/\s*10)?\s*[:\-|.\s]\s*(.*)$/;
  const m = t.match(re);
  if (!m) return { intensity: null, clean: t };

  const n = parseInt(m[1], 10);
  if (!isFinite(n) || n < 0 || n > 10) return { intensity: null, clean: t };

  return { intensity: n, clean: (m[2] || "").trim() };
}

function extractCheckinQuestion_(promptText) {
  const lines = String(promptText || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const L = String(lines[i]).trim();
    if (!L) continue;
    if (L.indexOf("[CHECK-IN]") !== -1) continue;
    if (L.toLowerCase().indexOf("responde") === 0) continue;
    if (L.toLowerCase().indexOf("intensidad") === 0) continue;
    if (L.toLowerCase().indexOf("ej:") === 0) continue;
    return L;
  }
  return "";
}

/**
 * Trigger diario (00:05) para planificar los 3 check-ins del día.
 */
function scheduleDailyCheckins_() {
  const chatId = getChatId_();
  if (!chatId) return;

  deleteTriggersByHandler_("sendCheckin_");

  const now = new Date();
  const targetDay = new Date(now);

  const endToday = new Date(now);
  endToday.setHours(DEFAULTS.CHECKIN_END_H, 0, 0, 0);
  if (now > endToday) targetDay.setDate(targetDay.getDate() + 1);

  const start = new Date(targetDay);
  start.setHours(DEFAULTS.CHECKIN_START_H, 0, 0, 0);

  const end = new Date(targetDay);
  end.setHours(DEFAULTS.CHECKIN_END_H, 0, 0, 0);

  const times = randomTimesSpaced_(
    start,
    end,
    DEFAULTS.CHECKINS_PER_DAY,
    DEFAULTS.CHECKIN_MIN_GAP_MIN
  );

  times.forEach((t) =>
    ScriptApp.newTrigger("sendCheckin_").timeBased().at(t).create()
  );
}

function sendCheckin_() {
  const chatId = getChatId_();
  if (!chatId) return;

  const q = pickRandom_(CHECKIN_PROMPTS);
  tgSend_(chatId, checkinMessage_(q));
}
