/**
 * pomodoro.gs
 * Pomodoro 25/5 x4 + 15. Solo Lun–Vie 09:00–18:00 Chile.
 */

function pomodoroStart_() {
  cfgSet_(PROP.POMO_ENABLED, "true");
  if (!cfgGet_(PROP.POMO_PHASE, "")) initPomodoroState_();
  ensurePomodoroTickTrigger_();
  return getPomodoroConfigMessage_();
}

function pomodoroStop_() {
  cfgSet_(PROP.POMO_ENABLED, "false");
  deleteTriggersByHandler_("pomodoroTick_");
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

function pomodoroStatus_() {
  const enabled = cfgGet_(PROP.POMO_ENABLED, "false") === "true";
  if (!enabled) return "Pomodoro: OFF. Usa /pomodoro start.";

  const phase = cfgGet_(PROP.POMO_PHASE, "work");
  const cycle = cfgGet_(PROP.POMO_CYCLE, "1");
  const endMs = Number(cfgGet_(PROP.POMO_END_MS, "0"));

  let eta = "";
  if (endMs > 0) {
    const mins = Math.max(0, Math.ceil((endMs - Date.now()) / 60000));
    eta = ` (~${mins} min)`;
  }
  return `Pomodoro: ON | phase=${phase} | ciclo=${cycle}/${DEFAULTS.POMO_SET_SIZE}${eta}`;
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

  let phase = cfgGet_(PROP.POMO_PHASE, "");
  if (!phase) initPomodoroState_();

  let cycle = toInt_(cfgGet_(PROP.POMO_CYCLE, "1")) || 1;
  cycle = clamp_(cycle, 1, DEFAULTS.POMO_SET_SIZE);

  const endMs = Number(cfgGet_(PROP.POMO_END_MS, "0"));

  if (!endMs) {
    setPhaseEndFromNow_(phase);
    notifyPomodoroPhase_(chatId, phase, cycle);
    logPomodoro_("start", phase, cycle, { at: isoDateTime_(now) });
    return;
  }

  if (Date.now() < endMs) return;

  logPomodoro_("end", phase, cycle, { at: isoDateTime_(now) });

  const next = nextPomodoroPhase_(phase, cycle);
  phase = next.phase;
  cycle = next.cycle;

  cfgSet_(PROP.POMO_PHASE, phase);
  cfgSet_(PROP.POMO_CYCLE, String(cycle));
  setPhaseEndFromNow_(phase);

  notifyPomodoroPhase_(chatId, phase, cycle);
  logPomodoro_("start", phase, cycle, { at: isoDateTime_(now) });
}

function initPomodoroState_() {
  cfgSet_(PROP.POMO_PHASE, "work");
  cfgSet_(PROP.POMO_CYCLE, "1");
  cfgDel_(PROP.POMO_END_MS);
}

function nextPomodoroPhase_(phase, cycle) {
  if (phase === "work") {
    if (cycle >= DEFAULTS.POMO_SET_SIZE)
      return { phase: "long_break", cycle: cycle };
    return { phase: "short_break", cycle: cycle };
  }
  if (phase === "short_break")
    return {
      phase: "work",
      cycle: Math.min(DEFAULTS.POMO_SET_SIZE, cycle + 1),
    };
  return { phase: "work", cycle: 1 };
}

function setPhaseEndFromNow_(phase) {
  const nowMs = Date.now();
  const durMin =
    phase === "work"
      ? DEFAULTS.POMO_WORK_MIN
      : phase === "short_break"
      ? DEFAULTS.POMO_SHORT_BREAK_MIN
      : DEFAULTS.POMO_LONG_BREAK_MIN;

  cfgSet_(PROP.POMO_END_MS, String(nowMs + durMin * 60 * 1000));
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
    initPomodoroState_();
    cfgSet_(PROP.POMO_LAST_DATE, today);
  } else if (!lastDate) {
    // Primera vez, guardar fecha actual
    cfgSet_(PROP.POMO_LAST_DATE, today);
  }
}
