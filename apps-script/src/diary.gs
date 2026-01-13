/**
 * diary.gs
 * /diario prompt + parser flexible
 */

// Estados de ánimo normalizados (en español para consistencia en análisis)
const MOOD_OPTIONS = [
  "calma", // Estado de paz y tranquilidad
  "enfocado", // Concentrado y productivo
  "energético", // Con energía positiva
  "confianza", // Seguro de sí mismo
  "motivado", // Con ganas de avanzar
  "neutral", // Estado base, sin altibajos
  "estable", // Equilibrado emocionalmente
  "cansado", // Fatiga física o mental
  "disperso", // Dificultad para concentrarse
  "ansioso", // Inquietud o anticipación negativa
  "inquieto", // Dificultad para estar en paz
  "irritable", // Susceptible a molestias
  "frustrado", // Bloqueado o estancado
  "abrumado", // Sobrepasado por demandas
  "vulnerable", // Expuesto emocionalmente
  "impulsivo", // Dificultad para controlar impulsos
  "desanimado", // Bajo ánimo o desmotivación
  "gratitud", // Estado de agradecimiento
];

function diaryPrompt_() {
  // Obtener fecha actual en formato YYYY-MM-DD
  const today = new Date();
  const dateStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  // Crear lista de moods en formato compacto (3 por línea)
  const moodLines = [];
  for (let i = 0; i < MOOD_OPTIONS.length; i += 3) {
    const chunk = MOOD_OPTIONS.slice(i, i + 3);
    moodLines.push("  " + chunk.join(" | "));
  }

  return [
    "📝 [DIARIO] Responde a ESTE mensaje con tu entrada.",
    "",
    "📋 Formato:",
    `date: ${dateStr}`,
    "sleep_hours: 0-12",
    "energy: 1-5",
    "mood: (ver opciones abajo)",
    "focus_type: trading|lectura|estudio|none",
    "focus_minutes: N",
    "training: gym:45, caminata:30 (o none:0)",
    "alcohol: true|false",
    "alcohol_units: N (opcional)",
    "alcohol_context: social|solo|unknown (opcional)",
    "stalk: true|false",
    "stalk_intensity: low|mid|high (opcional)",
    "trading_trades: N",
    "game_commits: N",
    "feature_done: true|false",
    "notes: texto libre",
    "",
    "😊 Mood opciones (18):",
    ...moodLines,
    "",
    "💡 Tip: copia, completa y pega. El bot lo normaliza.",
  ].join("\n");
}

function parseDiaryText_(text) {
  const raw = String(text || "").trim();
  const now = new Date();

  const kvPipe = parsePipeKV_(raw);
  const kvLines = parseColonKV_(raw);
  const kv = Object.keys(kvPipe).length ? kvPipe : kvLines;

  const date = kv.date || kv.Date || isoDate_(now);
  const sleep_hours = toFloat_(kv.sleep_hours || kv.sleep);
  const energy = toInt_(kv.energy);

  // Normalizar mood: convertir a minúsculas y validar contra opciones
  let mood = String(kv.mood || "neutral")
    .toLowerCase()
    .trim();

  // Mapeo de términos en inglés comunes a español
  const moodMap = {
    calm: "calma",
    focused: "enfocado",
    energetic: "energético",
    confident: "confianza",
    motivated: "motivado",
    neutral: "neutral",
    stable: "estable",
    tired: "cansado",
    scattered: "disperso",
    anxious: "ansioso",
    restless: "inquieto",
    irritable: "irritable",
    frustrated: "frustrado",
    overwhelmed: "abrumado",
    vulnerable: "vulnerable",
    impulsive: "impulsivo",
    discouraged: "desanimado",
    grateful: "gratitud",
    gratitude: "gratitud",
    low: "desanimado",
  };

  // Aplicar mapeo si está en inglés
  if (moodMap[mood]) {
    mood = moodMap[mood];
  }

  // Si no está en la lista, mantener el valor pero avisar
  if (!MOOD_OPTIONS.includes(mood) && mood !== "unknown") {
    // Mantener el valor original pero podría logging aquí
    mood = mood;
  }

  const focus_type = kv.focus_type || kv.focus || "none";
  const focus_minutes = toInt_(kv.focus_minutes || kv.focus_min || kv.minutes);

  const training = parseTraining_(kv.training);

  const alcohol_consumed =
    kv.alcohol_consumed != null
      ? toBool01_(kv.alcohol_consumed) === 1
      : toBool01_(kv.alcohol) === 1;
  const alcohol_units = toFloat_(kv.alcohol_units || kv.units);
  const alcohol_context = kv.alcohol_context || kv.context || "unknown";

  const stalk_occurred =
    kv.stalk_occurred != null
      ? toBool01_(kv.stalk_occurred) === 1
      : toBool01_(kv.stalk) === 1;
  const stalk_intensity = kv.stalk_intensity || kv.intensity || "unknown";

  const trading_trades = toInt_(kv.trading_trades);
  const game_commits = toInt_(kv.game_commits);
  const feature_done = toBool01_(kv.feature_done) === 1;

  const notes = kv.notes || "";

  return {
    date: String(date),
    sleep_hours: sleep_hours,
    energy: energy,
    mood: String(mood),

    focus_type: String(focus_type),
    focus_minutes: focus_minutes,

    training: training,

    alcohol_consumed: !!alcohol_consumed,
    alcohol_context: String(alcohol_context),
    alcohol_units: alcohol_units,

    stalk_occurred: !!stalk_occurred,
    stalk_intensity: String(stalk_intensity),

    trading_trades: trading_trades || 0,
    game_commits: game_commits || 0,
    feature_done: !!feature_done,

    notes: String(notes),
  };
}

function parsePipeKV_(line) {
  const parts = String(line).split("|");
  const obj = {};
  parts.forEach((p) => {
    const t = String(p).trim();
    const m = t.match(/^([a-zA-Z_]+)\s*=\s*(.*)$/);
    if (m) obj[m[1].trim()] = m[2].trim();
  });
  return obj;
}

function parseColonKV_(text) {
  const lines = String(text).split("\n");
  const obj = {};
  lines.forEach((L) => {
    const line = String(L).trim();
    if (!line) return;
    const m = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (!m) return;
    obj[m[1].trim()] = m[2].trim();
  });
  return obj;
}

function parseTraining_(v) {
  const t = String(v || "").trim();
  if (!t) return [];

  if (t.toLowerCase() === "[]") return [];
  if (t.toLowerCase() === "none" || t.toLowerCase() === "none:0")
    return [{ type: "none", minutes: 0 }];

  const items = t
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const out = [];
  items.forEach((it) => {
    const parts = it.split(":").map((x) => x.trim());
    const type = parts[0] || "none";
    const min = toInt_(parts[1]);
    out.push({ type: type, minutes: min == null ? null : min });
  });
  return out;
}
