/**
 * pomodoro_state.gs
 * Getters/setters for Pomodoro state (moved from properties to Sheets "PomodoroState")
 */

/**
 * Carga el estado actual del Pomodoro desde Sheets PomodoroState
 * Retorna objeto con: phase, cycle, end_ms, last_date
 * Si no existe, retorna objeto vacío.
 */
function getPomodoroState_() {
  const sh = getOrCreateSheet_(SHEETS.POMO_STATE, null);
  const data = sh.getDataRange().getValues();
  
  if (data.length <= 1) {
    // Solo encabezados, no hay datos
    return {};
  }

  // Toma la última fila (estado más reciente)
  const headers = data[0];
  const lastRow = data[data.length - 1];
  
  const state = {};
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase();
    const value = lastRow[i];
    
    // Convierte a los tipos apropiados
    if (header === "end_ms") {
      state[header] = value ? parseInt(value, 10) : 0;
    } else if (header === "timestamp" || header === "date") {
      // Skip timestamp y date
    } else {
      state[header] = value || "";
    }
  }
  
  return state;
}

/**
 * Actualiza o crea una nueva fila de estado Pomodoro en Sheets
 * @param {Object} updates - Propiedades a actualizar (ej: { phase: "work", cycle: 1 })
 */
function updatePomodoroState_(updates) {
  const sh = getOrCreateSheet_(SHEETS.POMO_STATE, null);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  
  // Obtén estado actual
  const current = getPomodoroState_();
  
  // Merge con updates
  const newState = Object.assign({}, current, updates);
  
  // Construye la fila
  const row = [];
  for (let header of headers) {
    const key = String(header).toLowerCase();
    
    if (key === "timestamp") {
      row.push(new Date());
    } else if (key === "date") {
      row.push(isoDate_(new Date()));
    } else {
      row.push(newState[key] || "");
    }
  }
  
  sh.appendRow(row);
}

/**
 * Getter/setter convenientes para propiedades específicas del Pomodoro
 */

function getPomodoroPhase_() {
  return getPomodoroState_().phase || "idle";
}

function setPomodoroPhase_(value) {
  updatePomodoroState_({ phase: String(value) });
}

function getPomodoroCycle_() {
  return getPomodoroState_().cycle || 0;
}

function setPomodoroCycle_(value) {
  updatePomodoroState_({ cycle: parseInt(value, 10) });
}

function getPomodoroEndMs_() {
  return getPomodoroState_().end_ms || 0;
}

function setPomodoroEndMs_(value) {
  updatePomodoroState_({ end_ms: parseInt(value, 10) });
}

function getPomodoroLastDate_() {
  return getPomodoroState_().last_date || "";
}

function setPomodoroLastDate_(value) {
  updatePomodoroState_({ last_date: String(value) });
}
