/**
 * diary.gs
 * /diario prompt + parser flexible
 */

function diaryPrompt_() {
  return [
    "[DIARIO] Responde a ESTE mensaje (Responder) con tu entrada.",
    "",
    "Formato recomendado (simple):",
    "date: YYYY-MM-DD",
    "sleep_hours: 0-12",
    "energy: 1-5",
    "mood: calm|neutral|low|...",
    "focus_type: trading|lectura|estudio|none",
    "focus_minutes: N",
    "training: gym:45, caminata:30 (o none:0)",
    "alcohol: true|false (opcional units/context)",
    "alcohol_units: N (opcional)",
    "alcohol_context: social|solo|unknown (opcional)",
    "stalk: true|false (opcional intensity)",
    "stalk_intensity: low|mid|high (opcional)",
    "trading_trades: N",
    "game_commits: N",
    "feature_done: true|false",
    "notes: texto libre",
    "",
    "Tip: pega tu bloque y el bot lo normaliza.",
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
  const mood = kv.mood || "unknown";

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
