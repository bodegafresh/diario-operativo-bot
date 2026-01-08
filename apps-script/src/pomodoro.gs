/**
 * pomodoro.gs
 * Pomodoro 25/5 x4 + 15. Solo Lun–Vie 09:00–18:00 Chile.
 */

function pomodoroStart_() {
  cfgSet_(PROP.POMO_ENABLED, "true");
  if (!cfgGet_(PROP.POMO_PHASE, "")) initPomodoroState_();
  ensurePomodoroTickTrigger_();
}

function pomodoroStop_() {
  cfgSet_(PROP.POMO_ENABLED, "false");
  deleteTriggersByHandler_("pomodoroTick_");
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

  // Solo ventana laboral + weekdays
  if (!isWeekdayChile_(now)) return;
  if (!withinWindow_(now, DEFAULTS.POMO_START_H, 0, DEFAULTS.POMO_END_H, 0))
    return;

  let phase = cfgGet_(PROP.POMO_PHASE, "");
  if (!phase) initPomodoroState_();

  let cycle = toInt_(cfgGet_(PROP.POMO_CYCLE, "1")) || 1;
  cycle = clamp_(cycle, 1, DEFAULTS.POMO_SET_SIZE);

  const endMs = Number(cfgGet_(PROP.POMO_END_MS, "0"));

  // Si no hay endMs, iniciamos fase actual (y notificamos una vez)
  if (!endMs) {
    setPhaseEndFromNow_(phase);
    notifyPomodoroPhase_(chatId, phase, cycle);
    logPomodoro_("start", phase, cycle, { at: isoDateTime_(now) });
    return;
  }

  if (Date.now() < endMs) return;

  // Termina fase
  logPomodoro_("end", phase, cycle, { at: isoDateTime_(now) });

  // Avanza
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
  return { phase: "work", cycle: 1 }; // long_break -> reinicia set
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
