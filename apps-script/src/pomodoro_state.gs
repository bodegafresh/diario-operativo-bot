/**
 * pomodoro_state.gs
 * Getters/setters for Pomodoro state (moved from properties to Sheets "PomodoroState")
 */

/**
 * Limpia completamente el estado del Pomodoro (llamado por /pomodoro stop y /pomodoro start)
 * Borra todas las filas de datos, mantiene solo headers
 */
function clearPomodoroState_() {
  const sh = getOrCreateSheet_(SHEETS.POMO_STATE, null);
  const data = sh.getDataRange().getValues();
  
  // Si hay más de solo headers, borra todos los datos
  if (data.length > 1) {
    sh.deleteRows(2, data.length - 1);
  }
}

/**
 * Detecta y limpia estados de Pomodoro "pegados" (end_ms ya pasó hace >1 hora sin transicionar)
 * Ocurre cuando hay datos históricos en la Sheets pero las properties fueron borradas
 */
function cleanupStuckPomodoroState_() {
  const sh = getOrCreateSheet_(SHEETS.POMO_STATE, null);
  const data = sh.getDataRange().getValues();
  
  if (data.length <= 1) return; // No hay datos
  
  const headers = data[0];
  const lastRow = data[data.length - 1];
  
  let endMs = 0;
  let timestamp = null;
  
  // Busca end_ms y timestamp en los headers
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase();
    if (header === "end_ms") endMs = parseInt(lastRow[i], 10) || 0;
    if (header === "timestamp") timestamp = lastRow[i];
  }
  
  // Si end_ms está en el pasado hace más de 1 hora, el estado está pegado/corrupto
  if (endMs > 0 && Date.now() > endMs + 3600000) { // endMs + 1 hora
    // Borra todos los datos de la Sheets y reinicia
    if (data.length > 1) {
      sh.deleteRows(2, data.length - 1); // Mantén solo headers
    }
  }
}

/**
 * Carga el estado actual del Pomodoro desde Sheets PomodoroState
 * Retorna objeto con: phase, cycle, end_ms, last_date
 * Si no existe, retorna objeto vacío.
 * Detecta y limpia estados "pegados" (corrupto por data histórica)
 */
function getPomodoroState_() {
  // Primero limpia estados pegados
  cleanupStuckPomodoroState_();
  
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
