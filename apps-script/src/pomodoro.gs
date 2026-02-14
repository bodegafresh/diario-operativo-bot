/**
 * pomodoro.gs
 * Pomodoro 25/5 x4 + 15. Solo Lun–Vie 09:00–18:00 Chile.
 * ESTADO: Se guarda en Properties (simple, robusto, sin complejidad de Sheets)
 * /pomodoro start → Inicia LIMPIO (resetea todo)
 * /pomodoro stop → Desactiva completamente
 */

function pomodoroStart_() {
  // Resetear a estado limpio
  cfgDel_(PROP.POMO_PHASE);
  cfgDel_(PROP.POMO_CYCLE);
  cfgDel_(PROP.POMO_END_MS);
  
  // Iniciar fresh
  cfgSet_(PROP.POMO_PHASE, "work");
  cfgSet_(PROP.POMO_CYCLE, "1");
  cfgSet_(PROP.POMO_END_MS, "0");
  cfgSet_(PROP.POMO_ENABLED, "true");
  ensurePomodoroTickTrigger_();
  return getPomodoroConfigMessage_();
}

function pomodoroStop_() {
  cfgSet_(PROP.POMO_ENABLED, "false");
  deleteTriggersByHandler_("pomodoroTick_");
  // Limpiar datos del Pomodoro cuando se desactiva
  cfgDel_(PROP.POMO_PHASE);
  cfgDel_(PROP.POMO_CYCLE);
  cfgDel_(PROP.POMO_END_MS);
}

/**
 * Genera el mensaje descriptivo del ciclo de pomodoro según configuración.
 */
function getPomodoroConfigMessage_() {
  const days = DEFAULTS.POMO_ALLOWED_DAYS;
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  let daysText = "";
  if (days.length === 7) {
    daysText = "todos los días";
  } else if (days.length === 5 && days.includes(1) && days.includes(5)) {
    daysText = "Lun–Vie";
  } else if (days.length === 2 && days.includes(0) && days.includes(6)) {
    daysText = "fines de semana";
  } else {
    daysText = days.map((d) => dayNames[d]).join(", ");
  }

  const startH = String(DEFAULTS.POMO_START_H).padStart(2, "0");
  const endH = String(DEFAULTS.POMO_END_H).padStart(2, "0");

  return `🍅 Pomodoro ON.\nCiclo: ${DEFAULTS.POMO_WORK_MIN}/${DEFAULTS.POMO_SHORT_BREAK_MIN} x${DEFAULTS.POMO_SET_SIZE} + ${DEFAULTS.POMO_LONG_BREAK_MIN} min.\nActivo: ${daysText} ${startH}:00–${endH}:00.`;
}

/**
 * Genera descripción corta del ciclo para /help.
 */
function getPomodoroShortDesc_() {
  const days = DEFAULTS.POMO_ALLOWED_DAYS;
  let daysText = "";
  if (days.length === 7) {
    daysText = "todos los días";
  } else if (days.length === 5 && days.includes(1) && days.includes(5)) {
    daysText = "Lun–Vie";
  } else if (days.length === 2 && days.includes(0) && days.includes(6)) {
    daysText = "fin de semana";
  } else {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    daysText = days.map((d) => dayNames[d]).join(", ");
  }

  return `${DEFAULTS.POMO_WORK_MIN}/${DEFAULTS.POMO_SHORT_BREAK_MIN} x${
    DEFAULTS.POMO_SET_SIZE
  } + ${DEFAULTS.POMO_LONG_BREAK_MIN} (${daysText} ${String(
    DEFAULTS.POMO_START_H
  ).padStart(2, "0")}–${String(DEFAULTS.POMO_END_H).padStart(2, "0")})`;
}

function pomodoroStatus_() {
  const enabled = cfgGet_(PROP.POMO_ENABLED, "false") === "true";
  if (!enabled) return "🛑 Pomodoro: OFF. Usa /pomodoro start.";

  // Leer estado directamente de Properties
  const phase = cfgGet_(PROP.POMO_PHASE, "");
  const cycle = toInt_(cfgGet_(PROP.POMO_CYCLE, "1")) || 1;
  const endMs = toInt_(cfgGet_(PROP.POMO_END_MS, "0")) || 0;

  // Si está ON pero sin phase/end_ms (no ha iniciado aún), mostrar estado inicial
  if (!phase || !endMs || endMs === 0 || Date.now() >= endMs) {
    return "🍅 Pomodoro: ON, LISTO para iniciar.\nProxima fase: Trabajo " + cycle + "/" + DEFAULTS.POMO_SET_SIZE + " (" + DEFAULTS.POMO_WORK_MIN + " min).\nUsa /pomodoro start nuevamente para comenzar.";
  }

  // Mostrar estado actual en tiempo real
  let phaseEmoji = "";
  let phaseName = "";
  if (phase === "work") {
    phaseEmoji = "🍅";
    phaseName = "Trabajo";
  } else if (phase === "short_break") {
    phaseEmoji = "☕";
    phaseName = "Descanso corto";
  } else {
    phaseEmoji = "🧘";
    phaseName = "Descanso largo";
  }

  const mins = Math.max(0, Math.ceil((endMs - Date.now()) / 60000));
  return phaseEmoji + " Pomodoro: ON\n" + phaseName + " " + cycle + "/" + DEFAULTS.POMO_SET_SIZE + "\n⏱️ " + mins + " min restantes";
}

function ensurePomodoroTickTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(
    (t) => t.getHandlerFunction && t.getHandlerFunction() === "pomodoroTick_"
  );
  if (!exists)
    ScriptApp.newTrigger("pomodoroTick_").timeBased().everyMinutes(1).create();
}

function pomodoroTick_() {
  // GUARD: Si no está habilitado, no hacer nada
  if (cfgGet_(PROP.POMO_ENABLED, "false") !== "true") return;

  const chatId = getChatId_();
  if (!chatId) return;

  const now = new Date();

  // Verificar si es un día permitido
  if (!isAllowedPomodoroDay_(now)) return;

  // Verificar ventana horaria
  if (!withinWindow_(now, DEFAULTS.POMO_START_H, 0, DEFAULTS.POMO_END_H, 0))
    return;

  // Resetear contador si es un nuevo día
  resetPomodoroIfNewDay_(now);

  // Leer estado actual
  let phase = cfgGet_(PROP.POMO_PHASE, "");
  let cycle = toInt_(cfgGet_(PROP.POMO_CYCLE, "0")) || 1;
  let endMs = toInt_(cfgGet_(PROP.POMO_END_MS, "0")) || 0;

  // Si no hay fase registrada, inicializar
  if (!phase) {
    phase = "work";
    cfgSet_(PROP.POMO_PHASE, phase);
    cfgSet_(PROP.POMO_CYCLE, "1");
    cycle = 1;
  }

  cycle = clamp_(cycle, 1, DEFAULTS.POMO_SET_SIZE);

  // Si aún no hay end_ms, calcular y guardar
  if (!endMs) {
    const nowMs = Date.now();
    const durMin =
      phase === "work"
        ? DEFAULTS.POMO_WORK_MIN
        : phase === "short_break"
        ? DEFAULTS.POMO_SHORT_BREAK_MIN
        : DEFAULTS.POMO_LONG_BREAK_MIN;
    endMs = nowMs + durMin * 60 * 1000;
    cfgSet_(PROP.POMO_END_MS, String(endMs));
    
    notifyPomodoroPhase_(chatId, phase, cycle);
    logPomodoro_("start", phase, cycle, { at: isoDateTime_(now) });
    return;
  }

  // Si el tiempo no ha vencido aún, esperar
  if (Date.now() < endMs) return;

  // El tiempo venció, transicionar a siguiente fase
  logPomodoro_("end", phase, cycle, { at: isoDateTime_(now) });

  // Calcular siguiente fase
  let nextPhase = phase;
  let nextCycle = cycle;
  
  if (phase === "work") {
    if (cycle >= DEFAULTS.POMO_SET_SIZE) {
      nextPhase = "long_break";
    } else {
      nextPhase = "short_break";
    }
  } else if (phase === "short_break") {
    nextPhase = "work";
    nextCycle = Math.min(DEFAULTS.POMO_SET_SIZE, cycle + 1);
  } else {
    // long_break
    nextPhase = "work";
    nextCycle = 1;
  }

  // Guardar siguiente estado
  cfgSet_(PROP.POMO_PHASE, nextPhase);
  cfgSet_(PROP.POMO_CYCLE, String(nextCycle));
  
  // Calcular nuevo end_ms
  const nowMs = Date.now();
  const durMin =
    nextPhase === "work"
      ? DEFAULTS.POMO_WORK_MIN
      : nextPhase === "short_break"
      ? DEFAULTS.POMO_SHORT_BREAK_MIN
      : DEFAULTS.POMO_LONG_BREAK_MIN;
  cfgSet_(PROP.POMO_END_MS, String(nowMs + durMin * 60 * 1000));

  notifyPomodoroPhase_(chatId, nextPhase, nextCycle);
  logPomodoro_("start", nextPhase, nextCycle, { at: isoDateTime_(now) });
}

function notifyPomodoroPhase_(chatId, phase, cycle) {
  if (phase === "work") {
    tgSend_(
      chatId,
      `🍅 Trabajo ${cycle}/${DEFAULTS.POMO_SET_SIZE} — ${DEFAULTS.POMO_WORK_MIN} min.\n1 objetivo claro. Cierra distractores.`
    );
  } else if (phase === "short_break") {
    tgSend_(
      chatId,
      `☕ Descanso corto — ${DEFAULTS.POMO_SHORT_BREAK_MIN} min.\nAgua + ponte de pie 30s.`
    );
  } else {
    tgSend_(
      chatId,
      `🧘 Descanso largo — ${DEFAULTS.POMO_LONG_BREAK_MIN} min.\nReset suave. Vuelve liviano.`
    );
  }
}

/**
 * Verifica si el día actual está en la lista de días permitidos.
 * Se usa getDay() que retorna: 0=Domingo, 1=Lunes, ..., 6=Sábado
 */
function isAllowedPomodoroDay_(date) {
  const dayOfWeek = date.getDay();
  return DEFAULTS.POMO_ALLOWED_DAYS.includes(dayOfWeek);
}

/**
 * Resetea el contador de pomodoros si detecta que cambió el día.
 * Compara la fecha actual (YYYY-MM-DD) con POMO_LAST_DATE.
 */
function resetPomodoroIfNewDay_(now) {
  const today = isoDate_(now);
  const lastDate = cfgGet_(PROP.POMO_LAST_DATE, "");

  if (lastDate && lastDate !== today) {
    // Nuevo día detectado, reiniciar estado
    cfgSet_(PROP.POMO_PHASE, "work");
    cfgSet_(PROP.POMO_CYCLE, "1");
    cfgSet_(PROP.POMO_END_MS, "0");
    cfgSet_(PROP.POMO_LAST_DATE, today);
  } else if (!lastDate) {
    // Primera vez, guardar fecha actual
    cfgSet_(PROP.POMO_LAST_DATE, today);
  }
}
