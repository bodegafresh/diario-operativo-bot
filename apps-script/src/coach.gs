/**
 * coach.gs (v3 + /ritual)
 * Coach 90 días (12 semanas) + ciclos 21 días (3 ciclos + 1 integración)
 * Sprints semanales más profundos + entreno diario detallado (músculos + ejercicios)
 * Recordatorios 06–22 (AM + 4 micro-checks + PM) + cierre nocturno con score
 *
 * ✅ Filosofía: “progresivo, ejecutable, sin perfección”.
 * ✅ Enfoque: reconectar contigo, estabilidad emocional, disciplina suave pero constante.
 *
 * NUEVO:
 * - /ritual → envía 1 afirmación “Yo soy” aleatoria + micro-ritual guiado (2–4 min)
 */

/* =========================
   CONFIG / STATE KEYS
========================= */

const COACH = {
  ENABLED: "COACH_ENABLED",
  LEVEL: "COACH_LEVEL",
  START_ISO: "COACH_START_ISO",
  // NOTE: State tracking moved to Sheets "CoachState" table
};

const COACH_DEFAULT_LEVEL = "estandar";

/* =========================
   RITUAL: “YO SOY” BANK
   - se entrega 1 aleatoria en /ritual
   - pensadas para reconectar contigo (no “perfecto”, sí real)
========================= */

const YO_SOY_BANK = {
  nucleo: [
    "Yo soy un hombre que se elige.",
    "Yo soy calma antes que reacción.",
    "Yo soy disciplina simple: hago lo mínimo aunque no tenga ganas.",
    "Yo soy consistente.",
    "Yo soy dueño de mi atención.",
    "Yo soy alguien que cumple su palabra (aunque sea pequeña).",
    "Yo soy responsable de mi energía y mi dinero.",
    "Yo soy un hombre que avanza: no perfecto, pero constante.",
  ],

  emocional: [
    "Yo soy capaz de sentir sin actuar impulsivamente.",
    "Yo soy más grande que un impulso de cinco minutos.",
    "Yo soy paz incluso con incomodidad.",
    "Yo soy alguien que se cuida cuando está vulnerable.",
    "Yo soy alguien que no se abandona.",
  ],

  presencia: [
    "Yo soy presencia: hablo lento y claro.",
    "Yo soy postura firme y tranquila.",
    "Yo soy control: respiro y decido.",
    "Yo soy energía estable.",
  ],

  trabajo: [
    "Yo soy valor: aporto claridad.",
    "Yo soy enfoque: termino lo que empiezo.",
    "Yo soy alguien que cuida su dinero con respeto.",
    "Yo soy un hombre que no compra para llenar vacíos.",
    "Yo soy decisiones conscientes.",
  ],
};

function pickRandom_(arr) {
  if (!arr || !arr.length) return "";
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

/**
 * Obtiene las 4 afirmaciones del día (una por categoría).
 * Las mismas se mantienen durante todo el día, cambian cada día.
 * Now uses Sheets CoachState instead of properties.
 */
function getDailyAffirmations_() {
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  const savedDate = getCoachRitualDailyDate_();
  const savedAffirmationsStr = getCoachRitualDailyAffirmations_();

  // Si ya tenemos afirmaciones para hoy, las devolvemos
  if (savedDate === todayStr && savedAffirmationsStr) {
    try {
      return JSON.parse(savedAffirmationsStr);
    } catch (e) {
      // Si hay error al parsear, generamos nuevas
    }
  }

  // Generar nuevas afirmaciones (una por categoría)
  const affirmations = [
    pickRandom_(YO_SOY_BANK.nucleo),
    pickRandom_(YO_SOY_BANK.emocional),
    pickRandom_(YO_SOY_BANK.presencia),
    pickRandom_(YO_SOY_BANK.trabajo),
  ];

  // Guardar para el resto del día (using Sheets CoachState)
  setCoachRitualDailyDate_(todayStr);
  setCoachRitualDailyAffirmations_(JSON.stringify(affirmations));

  return affirmations;
}

/* =========================
   TIMINGS (AM / REM / PM)
========================= */

const COACH_AM = { h: 8, m: 30 };
const COACH_REMINDERS = [
  { num: 1, h: 10, m: 30 },
  { num: 2, h: 14, m: 0 },
  { num: 3, h: 17, m: 30 },
  { num: 4, h: 20, m: 30 },
];
const COACH_PM = { h: 22, m: 30 };

/* =========================
   ENABLED GATE
========================= */

function coachEnabled_() {
  return String(cfgGet_(COACH.ENABLED, "true")) === "true";
}
function coachSetEnabled_(enabled) {
  cfgSet_(COACH.ENABLED, enabled ? "true" : "false");
}
function coachIsEnabledGate_() {
  return coachEnabled_();
}

/* =========================
   LEVEL PARAMS (mínimos)
   - NO perfección: se evalúa por “score”, no por cumplir todo
========================= */

function coachParams_() {
  const lvl = String(cfgGet_(COACH.LEVEL, COACH_DEFAULT_LEVEL)).toLowerCase();

  if (lvl === "suave") {
    return {
      level: "suave",
      mins: {
        read: 20,
        voice: 6,
        english: 8,
        story: 5,
        ritual: 4,
        workout: 22,
      },
      validMin: 3,
      fragileMin: 2,
      resetMax: 1,
      alcoholResets: false,
      impulseBudget: 1,
    };
  }

  if (lvl === "desafiante") {
    return {
      level: "desafiante",
      mins: {
        read: 45,
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
      impulseBudget: 0,
    };
  }

  return {
    level: "estandar",
    mins: {
      read: 30,
      voice: 10,
      english: 15,
      story: 8,
      ritual: 6,
      workout: 30,
    },
    validMin: 4,
    fragileMin: 3,
    resetMax: 2,
    alcoholResets: true,
    impulseBudget: 0,
  };
}

/* =========================
   STATE
========================= */

function coachState_() {
  let startIso = cfgGet_(COACH.START_ISO, "");
  if (!startIso) {
    startIso = isoDate_(new Date());
    cfgSet_(COACH.START_ISO, startIso);
  }

  let week = getCoachWeekIndex_();
  if (week < 1) week = 1;
  if (week > 12) week = 12;

  let day21 = getCoachDay21_();
  day21 = clamp_(day21, 1, 21);

  let cycle21 = getCoachCycle21_();
  cycle21 = clamp_(cycle21, 1, 4);

  let trainDay = getCoachTrainDay14_();
  trainDay = clamp_(trainDay, 1, 14);

  let day90 = getCoachDay90_();
  day90 = clamp_(day90, 1, 90);

  return { startIso, week, day21, cycle21, trainDay, day90 };
}

function coachSetLevel_(lvl) {
  const v = String(lvl || "").toLowerCase();
  if (["suave", "estandar", "desafiante"].indexOf(v) === -1) {
    throw new Error("Nivel inválido. Usa: suave | estandar | desafiante");
  }
  cfgSet_(COACH.LEVEL, v);
}

function coachReset21_() {
  setCoachDay21_(1);
}

function coachReset90_() {
  cfgSet_(COACH.START_ISO, isoDate_(new Date()));
  setCoachWeekIndex_(1);
  setCoachDay21_(1);
  setCoachCycle21_(1);
  setCoachTrainDay14_(1);
  setCoachDay90_(1);
  setCoachImpulseCount_(0);
}

function coachAdvanceDay_() {
  const st = coachState_();

  let next90 = st.day90 + 1;
  if (next90 > 90) next90 = 90;
  setCoachDay90_(next90);

  let next14 = st.trainDay + 1;
  if (next14 > 14) next14 = 1;
  setCoachTrainDay14_(next14);

  let next21 = st.day21 + 1;
  let nextCycle = st.cycle21;

  if (next21 > 21) {
    next21 = 1;
    nextCycle = Math.min(4, nextCycle + 1);
    setCoachCycle21_(nextCycle);
  }
  setCoachDay21_(next21);

  return { next90, next14, next21, nextCycle };
}

/* =========================
   90-DAY PHASES + 21-DAY THEMES
========================= */

function coachPhaseByWeek_(weekN) {
  const w = Number(weekN) || 1;
  if (w <= 4)
    return { phase: "FUNDAMENTO", note: "menos perfección, más consistencia" };
  if (w <= 8)
    return { phase: "CONSTRUCCIÓN", note: "subir intensidad sin quemarte" };
  return { phase: "INTEGRACIÓN", note: "que se vuelva tu identidad" };
}

function coachTheme21_(cycleN) {
  const c = Number(cycleN) || 1;
  const themes = {
    1: {
      name: "CONTROL DE IMPULSOS",
      rule: "Pausa 90s antes de actuar.",
      target: "Reducir decisiones emocionales.",
    },
    2: {
      name: "DISCIPLINA ESTABLE",
      rule: "Hacer el mínimo aunque sea poco.",
      target: "Constancia > motivación.",
    },
    3: {
      name: "EXPANSIÓN SOCIAL/PRO",
      rule: "1 acto de presencia/día.",
      target: "Voz, claridad, carisma profesional.",
    },
    4: {
      name: "INTEGRACIÓN",
      rule: "Mantener sin drama.",
      target: "Sostener hábitos con calma.",
    },
  };
  return themes[c] || themes[1];
}

/* =========================
   WEEK SPRINTS (12 semanas)
========================= */

function coachSprintByWeek_(weekN) {
  const W = clamp_(Number(weekN) || 1, 1, 12);

  const sprints = [
    {
      foco: "Pausa + Control de impulsos",
      regla: "Si es emocional, esperas 90 segundos y respiras.",
      objetivo: "Registrar 1 impulso/día y NO ejecutarlo por 90s.",
      micro:
        "Antes de comprar/escribir: 5 respiraciones + pregunta: ¿me acerca o me aleja?",
    },
    {
      foco: "Sueño y energía base",
      regla: "Sin energía, no hay disciplina.",
      objetivo: "Dormir 7h promedio o mejorar 30 min vs semana anterior.",
      micro: "Apagar pantallas 30 min antes + lectura suave 10 min.",
    },
    {
      foco: "Core y postura (presencia)",
      regla: "Columna neutra, abdomen activo, hombros atrás.",
      objetivo: "Core diario mínimo + 1 check de postura en reuniones.",
      micro: "En cada reunión: bajar velocidad 15% + pausa al final.",
    },
    {
      foco: "Finanzas: freno a fugas",
      regla: "No se negocia el registro.",
      objetivo: "Registrar gastos diario 3–5 min + tope de ocio semanal.",
      micro: "Cualquier gasto “capricho” requiere espera de 24h.",
    },

    {
      foco: "Voz: lento, claro, con pausas",
      regla: "Hablar menos, decir mejor.",
      objetivo: "1 nota de voz/día 60–90s explicando algo.",
      micro: "En daily: 1 idea + 1 propuesta + silencio.",
    },
    {
      foco: "Inglés output (práctico)",
      regla: "Output > Input.",
      objetivo: "10–20 min/día hablando o escribiendo sin parar.",
      micro: "Monólogo en inglés: ‘today I worked on…’ 5–10 min.",
    },
    {
      foco: "Storytelling simple",
      regla: "Inicio–nudo–desenlace.",
      objetivo: "1 mini historia/día 30–60s (grabada o en voz alta).",
      micro: "Remate: una frase final con aprendizaje o giro.",
    },
    {
      foco: "Trabajo profundo (valor)",
      regla: "1 bloque de foco real vence 6 horas dispersas.",
      objetivo: "1 bloque de 25–45 min sin distracción por día.",
      micro: "Cerrar 1 micro-tarea visible (commit, doc, ticket).",
    },

    {
      foco: "Carisma profesional (presencia)",
      regla: "Calma + precisión = liderazgo.",
      objetivo: "2 intervenciones de calidad por reunión (máx).",
      micro: "Frases: ‘Propongo…’, ‘Sugiero…’, ‘Lo eficiente sería…’.",
    },
    {
      foco: "Cuerpo estético: definición consistente",
      regla: "Nutrición simple > rutinas perfectas.",
      objetivo: "Alcohol 0 (o mínimo) + 2 comidas limpias/día.",
      micro: "Proteína + verduras + agua; sin ‘compensar’ con culpa.",
    },
    {
      foco: "Autodominio emocional",
      regla: "No reacciono, respondo.",
      objetivo: "Identificar 1 trigger/semana y diseñar salida.",
      micro: "Si aparece ansiedad: caminar 10 min + respiración nasal.",
    },
    {
      foco: "Integración final: sostener",
      regla: "Sostener es el verdadero poder.",
      objetivo: "Repetir hábitos núcleo sin subir carga.",
      micro: "Checklist mínimo: entreno + registro gastos + lectura 10 min.",
    },
  ];

  return sprints[W - 1];
}

/* =========================
   WORKOUT: DETALLE DIARIO
========================= */

function weekdayName_(d) {
  const names = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return names[d] || "Día";
}

function coachWorkoutForToday_() {
  const now = new Date();
  const dow = now.getDay(); // 0=Dom..6=Sab
  const name = weekdayName_(dow);

  if (dow === 1) return workout_A_full_(name);
  if (dow === 2) return workout_B_full_(name);
  if (dow === 3) return workout_A_lite_cardio_(name);
  if (dow === 4) return workout_B_emphasis_(name);
  if (dow === 5) return workout_A_tabata_(name);
  if (dow === 6) return workout_core_posture_(name);
  return workout_recovery_(name);
}

function workout_A_full_(dayName) {
  return {
    label: `A FULL — Abdomen + Empuje (${dayName})`,
    muscles:
      "Recto abdominal/oblicuos + pecho + tríceps + deltoides anterior/medio",
    warmup: [
      "Jumping jacks 30",
      "Rotación hombros 20/20",
      "Rotación cadera 20",
      "Sentadillas suaves 10",
    ],
    core: [
      "Crunch lento 3×20 (2s sube/2s baja)",
      "Elevación de piernas 3×15 (1s arriba)",
      "Toques de talón 3×30",
      "Plancha frontal 3×45–60s",
    ],
    strength: [
      "Flexiones 3×12–15 (rodillas si hace falta)",
      "Flexiones inclinadas 3×12",
      "Fondos en silla 3×12–15",
      "Pike push-ups 2×8–10",
    ],
    finisher: ["Tabata 4 min: mountain climbers / high knees (20s/10s ×8)"],
    cooldown: [
      "Cobra 20–30s",
      "Pecho en puerta 20–30s/lado",
      "Tríceps 20–30s/brazo",
      "Respiración nasal 5 ciclos",
    ],
    time: "30–40 min",
  };
}

function workout_B_full_(dayName) {
  return {
    label: `B FULL — Abdomen + Piernas/Espalda (${dayName})`,
    muscles:
      "Transverso/oblicuos + glúteos/cuádriceps/isquios + dorsal/trapecio medio",
    warmup: [
      "Jumping jacks 30",
      "Sentadillas suaves 15",
      "Rotación cadera 20",
      "Estocadas cortas 10",
    ],
    core: [
      "Hollow hold 3×30s",
      "Bicycle crunch 3×25",
      "Plancha lateral 2×30s/lado",
      "Reverse crunch 3×20",
    ],
    strength: [
      "Sentadillas 3×20 (talones, espalda neutra)",
      "Lunges 3×12/lado",
      "Hip thrust 3×20 (aprieta glúteo arriba)",
      "Remo con mochila 3×12–15 (1s pausa al final)",
    ],
    finisher: ["Tabata 4 min: burpees suaves (sin salto alto si hay fatiga)"],
    cooldown: [
      "Cuádriceps 20–30s/lado",
      "Isquios 20–30s",
      "Postura del niño 20–30s",
      "Respiración lenta 5 ciclos",
    ],
    time: "30–40 min",
  };
}

function workout_A_lite_cardio_(dayName) {
  return {
    label: `A LITE + Cardio corto (${dayName})`,
    muscles: "Core + empuje ligero + cardio (sin fatigar)",
    warmup: [
      "Marcha en el sitio 60s",
      "Rotación hombros 20/20",
      "Respiración diafragmática 5 ciclos",
    ],
    core: [
      "Plancha frontal 3×60s",
      "Toques de talón 3×30",
      "Dead bug 3×10/lado (lento)",
    ],
    strength: ["Flexiones lentas 3×8–10 (control total, no al fallo)"],
    finisher: [
      "Cardio 5–8 min: 30s jumping jacks + 30s mountain climbers (repetir)",
    ],
    cooldown: [
      "Cobra 20–30s",
      "Pecho en puerta 20–30s/lado",
      "Respiración nasal 5 ciclos",
    ],
    time: "20–28 min",
  };
}

function workout_B_emphasis_(dayName) {
  return {
    label: `B ÉNFASIS — Glúteo/Espalda + Core (${dayName})`,
    muscles: "Glúteo mayor + dorsal/romboides + core (postura y presencia)",
    warmup: [
      "Sentadillas suaves 15",
      "Puente glúteo 15",
      "Remo sin peso 15",
      "Rotación cadera 20",
    ],
    core: [
      "Hollow hold 3×25–30s",
      "Plancha lateral 3×25–30s/lado",
      "Reverse crunch 3×15–20",
    ],
    strength: [
      "Sentadilla con pausa abajo 4×15 (2s pausa)",
      "Zancada atrás 3×12/lado",
      "Hip thrust con mochila 4×15",
      "Remo mochila 4×12 (1s pausa)",
    ],
    finisher: ["Opcional 3–4 min: high knees suave (si hay energía)"],
    cooldown: [
      "Glúteo/piriforme 20–30s/lado",
      "Isquios 20–30s",
      "Postura del niño 20–30s",
    ],
    time: "30–40 min",
  };
}

function workout_A_tabata_(dayName) {
  return {
    label: `A + TABATA FUERTE (${dayName})`,
    muscles: "Core + empuje + cardio intenso (anticraving / antiansiedad)",
    warmup: [
      "Jumping jacks 30",
      "Rotación hombros 20/20",
      "Flexiones fáciles 8",
      "Respiración 5 ciclos",
    ],
    core: [
      "Crunch con pausa arriba 3×20 (1–2s)",
      "Elevación piernas 3×12–15",
      "Plancha 3×45–60s",
    ],
    strength: [
      "Flexiones diamante 3×8–12 (o normales si cuesta)",
      "Fondos silla 3×12–15",
      "Pike push-ups 3×8–10",
    ],
    finisher: ["Tabata 4 min: burpees suaves (20s/10s ×8)"],
    cooldown: [
      "Cobra 20–30s",
      "Pecho en puerta 20–30s/lado",
      "Tríceps 20–30s/brazo",
    ],
    time: "30–40 min",
  };
}

function workout_core_posture_(dayName) {
  return {
    label: `CORE + POSTURA (estética) (${dayName})`,
    muscles:
      "Transverso abdominal + oblicuos + espalda alta (romboides/trapecio medio) + lumbares",
    warmup: [
      "Caminata suave 3 min o marcha",
      "Rotación torácica 10/lado",
      "Respiración 5 ciclos",
    ],
    core: [
      "Vacuum 5×10–12s (suave, sin marearte)",
      "Plancha lateral + elevación 3×10–12/lado",
      "Hollow hold 3×20–30s",
    ],
    strength: [
      "Superman hold 3×30s",
      "Remo 1 mano con mochila 3×12/lado",
      "Retracción escapular (apretar omóplatos) 3×12 (sin peso)",
    ],
    finisher: ["Opcional 8–12 min caminata (baja ansiedad, mejora sueño)"],
    cooldown: ["Postura del niño 30s", "Cobra 20–30s", "Cuello suave 10s/lado"],
    time: "22–35 min",
  };
}

function workout_recovery_(dayName) {
  return {
    label: `DESCARGA ACTIVA (${dayName})`,
    muscles: "Movilidad + circulación + recuperación (no cero movimiento)",
    warmup: ["Caminata 20–40 min (ideal)", "o 10 min si estás justo"],
    core: ["Plancha 2×45–60s (opcional)"],
    strength: [
      "Movilidad: cadera 2 min + hombros 2 min + columna torácica 2 min",
    ],
    finisher: ["Respiración nasal 5 min (lento)"],
    cooldown: ["Estiramiento suave 5 min"],
    time: "20–50 min",
  };
}

/* =========================
   RITUAL TEXT + HANDLER
========================= */

function coachRitualText_() {
  const st = coachState_();
  const p = coachParams_();
  const th = coachTheme21_(st.cycle21);

  const affirmations = getDailyAffirmations_();

  return [
    `🧘 [RITUAL] (${p.mins.ritual} min)`,
    `🔁 Ciclo ${st.cycle21} • Día ${st.day21}/21`,
    `📌 ${th.rule}`,
    "",
    "👃 1) Respiración (60–90s):",
    "• Inhala 4s nariz / exhala 6s nariz × 6–8 veces",
    "",
    "💬 2) Yo soy (repite cada una 3 veces, lento):",
    `• ${affirmations[0]}`,
    `• ${affirmations[1]}`,
    `• ${affirmations[2]}`,
    `• ${affirmations[3]}`,
    "",
    "🧠 3) Reencuadre (responde mentalmente):",
    "• ¿Qué puedo controlar ahora?",
    "• ¿Qué estoy soltando hoy?",
    "• ¿Cuál es la acción mínima en 10 min?",
    "",
    "⚡ 4) Acción mínima (elige 1):",
    "• 10m lectura | 10m entreno | 10m inglés | gastos (3m)",
  ].join("\n");
}

/* =========================
   TEXT BUILDERS (Morning/Rem/Night)
========================= */

function coachMorningText_() {
  const st = coachState_();
  const p = coachParams_();
  const sp = coachSprintByWeek_(st.week);
  const ph = coachPhaseByWeek_(st.week);
  const th = coachTheme21_(st.cycle21);
  const w = coachWorkoutForToday_();

  return [
    `🧭 [COACH] Semana ${st.week}/12 — ${ph.phase}`,
    `🔁 Ciclo 21d: ${st.day21}/21 — ${th.name}`,
    `🎯 ${th.target}`,
    `📌 ${th.rule}`,
    "",
    `🧩 Sprint: ${sp.foco}`,
    `• ${sp.regla}`,
    `• Objetivo: ${sp.objetivo}`,
    `• Micro-hábito: ${sp.micro}`,
    "",
    "📝 Plan de hoy:",
    "",
    `� Lectura (${p.mins.read}m) → 2 frases + 1 idea explicable`,
    `🗣️ Voz (${p.mins.voice}m) → “hmm” pecho + modulación + pausas`,
    `🇬🇧 Inglés (${p.mins.english}m) → OUTPUT (hablar o escribir)`,
    `🎭 Story (${p.mins.story}m) → mini historia 3 actos (30–60s)`,
    `🧘 Ritual (${p.mins.ritual} min) → usa /ritual (te entrega 1 “yo soy” aleatorio)`,
    "",
    `💪 Entreno (${p.mins.workout}–40m): ${w.label}`,
    `🎯 Músculos: ${w.muscles}`,
    "",
    "🛡️ Reglas hoy:",
    "• ❌ Alcohol (recaída = vuelve al mínimo, no te destruyas)",
    "• ❌ Redes/triggers que te rompen",
    "• ✅ Pausa 90s antes de cualquier impulso",
  ].join("\n");
}

function coachReminderText_(slotIdx) {
  const p = coachParams_();
  const st = coachState_();
  const th = coachTheme21_(st.cycle21);

  const reminders = [
    `⏰ [MICRO-CHECK]\n\n10 min hoy valen más que 0.\n¿Lectura (${p.mins.read}m) o solo 10m?\n\n📌 ${th.rule}`,
    `⏰ [MICRO-CHECK]\n\n5–10m de voz o inglés OUTPUT ahora.\nNo esperes motivación, hazlo.\n\n📌 ${th.rule}`,
    `⏰ [MICRO-CHECK]\n\n¿Ansioso?\n1) Camina 8–12m + 5 respiraciones\n2) Luego 1 tarea mínima\n\n📌 ${th.rule}`,
    `⏰ [ÚLTIMA VENTANA]\n\nEntreno + resumen + cerrar sin impulsos.\nPausa 90s antes de actuar.\n\n📌 ${th.rule}`,
  ];
  const i = clamp_(slotIdx, 0, reminders.length - 1);
  return reminders[i];
}

function coachNightCheckText_() {
  const st = coachState_();
  return [
    `🌙 [CIERRE] Semana ${st.week}/12 • Ciclo ${st.cycle21} Día ${st.day21}/21`,
    "",
    "📊 Responde con 8 valores (0 o 1):",
    "entreno lectura voz ingles story ritual alcohol impulsos",
    "",
    "Ejemplos:",
    "✅ 1 1 1 1 1 1 0 0 (día completo)",
    "⚠️ 1 1 0 1 0 1 0 2 (parcial)",
    "❌ 0 0 0 1 0 0 1 5 (día bajo)",
    "",
    "📝 Notas:",
    "• alcohol: 1 = tomé (puede resetear ciclo 21)",
    "• impulsos: número (compras/empujes emocionales sin pausa)",
  ].join("\n");
}

function coachSprintKickoffText_() {
  const st = coachState_();
  const sp = coachSprintByWeek_(st.week);
  const ph = coachPhaseByWeek_(st.week);
  return [
    `🧩 [SPRINT] Semana ${st.week}/12 — ${ph.phase}`,
    "",
    `🎯 Foco: ${sp.foco}`,
    "",
    "📌 Regla:",
    sp.regla,
    "",
    "🎯 Objetivo:",
    sp.objetivo,
    "",
    "⚡ Micro-hábito:",
    sp.micro,
  ].join("\n");
}

function coachStatusText_() {
  const st = coachState_();
  const p = coachParams_();
  const sp = coachSprintByWeek_(st.week);
  const ph = coachPhaseByWeek_(st.week);
  const th = coachTheme21_(st.cycle21);
  const w = coachWorkoutForToday_();

  return [
    "🧭 Coach V3 - Estado",
    "",
    "🟢 Sistema:",
    `• Estado: ${coachEnabled_() ? "✅ ON" : "❌ OFF"}`,
    `• Nivel: ${p.level}`,
    `• Inicio: ${st.startIso}`,
    "",
    "📊 Progreso:",
    `• Semana: ${st.week}/12 (${ph.phase})`,
    `• Ciclo 21d: ${st.cycle21}/4 — día ${st.day21}/21`,
    `• Tema: ${th.name}`,
    `• Sprint: ${sp.foco}`,
    "",
    "💪 Hoy:",
    `• Entreno: ${w.label}`,
    "",
    "🎯 Mínimos diarios:",
    `• Lectura: ${p.mins.read}m | Voz: ${p.mins.voice}m`,
    `• Inglés: ${p.mins.english}m | Story: ${p.mins.story}m`,
    `• Ritual: ${p.mins.ritual}m | Entreno: ${p.mins.workout}m`,
  ].join("\n");
}

/* =========================
   WORKOUT DETAILS COMMAND
========================= */

function coachWorkoutText_() {
  const w = coachWorkoutForToday_();
  const lines = [];
  lines.push(`💪 [ENTRENO DETALLE] ${w.label}`);
  lines.push(`🎯 Músculos: ${w.muscles}`);
  lines.push("");
  lines.push("Calentamiento:");
  w.warmup.forEach((x) => lines.push(`• ${x}`));
  lines.push("");
  lines.push("Core:");
  w.core.forEach((x) => lines.push(`• ${x}`));
  lines.push("");
  lines.push("Fuerza/Postura:");
  w.strength.forEach((x) => lines.push(`• ${x}`));
  lines.push("");
  lines.push("Finisher:");
  w.finisher.forEach((x) => lines.push(`• ${x}`));
  lines.push("");
  lines.push("Enfriamiento:");
  w.cooldown.forEach((x) => lines.push(`• ${x}`));
  lines.push("");
  lines.push(`⏱️ Duración: ${w.time}`);
  return lines.join("\n");
}

/* =========================
   TRIGGERS
========================= */

function ensureCoachTriggers_() {
  deleteTriggersByHandler_("coachSendMorning_");
  ScriptApp.newTrigger("coachSendMorning_")
    .timeBased()
    .everyDays(1)
    .atHour(COACH_AM.h)
    .nearMinute(COACH_AM.m)
    .create();

  COACH_REMINDERS.forEach((r, idx) => {
    const handler = `coachReminder_${idx + 1}_`;
    deleteTriggersByHandler_(handler);
    ScriptApp.newTrigger(handler)
      .timeBased()
      .everyDays(1)
      .atHour(r.h)
      .nearMinute(r.m)
      .create();
  });

  deleteTriggersByHandler_("coachSendNightCheck_");
  ScriptApp.newTrigger("coachSendNightCheck_")
    .timeBased()
    .everyDays(1)
    .atHour(COACH_PM.h)
    .nearMinute(COACH_PM.m)
    .create();

  deleteTriggersByHandler_("coachSprintKickoff_");
  ScriptApp.newTrigger("coachSprintKickoff_")
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
}

/* =========================
   SENDERS (AM / REM / PM)
========================= */

function coachSendMorning_() {
  coachSendMorningInternal_(false);
}
function coachSendMorningForce_() {
  coachSendMorningInternal_(true);
}

function coachSendMorningInternal_(force) {
  if (!coachIsEnabledGate_()) return;

  const chatId = getChatId_();
  if (!chatId) return;

  const today = isoDate_(new Date());
  if (!force && getCoachLastAM_() === today) return;

  try {
    tgSendSafe_(chatId, coachMorningText_());
    // Solo marcar LAST_AM si es automático (no forzado)
    if (!force) {
      setCoachLastAM_(today);
    }
  } catch (err) {
    console.error(err);
    try {
      tgSend_(
        chatId,
        "⚠️ Error enviando /plan: " +
          (err && err.message ? err.message : String(err))
      );
    } catch (_) {}
  }
}

function coachSendNightCheck_() {
  if (!coachIsEnabledGate_()) return;

  const chatId = getChatId_();
  if (!chatId) return;

  const today = isoDate_(new Date());
  if (getCoachLastPM_() === today) return;

  try {
    tgSendSafe_(chatId, coachNightCheckText_());
    setCoachLastPM_(today);
  } catch (err) {
    console.error(err);
  }
}

function coachReminder_1_() {
  coachReminderDispatch_(0);
}
function coachReminder_2_() {
  coachReminderDispatch_(1);
}
function coachReminder_3_() {
  coachReminderDispatch_(2);
}
function coachReminder_4_() {
  coachReminderDispatch_(3);
}

function coachReminderDispatch_(slotIdx) {
  if (!coachIsEnabledGate_()) return;

  const chatId = getChatId_();
  if (!chatId) return;

  const today = isoDate_(new Date());
  const reminder = COACH_REMINDERS[slotIdx];
  if (!reminder) return;

  const lastReminderDate = getCoachLastReminder_(reminder.num);
  if (lastReminderDate === today) return;

  try {
    tgSend_(chatId, coachReminderText_(slotIdx));
    setCoachLastReminder_(reminder.num, today);
  } catch (err) {
    console.error(err);
  }
}

function coachSprintKickoff_() {
  if (!coachIsEnabledGate_()) return;
  const chatId = getChatId_();
  if (!chatId) return;

  try {
    const st = coachState_();
    tgSendSafe_(chatId, coachSprintKickoffText_());
    setCoachWeekIndex_(Math.min(12, st.week + 1));
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   PARSE NIGHT ANSWER
   formato: entreno lectura voz ingles story ritual alcohol impulsos
========================= */

function parseCoachCheckAnswer_(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase();
  if (!t) return null;

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 8) return null;

  const boolish = (x) => {
    if (x === "1" || x === "si" || x === "sí" || x === "ok" || x === "y")
      return 1;
    if (x === "0" || x === "no" || x === "n") return 0;
    return null;
  };

  const vals = parts.slice(0, 7).map(boolish);
  if (vals.some((v) => v == null)) return null;

  const impulses = Number(parts[7]);
  if (isNaN(impulses) || impulses < 0) return null;

  return {
    workout: vals[0],
    read: vals[1],
    voice: vals[2],
    english: vals[3],
    story: vals[4],
    ritual: vals[5],
    alcohol: vals[6],
    impulses: impulses,
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

  const prevImp = getCoachImpulseCount_();
  setCoachImpulseCount_(prevImp + (obj.impulses || 0));

  // Guardar log ANTES de procesar resets, para capturar el estado actual
  const currentState = coachState_();

  if (drank && p.alcoholResets) {
    // Guardar antes del reset
    if (typeof appendCoachV3Log_ === "function") {
      appendCoachV3Log_(new Date(), {
        level: p.level,
        score: score,
        drank: drank,
        impulses: obj.impulses || 0,
        tasks: obj,
        tier: "reset_alcohol",
        note: "Reset por alcohol",
      });
    }
    coachReset21_();
    return { action: "reset", reason: "alcohol", score: score };
  }

  const effScore = drank && !p.alcoholResets ? Math.max(0, score - 1) : score;

  const impulsePenalty = Math.floor((obj.impulses || 0) / 3);
  const scoreAfterImpulses = Math.max(0, effScore - impulsePenalty);

  if (scoreAfterImpulses <= p.resetMax) {
    // Guardar antes del reset
    if (typeof appendCoachV3Log_ === "function") {
      appendCoachV3Log_(new Date(), {
        level: p.level,
        score: scoreAfterImpulses,
        drank: drank,
        impulses: obj.impulses || 0,
        tasks: obj,
        tier: "reset_score",
        note: "Reset por score bajo",
      });
    }
    coachReset21_();
    return { action: "reset", reason: "score", score: scoreAfterImpulses };
  }

  const adv = coachAdvanceDay_();
  const tier = scoreAfterImpulses < p.validMin ? "fragile" : "valid";

  // Guardar en caso de avance normal
  if (typeof appendCoachV3Log_ === "function") {
    appendCoachV3Log_(new Date(), {
      level: p.level,
      score: scoreAfterImpulses,
      drank: drank,
      impulses: obj.impulses || 0,
      tasks: obj,
      tier: tier,
    });
  }

  return {
    action: "advance",
    tier,
    score: scoreAfterImpulses,
    next90: adv.next90,
    next21: adv.next21,
    nextCycle: adv.nextCycle,
  };
}

/* =========================
   COMMANDS
   /coach on|off|status|reset21|reset90
   /nivel suave|estandar|desafiante
   /plan (forzado)
   /entreno (detalle)
   /ritual (nuevo)
========================= */

function coachHandleCommand_(chatId, messageId, cmd, arg) {
  if (cmd === "/coach") {
    const a = String(arg || "").toLowerCase();

    if (!a || a === "status") {
      tgSendSafe_(chatId, coachStatusText_(), messageId);
      return true;
    }

    if (a === "on") {
      coachSetEnabled_(true);
      tgSend_(chatId, "✅ Coach V3 ON.", messageId);
      coachSendMorningInternal_(true);
      return true;
    }

    if (a === "off") {
      coachSetEnabled_(false);
      tgSend_(chatId, "🛑 Coach V3 OFF.", messageId);
      return true;
    }

    if (a === "reset21") {
      coachReset21_();
      tgSend_(
        chatId,
        "🔁 Reiniciado ciclo 21 a Día 1/21 (sin destruir el mes).",
        messageId
      );
      return true;
    }

    if (a === "reset90") {
      coachReset90_();
      tgSend_(
        chatId,
        "🧹 Reset completo 90 días (semana 1, ciclo 1, día 1).",
        messageId
      );
      return true;
    }

    tgSend_(
      chatId,
      "Uso: /coach on | off | status | reset21 | reset90",
      messageId
    );
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
    tgSendSafe_(chatId, coachWorkoutText_(), messageId);
    return true;
  }

  if (cmd === "/plan") {
    coachSendMorningForce_();
    return true;
  }

  if (cmd === "/ritual") {
    tgSendSafe_(chatId, coachRitualText_(), messageId);
    return true;
  }

  return false;
}

/* =========================
   RUN HELPERS
========================= */

function run_ensureCoachTriggers() {
  ensureCoachTriggers_();
}
function run_sendCoachMorningNow() {
  coachSendMorningForce_();
}
function run_sendCoachNightNow() {
  coachSendNightCheck_();
}
function run_sendCoachRemindersNow() {
  coachReminderDispatch_(0);
  coachReminderDispatch_(1);
  coachReminderDispatch_(2);
  coachReminderDispatch_(3);
}
function run_sendRitualNow() {
  const chatId = getChatId_();
  if (!chatId) return;
  tgSendSafe_(chatId, coachRitualText_());
}
