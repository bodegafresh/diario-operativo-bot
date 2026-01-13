/**
 * coach.gs
 * Coach 21 días + sprint semanal + entreno A/B (14 días)
 * - Plan fijo 08:30
 * - 4 recordatorios ALEATORIOS entre 06:00–22:00 (espaciados)
 * - Cierre fijo 22:30
 *
 * Reusa helpers existentes:
 * - tgSend_(), tgSendSafe_()
 * - cfgGet_(), cfgSet_()
 * - getChatId_()
 * - deleteTriggersByHandler_()
 * - isoDate_(), clamp_(), randomTimesSpaced_()
 * - (Opcional) appendCoachV2Log_() si lo tienes definido
 */

const COACH = {
  ENABLED: "COACH_ENABLED_V2", // true/false
  LEVEL: "COACH_LEVEL", // suave|estandar|desafiante
  DAY21: "COACH_DAY_21", // 1..21
  START_ISO: "COACH_START_ISO", // yyyy-mm-dd
  WEEK_INDEX: "COACH_WEEK_INDEX", // 1..N (incrementa cada lunes)
  TRAIN_DAY14: "COACH_TRAIN_DAY14", // 1..14 (A/B)

  LAST_AM: "COACH_LAST_AM", // yyyy-mm-dd
  LAST_PM: "COACH_LAST_PM", // yyyy-mm-dd
  LAST_REM_SCHEDULED: "COACH_LAST_REM_SCHEDULED", // yyyy-mm-dd (para no reprogramar 2 veces)
};

const COACH_DEFAULT_LEVEL = "estandar";

// Plan fijo + cierre fijo
const COACH_AM = { h: 8, m: 30 };
const COACH_PM = { h: 22, m: 30 };

// Recordatorios aleatorios
const COACH_REM_COUNT = 4;
const COACH_REM_START_H = 6;
const COACH_REM_END_H = 22; // ventana hasta 22:00
const COACH_REM_MIN_GAP_MIN = 120; // separación mínima entre recordatorios

// ========== Enabled gate ==========
function coachEnabled_() {
  return String(cfgGet_(COACH.ENABLED, "true")) === "true";
}
function coachSetEnabled_(enabled) {
  cfgSet_(COACH.ENABLED, enabled ? "true" : "false");
}
function coachIsEnabledGate_() {
  return coachEnabled_();
}

// ========== Niveles ==========
function coachParams_() {
  const lvl = String(cfgGet_(COACH.LEVEL, COACH_DEFAULT_LEVEL)).toLowerCase();

  if (lvl === "suave") {
    return {
      level: "suave",
      mins: {
        read: 25,
        voice: 8,
        english: 10,
        story: 6,
        ritual: 5,
        workout: 25,
      },
      validMin: 3,
      fragileMin: 2,
      resetMax: 1,
      alcoholResets: false,
    };
  }

  if (lvl === "desafiante") {
    return {
      level: "desafiante",
      mins: {
        read: 40,
        voice: 15,
        english: 20,
        story: 12,
        ritual: 8,
        workout: 35,
      },
      validMin: 5,
      fragileMin: 4,
      resetMax: 3,
      alcoholResets: true,
    };
  }

  return {
    level: "estandar",
    mins: {
      read: 30,
      voice: 10,
      english: 15,
      story: 10,
      ritual: 6,
      workout: 30,
    },
    validMin: 4,
    fragileMin: 3,
    resetMax: 2,
    alcoholResets: true,
  };
}

// ========== Sprints ==========
function coachSprintByWeek_(weekN) {
  const W = Number(weekN) || 1;
  const sprints = [
    {
      foco: "Lectura con atención",
      regla: "1 idea explicable > muchas páginas en blanco.",
      objetivo: "Terminar cada bloque con 2 frases de resumen.",
    },
    {
      foco: "Voz + ritmo Lucifer",
      regla: "Más lento, más claro, pausas antes del remate.",
      objetivo: "1 nota de voz/día explicando lo leído (60–90s).",
    },
    {
      foco: "Abdomen + postura",
      regla: "Core diario mínimo. Técnica primero.",
      objetivo: "Rutina A/B 6 días + 1 descarga.",
    },
    {
      foco: "Inglés output",
      regla: "Hablar/escribir > consumir contenido.",
      objetivo: "10–20 min/día hablando o escribiendo sin parar.",
    },
    {
      foco: "Storytelling",
      regla: "Inicio–nudo–desenlace. Simple y claro.",
      objetivo: "1 mini-historia diaria (30–60s).",
    },
    {
      foco: "Historia/Antropología",
      regla: "¿Quién habla? ¿Qué se omite? ¿Para quién es progreso?",
      objetivo: "1 párrafo explicado con tus palabras.",
    },
  ];
  return sprints[(W - 1) % sprints.length];
}

// ========== Estado ==========
function coachState_() {
  let day21 = Number(cfgGet_(COACH.DAY21, "1")) || 1;
  day21 = clamp_(day21, 1, 21);

  let week = Number(cfgGet_(COACH.WEEK_INDEX, "1")) || 1;
  if (week < 1) week = 1;

  let trainDay = Number(cfgGet_(COACH.TRAIN_DAY14, "1")) || 1;
  trainDay = clamp_(trainDay, 1, 14);

  let startIso = cfgGet_(COACH.START_ISO, "");
  if (!startIso) {
    startIso = isoDate_(new Date());
    cfgSet_(COACH.START_ISO, startIso);
  }

  return { day21, week, trainDay, startIso };
}

function coachSetLevel_(lvl) {
  const v = String(lvl || "").toLowerCase();
  if (["suave", "estandar", "desafiante"].indexOf(v) === -1) {
    throw new Error("Nivel inválido. Usa: suave | estandar | desafiante");
  }
  cfgSet_(COACH.LEVEL, v);
}

function coachReset21_() {
  cfgSet_(COACH.DAY21, "1");
  cfgSet_(COACH.START_ISO, isoDate_(new Date()));
}

function coachAdvanceDay_() {
  const st = coachState_();

  let next21 = st.day21 + 1;
  if (next21 > 21) next21 = 1;
  cfgSet_(COACH.DAY21, String(next21));

  let next14 = st.trainDay + 1;
  if (next14 > 14) next14 = 1;
  cfgSet_(COACH.TRAIN_DAY14, String(next14));

  return { next21, next14 };
}

// ========== Entreno A/B ==========
function coachWorkoutLabel_(trainDay) {
  return trainDay % 2 === 1
    ? "A (Abdomen + Empuje)"
    : "B (Abdomen + Piernas/Espalda)";
}

function coachWorkoutText_(trainDay) {
  const A = [
    "💪 Rutina A — Abdomen + Empuje",
    "• Crunch lento 3×20",
    "• Elevación piernas 3×15",
    "• Toques talón 3×30",
    "• Plancha 3×45s",
    "",
    "Empuje:",
    "• Flexiones 3×12–15",
    "• Flexiones inclinadas 3×12",
    "• Fondos silla 3×12–15",
    "• Pike push-ups 2×8–10",
    "",
    "Tabata 4 min: climbers / high knees",
  ].join("\n");

  const B = [
    "💪 Rutina B — Abdomen + Piernas/Espalda",
    "• Hollow hold 3×30s",
    "• Bicycle crunch 3×25",
    "• Plancha lateral 2×30s/lad",
    "• Reverse crunch 3×20",
    "",
    "Piernas/Espalda:",
    "• Sentadillas 3×20",
    "• Lunges 3×12/lad",
    "• Hip thrust 3×20",
    "• Remo con mochila 3×12–15",
    "",
    "Tabata 4 min: burpees suaves",
  ].join("\n");

  return trainDay % 2 === 1 ? A : B;
}

// ========== Mensajes ==========
function coachMorningText_() {
  const st = coachState_();
  const p = coachParams_();
  const sp = coachSprintByWeek_(st.week);
  const wlabel = coachWorkoutLabel_(st.trainDay);

  return [
    `🧭 [COACH] Día ${st.day21}/21 — Sprint: ${sp.foco}`,
    `🎯 Regla semana: ${sp.regla}`,
    "",
    "Plan de hoy (simple y ejecutable):",
    "",
    `📖 Lectura (${p.mins.read} min) → 1 idea explicable en 2 frases`,
    `🗣️ Voz (${p.mins.voice} min) → lectura modulada / “hmm” pecho + pausas`,
    `🇬🇧 Inglés (${p.mins.english} min) → OUTPUT (hablar o escribir)`,
    `🎭 Storytelling (${p.mins.story} min) → mini historia 3 actos (30–60s)`,
    `🧘 Ritual (${p.mins.ritual} min) → respiración + reencuadre + “yo soy”`,
    "",
    `💪 Entrenamiento (${p.mins.workout}–40 min) → Rutina ${wlabel}`,
    "",
    "Reglas sagradas hoy:",
    "• ❌ alcohol",
    "• ❌ redes que te rompen",
    "• ✔ dormir decente",
  ].join("\n");
}

function coachReminderTextRandom_() {
  const p = coachParams_();
  const st = coachState_();
  const sp = coachSprintByWeek_(st.week);

  const pool = [
    `⏱️ [COACH] Micro-check: 10 min ahora > cero. ¿Lectura (${p.mins.read}m) empezada?`,
    `⏱️ [COACH] Haz 1 bloque mínimo: Voz ${p.mins.voice}m o Inglés output ${p.mins.english}m.`,
    `⏱️ [COACH] Sprint (${sp.foco}): cumple lo pequeño. 1 idea en 2 frases y sigues.`,
    `⏱️ [COACH] Si estás evitando: 6 min de ritual y vuelves al control.`,
    `⏱️ [COACH] Cuerpo: aunque sea descarga. 15–20 min y listo. No negocies con el cerebro.`,
    `⏱️ [COACH] Storytelling: 30–60s con inicio–nudo–desenlace. Hazlo feo, pero hazlo.`,
  ];

  return pickRandom_(pool);
}

function coachNightCheckText_() {
  const st = coachState_();
  return [
    `🌙 [COACH-CHECK] Cierre del día ${st.day21}/21`,
    "",
    "Responde a ESTE mensaje con 7 valores:",
    "entreno lectura voz ingles story ritual alcohol",
    "",
    "Ejemplos:",
    "✅ si si si si si si no",
    "✅ 1 1 1 1 1 1 0",
    "⚠️ si si no si no si no",
    "❌ no no no si no no no",
    "",
    "Nota: alcohol = si rompe (en estándar/desafiante).",
  ].join("\n");
}

function coachSprintKickoffText_() {
  const st = coachState_();
  const sp = coachSprintByWeek_(st.week);
  return [
    `🧩 [SPRINT] Semana ${st.week} — Foco: ${sp.foco}`,
    "",
    "Regla:",
    sp.regla,
    "",
    "Objetivo:",
    sp.objetivo,
  ].join("\n");
}

function coachStatusText_() {
  const st = coachState_();
  const p = coachParams_();
  const sp = coachSprintByWeek_(st.week);
  const wlabel = coachWorkoutLabel_(st.trainDay);

  return [
    "🧭 Coach status",
    `enabled: ${coachEnabled_() ? "ON" : "OFF"}`,
    `nivel: ${p.level}`,
    `día 21: ${st.day21}/21`,
    `semana: ${st.week} (${sp.foco})`,
    `entreno hoy: Rutina ${wlabel} (día ${st.trainDay}/14)`,
    `mínimos: lectura ${p.mins.read}m | voz ${p.mins.voice}m | inglés ${p.mins.english}m | story ${p.mins.story}m | ritual ${p.mins.ritual}m | entreno ${p.mins.workout}m`,
    "",
    `recordatorios: plan ${pad2_(COACH_AM.h)}:${pad2_(
      COACH_AM.m
    )} + 4 aleatorios (06–22) + check ${pad2_(COACH_PM.h)}:${pad2_(
      COACH_PM.m
    )}`,
  ].join("\n");
}

function pad2_(n) {
  n = Number(n) || 0;
  return (n < 10 ? "0" : "") + n;
}

// ========== Triggers ==========
function ensureCoachTriggers_() {
  // Plan fijo
  deleteTriggersByHandler_("coachSendMorning_");
  ScriptApp.newTrigger("coachSendMorning_")
    .timeBased()
    .everyDays(1)
    .atHour(COACH_AM.h)
    .nearMinute(COACH_AM.m)
    .create();

  // Cierre fijo
  deleteTriggersByHandler_("coachSendNightCheck_");
  ScriptApp.newTrigger("coachSendNightCheck_")
    .timeBased()
    .everyDays(1)
    .atHour(COACH_PM.h)
    .nearMinute(COACH_PM.m)
    .create();

  // Sprint semanal
  deleteTriggersByHandler_("coachSprintKickoff_");
  ScriptApp.newTrigger("coachSprintKickoff_")
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  // Scheduler diario para recordatorios aleatorios
  deleteTriggersByHandler_("scheduleDailyCoachReminders_");
  ScriptApp.newTrigger("scheduleDailyCoachReminders_")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(7)
    .create();

  // Limpieza: elimina triggers antiguos de recordatorios fijos si existieran
  deleteTriggersByHandler_("coachReminder_1_");
  deleteTriggersByHandler_("coachReminder_2_");
  deleteTriggersByHandler_("coachReminder_3_");
  deleteTriggersByHandler_("coachReminder_4_");

  // Programa hoy mismo (por si lo instalas a mitad de día)
  scheduleDailyCoachReminders_();
}

function coachSendMorning_() {
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;

  const today = isoDate_(new Date());
  if (cfgGet_(COACH.LAST_AM, "") === today) return;

  tgSendSafe_(chatId, coachMorningText_());
  cfgSet_(COACH.LAST_AM, today);
}

function coachSendPlanNow_() {
  // FORZADO: /plan siempre responde
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;
  tgSendSafe_(chatId, coachMorningText_());
}

function coachSendNightCheck_() {
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;

  const today = isoDate_(new Date());
  if (cfgGet_(COACH.LAST_PM, "") === today) return;

  tgSendSafe_(chatId, coachNightCheckText_());
  cfgSet_(COACH.LAST_PM, today);
}

function coachSprintKickoff_() {
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;

  const st = coachState_();
  tgSendSafe_(chatId, coachSprintKickoffText_());
  cfgSet_(COACH.WEEK_INDEX, String(st.week + 1));
}

// ========== Recordatorios aleatorios ==========
function scheduleDailyCoachReminders_() {
  // Si está OFF, borra recordatorios pendientes y sale
  if (!coachIsEnabledGate_()) {
    deleteTriggersByHandler_("coachReminderRandom_");
    return;
  }

  const chatId = getChatId_();
  if (!chatId) return;

  // Evita reprogramar dos veces el mismo día (si te escribes al bot varias veces)
  const today = isoDate_(new Date());
  if (cfgGet_(COACH.LAST_REM_SCHEDULED, "") === today) return;

  // Borra los recordatorios anteriores (del día previo o manual)
  deleteTriggersByHandler_("coachReminderRandom_");

  // Determina si programar para hoy o mañana (si ya pasó la ventana)
  const now = new Date();

  const endToday = new Date(now);
  endToday.setHours(COACH_REM_END_H, 0, 0, 0);

  const targetDay = new Date(now);
  if (now > endToday) targetDay.setDate(targetDay.getDate() + 1);

  const start = new Date(targetDay);
  start.setHours(COACH_REM_START_H, 0, 0, 0);

  const end = new Date(targetDay);
  end.setHours(COACH_REM_END_H, 0, 0, 0);

  const times = randomTimesSpaced_(
    start,
    end,
    COACH_REM_COUNT,
    COACH_REM_MIN_GAP_MIN
  );

  times.forEach((t) =>
    ScriptApp.newTrigger("coachReminderRandom_").timeBased().at(t).create()
  );

  cfgSet_(COACH.LAST_REM_SCHEDULED, today);
}

function coachReminderRandom_() {
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;

  tgSend_(chatId, coachReminderTextRandom_());
}

// ========== Parse cierre nocturno ==========
function parseCoachCheckAnswer_(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase();
  if (!t) return null;

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 7) return null;

  const vals = parts.slice(0, 7).map((x) => {
    if (x === "1" || x === "si" || x === "sí" || x === "ok" || x === "y")
      return 1;
    if (x === "0" || x === "no" || x === "n") return 0;
    return null;
  });

  if (vals.some((v) => v == null)) return null;

  return {
    workout: vals[0],
    read: vals[1],
    voice: vals[2],
    english: vals[3],
    story: vals[4],
    ritual: vals[5],
    alcohol: vals[6],
  };
}

function coachScore_(obj) {
  return (
    (obj.workout ? 1 : 0) +
    (obj.read ? 1 : 0) +
    (obj.voice ? 1 : 0) +
    (obj.english ? 1 : 0) +
    (obj.story ? 1 : 0) +
    (obj.ritual ? 1 : 0)
  );
}

function coachApplyNightResult_(obj) {
  const p = coachParams_();
  const score = coachScore_(obj);
  const drank = obj.alcohol === 1;

  if (drank && p.alcoholResets) {
    coachReset21_();
    return { action: "reset", reason: "alcohol", score };
  }

  const effScore = drank && !p.alcoholResets ? Math.max(0, score - 1) : score;

  if (effScore <= p.resetMax) {
    coachReset21_();
    return { action: "reset", reason: "score", score: effScore };
  }

  const adv = coachAdvanceDay_();
  const tier = effScore < p.validMin ? "fragile" : "valid";

  if (typeof appendCoachV2Log_ === "function") {
    appendCoachV2Log_(new Date(), {
      level: p.level,
      score: effScore,
      drank: drank,
      tasks: obj,
    });
  }

  return {
    action: "advance",
    tier,
    score: effScore,
    next21: adv.next21,
    next14: adv.next14,
  };
}

// ========== Comandos ==========
function coachHandleCommand_(chatId, messageId, cmd, arg) {
  if (cmd === "/coach") {
    const a = String(arg || "").toLowerCase();

    if (!a || a === "status") {
      tgSendSafe_(chatId, coachStatusText_(), messageId);
      return true;
    }

    if (a === "on") {
      coachSetEnabled_(true);
      tgSend_(chatId, "✅ Coach ON.", messageId);

      // asegura triggers + agenda recordatorios aleatorios hoy
      ensureCoachTriggers_();
      scheduleDailyCoachReminders_();

      // manda plan al tiro
      coachSendPlanNow_();
      return true;
    }

    if (a === "off") {
      coachSetEnabled_(false);
      // borra recordatorios pendientes (para que no sigan llegando)
      deleteTriggersByHandler_("coachReminderRandom_");
      tgSend_(chatId, "🛑 Coach OFF.", messageId);
      return true;
    }

    if (a === "reset21") {
      coachReset21_();
      tgSend_(chatId, "🔁 Reiniciado a Día 1/21.", messageId);
      return true;
    }

    tgSend_(chatId, "Uso: /coach on | off | status | reset21", messageId);
    return true;
  }

  if (cmd === "/nivel") {
    if (!arg) {
      tgSend_(chatId, "Uso: /nivel suave | estandar | desafiante", messageId);
      return true;
    }
    coachSetLevel_(arg);
    tgSend_(chatId, "✅ Nivel actualizado: " + arg, messageId);
    return true;
  }

  if (cmd === "/entreno") {
    const st = coachState_();
    tgSendSafe_(chatId, coachWorkoutText_(st.trainDay), messageId);
    return true;
  }

  if (cmd === "/plan") {
    coachSendPlanNow_(); // FORZADO: siempre responde
    return true;
  }

  return false;
}

// ========== Run helpers ==========
function run_ensureCoachTriggers() {
  ensureCoachTriggers_();
}
function run_sendCoachMorningNow() {
  coachSendMorning_();
}
function run_sendCoachNightNow() {
  coachSendNightCheck_();
}
function run_scheduleCoachRemindersNow() {
  scheduleDailyCoachReminders_();
}
function run_sendCoachReminderNow() {
  coachReminderRandom_();
}
