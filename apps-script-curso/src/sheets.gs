/**
 * sheets.gs
 * Helpers de Google Sheets (estructura del curso).
 */

function ss_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getOrCreateSheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.appendRow(headers);
  }
  return sh;
}

function ensureCoreSheets_() {
  getOrCreateSheet_(SHEETS.QUESTIONS, [
    "id",
    "modulo",
    "pregunta",
    "A",
    "B",
    "C",
    "D",
    "correcta",
    "video_file_id",
    "explicacion",
    "activa",
  ]);

  getOrCreateSheet_(SHEETS.PROGRESS, [
    "chat_id",
    "username",
    "current_lesson_id",
    "total_correct",
    "total_attempts",
    "started_at",
    "updated_at",
    "completed_at",
  ]);

  getOrCreateSheet_(SHEETS.ATTEMPTS, [
    "timestamp",
    "chat_id",
    "username",
    "lesson_id",
    "answer",
    "is_correct",
    "attempt_number",
  ]);
}

/** Lee todas las filas de Questions activas, ordenadas por id ascendente. */
function readActiveQuestions_() {
  const sh = getOrCreateSheet_(SHEETS.QUESTIONS);
  const last = sh.getLastRow();
  if (last < 2) return [];

  const values = sh.getRange(2, 1, last - 1, 11).getValues();
  const rows = values
    .map((r) => ({
      id: toInt_(r[0]),
      modulo: String(r[1] || ""),
      pregunta: String(r[2] || ""),
      A: String(r[3] || ""),
      B: String(r[4] || ""),
      C: String(r[5] || ""),
      D: String(r[6] || ""),
      correcta: String(r[7] || "")
        .trim()
        .toUpperCase(),
      video_file_id: String(r[8] || "").trim(),
      explicacion: String(r[9] || ""),
      activa: String(r[10]).toLowerCase() !== "false" && r[10] !== false,
    }))
    .filter((q) => q.id != null && q.activa);

  rows.sort((a, b) => a.id - b.id);
  return rows;
}

function getQuestionById_(id) {
  const all = readActiveQuestions_();
  for (let i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

/** Devuelve la siguiente pregunta activa con id > afterId (o null si no hay más). */
function getNextQuestionAfter_(afterId) {
  const all = readActiveQuestions_();
  for (let i = 0; i < all.length; i++) {
    if (all[i].id > afterId) return all[i];
  }
  return null;
}

/** Devuelve la primera pregunta activa (la de menor id). */
function getFirstQuestion_() {
  const all = readActiveQuestions_();
  return all.length ? all[0] : null;
}

function countActiveQuestions_() {
  return readActiveQuestions_().length;
}
