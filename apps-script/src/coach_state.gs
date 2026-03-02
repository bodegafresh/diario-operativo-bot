/**
 * coach_state.gs
 * Getters/setters for Coach v3 state (moved from properties to Sheets "CoachState")
 */

/* ── Headers canónicos de CoachState ── */
const COACH_STATE_HEADERS = [
  "timestamp",
  "date",
  "week_index",
  "day90",
  "day21",
  "cycle21",
  "train_day14",
  "impulse_count",
  "last_am",
  "last_pm",
  "last_rem_1",
  "last_rem_2",
  "last_rem_3",
  "last_rem_4",
  "ritual_daily_date",
  "ritual_daily_affirmations",
];

/* Campos que deben leerse/escribirse como enteros */
const COACH_STATE_NUMERIC_FIELDS = new Set([
  "week_index",
  "day90",
  "day21",
  "cycle21",
  "train_day14",
  "impulse_count",
]);

/* Campos que se ignoran al construir el objeto de estado */
const COACH_STATE_SKIP_FIELDS = new Set(["timestamp", "date"]);

/**
 * Obtiene la hoja CoachState, creándola con headers si no existe.
 * Si la hoja existe pero le faltan headers (fila 1 vacía), los inserta.
 */
function getCoachStateSheet_() {
  const sh = getOrCreateSheet_(SHEETS.COACH_STATE, COACH_STATE_HEADERS);

  // Reparación: si la hoja existe pero la fila 1 no tiene headers válidos
  const firstCell = sh.getRange(1, 1).getValue();
  if (
    sh.getLastRow() === 0 ||
    String(firstCell).toLowerCase() !== "timestamp"
  ) {
    // Insertar headers en fila 1 (desplaza datos existentes hacia abajo)
    if (sh.getLastRow() > 0) {
      sh.insertRowBefore(1);
    }
    sh.getRange(1, 1, 1, COACH_STATE_HEADERS.length).setValues([
      COACH_STATE_HEADERS,
    ]);
  }
  return sh;
}

/**
 * Migra estado de Coach desde propiedades antiguas a Sheets si es necesario
 * Se ejecuta automáticamente la primera vez que se accede a getCoachState_()
 */
function migrateCoachStateIfNeeded_() {
  const sh = getCoachStateSheet_();
  const data = sh.getDataRange().getValues();

  // Si ya hay datos en CoachState (más de solo headers), no migrar
  if (data.length > 1) {
    return;
  }

  // Intentar leer desde propiedades antiguas
  const props = PropertiesService.getScriptProperties();
  const oldWeekIndex = props.getProperty("COACH_WEEK_INDEX_V3");
  const oldDay90 = props.getProperty("COACH_DAY90_V3");
  const oldDay21 = props.getProperty("COACH_DAY21_V3");
  const oldCycle21 = props.getProperty("COACH_CYCLE21_V3");
  const oldTrainDay14 = props.getProperty("COACH_TRAIN_DAY14_V3");
  const oldImpulseCount = props.getProperty("COACH_IMPULSE_COUNT_V3");
  const oldLastAM = props.getProperty("COACH_LAST_AM_V3");
  const oldLastPM = props.getProperty("COACH_LAST_PM_V3");
  const oldLastRem1 = props.getProperty("COACH_LAST_REM_1_V3");
  const oldLastRem2 = props.getProperty("COACH_LAST_REM_2_V3");
  const oldLastRem3 = props.getProperty("COACH_LAST_REM_3_V3");
  const oldLastRem4 = props.getProperty("COACH_LAST_REM_4_V3");
  const oldRitualDate = props.getProperty("COACH_RITUAL_DAILY_DATE_V3");
  const oldRitualAffirmations = props.getProperty(
    "COACH_RITUAL_DAILY_AFFIRMATIONS_V3",
  );

  // Si hay al menos UNO de los valores antiguos, hace la migración
  if (oldWeekIndex || oldDay90 || oldDay21 || oldCycle21 || oldTrainDay14) {
    const row = [
      new Date(), // timestamp
      isoDate_(new Date()), // date
      oldWeekIndex || 1, // week_index
      oldDay90 || 1, // day90
      oldDay21 || 1, // day21
      oldCycle21 || 1, // cycle21
      oldTrainDay14 || 1, // train_day14
      oldImpulseCount || 0, // impulse_count
      oldLastAM || "", // last_am
      oldLastPM || "", // last_pm
      oldLastRem1 || "", // last_rem_1
      oldLastRem2 || "", // last_rem_2
      oldLastRem3 || "", // last_rem_3
      oldLastRem4 || "", // last_rem_4
      oldRitualDate || "", // ritual_daily_date
      oldRitualAffirmations || "", // ritual_daily_affirmations
    ];
    sh.appendRow(row);
  }
}

/**
 * Carga el estado actual del Coach desde Sheets CoachState
 * Retorna objeto con: week_index, day90, day21, cycle21, train_day14, impulse_count,
 * last_am, last_pm, last_rem_1-4, ritual_daily_date, ritual_daily_affirmations
 * Si no existe, retorna objeto vacío.
 */
function getCoachState_() {
  // Migrar si es necesario
  migrateCoachStateIfNeeded_();

  const sh = getCoachStateSheet_();
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
    const header = String(headers[i]).toLowerCase().trim();
    const value = lastRow[i];

    if (COACH_STATE_SKIP_FIELDS.has(header)) continue;

    // Convierte a los tipos apropiados usando el set explícito
    if (COACH_STATE_NUMERIC_FIELDS.has(header)) {
      state[header] = value !== "" && value != null ? parseInt(value, 10) : 0;
      if (isNaN(state[header])) state[header] = 0;
    } else {
      state[header] = value !== "" && value != null ? String(value) : "";
    }
  }

  return state;
}

/**
 * Actualiza o crea una nueva fila de estado Coach en Sheets
 * @param {Object} updates - Propiedades a actualizar (ej: { week_index: 5, day21: 10 })
 */
function updateCoachState_(updates) {
  const sh = getCoachStateSheet_();
  const data = sh.getDataRange().getValues();
  const headers = data[0];

  // Obtén estado actual
  const current = getCoachState_();

  // Merge con updates
  const newState = Object.assign({}, current, updates);

  // Construye la fila
  const row = [];
  for (let header of headers) {
    const key = String(header).toLowerCase().trim();

    if (key === "timestamp") {
      row.push(new Date());
    } else if (key === "date") {
      row.push(isoDate_(new Date()));
    } else {
      // Usar check null-safe: 0 es un valor válido, no reemplazar con ""
      const v = newState[key];
      row.push(v !== undefined && v !== null ? v : "");
    }
  }

  sh.appendRow(row);

  // Dual-write a Supabase (ignore on conflict por recorded_at)
  try {
    const ts = new Date();
    const dt = isoDate_(ts);
    sbUpsert_(
      "coach_state",
      [
        {
          recorded_at:                ts.toISOString(),
          date:                       dt,
          week_index:                 newState.week_index !== undefined ? newState.week_index : null,
          day90:                      newState.day90 !== undefined ? newState.day90 : null,
          day21:                      newState.day21 !== undefined ? newState.day21 : null,
          cycle21:                    newState.cycle21 !== undefined ? newState.cycle21 : null,
          train_day14:                newState.train_day14 !== undefined ? newState.train_day14 : null,
          impulse_count:              newState.impulse_count || 0,
          last_am:                    newState.last_am || null,
          last_pm:                    newState.last_pm || null,
          last_rem_1:                 newState.last_rem_1 || null,
          last_rem_2:                 newState.last_rem_2 || null,
          last_rem_3:                 newState.last_rem_3 || null,
          last_rem_4:                 newState.last_rem_4 || null,
          ritual_daily_date:          newState.ritual_daily_date || null,
          ritual_daily_affirmations:  newState.ritual_daily_affirmations
            ? (typeof newState.ritual_daily_affirmations === "string"
                ? JSON.parse(newState.ritual_daily_affirmations)
                : newState.ritual_daily_affirmations)
            : [],
        },
      ],
      "recorded_at",
      true,
    ); // ignore on conflict — log append-only
  } catch (e) {
    Logger.log("[SB coach_state] " + e.message);
  }
}

/**
 * Getter/setter convenientes para propiedades específicas del Coach
 */

function getCoachWeekIndex_() {
  return getCoachState_().week_index || 1;
}

function setCoachWeekIndex_(value) {
  updateCoachState_({ week_index: parseInt(value, 10) });
}

function getCoachDay90_() {
  return getCoachState_().day90 || 0;
}

function setCoachDay90_(value) {
  updateCoachState_({ day90: parseInt(value, 10) });
}

function getCoachDay21_() {
  return getCoachState_().day21 || 1;
}

function setCoachDay21_(value) {
  updateCoachState_({ day21: parseInt(value, 10) });
}

function getCoachCycle21_() {
  return getCoachState_().cycle21 || 1;
}

function setCoachCycle21_(value) {
  updateCoachState_({ cycle21: parseInt(value, 10) });
}

function getCoachTrainDay14_() {
  return getCoachState_().train_day14 || 1;
}

function setCoachTrainDay14_(value) {
  updateCoachState_({ train_day14: parseInt(value, 10) });
}

function getCoachImpulseCount_() {
  return getCoachState_().impulse_count || 0;
}

function setCoachImpulseCount_(value) {
  updateCoachState_({ impulse_count: parseInt(value, 10) });
}

function getCoachLastAM_() {
  return getCoachState_().last_am || "";
}

function setCoachLastAM_(value) {
  updateCoachState_({ last_am: String(value) });
}

function getCoachLastPM_() {
  return getCoachState_().last_pm || "";
}

function setCoachLastPM_(value) {
  updateCoachState_({ last_pm: String(value) });
}

function getCoachLastReminder_(num) {
  const key = `last_rem_${num}`;
  return getCoachState_()[key] || "";
}

function setCoachLastReminder_(num, value) {
  const key = `last_rem_${num}`;
  updateCoachState_({ [key]: String(value) });
}

function getCoachRitualDailyDate_() {
  return getCoachState_().ritual_daily_date || "";
}

function setCoachRitualDailyDate_(value) {
  updateCoachState_({ ritual_daily_date: String(value) });
}

function getCoachRitualDailyAffirmations_() {
  return getCoachState_().ritual_daily_affirmations || "";
}

function setCoachRitualDailyAffirmations_(value) {
  updateCoachState_({ ritual_daily_affirmations: String(value) });
}
