/**
 * progress.gs
 * Persistencia de progreso por chat_id (Sheet "Progress") y log de intentos (Sheet "Attempts").
 */

function progressSheet_() {
  return getOrCreateSheet_(SHEETS.PROGRESS);
}

function attemptsSheet_() {
  return getOrCreateSheet_(SHEETS.ATTEMPTS);
}

/** Devuelve {row: int (1-based) | null, data: object | null}. */
function findProgressRow_(chatId) {
  const sh = progressSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { row: null, data: null };

  const values = sh.getRange(2, 1, last - 1, 8).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(chatId)) {
      return {
        row: i + 2,
        data: {
          chat_id: String(values[i][0]),
          username: String(values[i][1] || ""),
          current_lesson_id: toInt_(values[i][2]),
          total_correct: toInt_(values[i][3]) || 0,
          total_attempts: toInt_(values[i][4]) || 0,
          started_at: String(values[i][5] || ""),
          updated_at: String(values[i][6] || ""),
          completed_at: String(values[i][7] || ""),
        },
      };
    }
  }
  return { row: null, data: null };
}

/**
 * Devuelve la fila de progreso del chatId. Si no existe, la crea apuntando
 * a la primera pregunta activa.
 */
function getOrCreateProgress_(chatId, username) {
  const found = findProgressRow_(chatId);
  if (found.row) {
    // Actualiza username si llegó uno mejor
    if (username && username !== found.data.username) {
      progressSheet_().getRange(found.row, 2).setValue(username);
      found.data.username = username;
    }
    return found.data;
  }

  const first = getFirstQuestion_();
  const startId = first ? first.id : 1;
  const ts = nowIso_();

  progressSheet_().appendRow([
    chatId,
    username || "",
    startId,
    0,
    0,
    ts,
    ts,
    "",
  ]);

  return {
    chat_id: String(chatId),
    username: username || "",
    current_lesson_id: startId,
    total_correct: 0,
    total_attempts: 0,
    started_at: ts,
    updated_at: ts,
    completed_at: "",
  };
}

function incrementAttempts_(chatId) {
  const found = findProgressRow_(chatId);
  if (!found.row) return;
  const sh = progressSheet_();
  sh.getRange(found.row, 5).setValue((found.data.total_attempts || 0) + 1);
  sh.getRange(found.row, 7).setValue(nowIso_());
}

function advanceProgress_(chatId, nextLessonId) {
  const found = findProgressRow_(chatId);
  if (!found.row) return;
  const sh = progressSheet_();
  const ts = nowIso_();

  sh.getRange(found.row, 4).setValue((found.data.total_correct || 0) + 1);
  sh.getRange(found.row, 5).setValue((found.data.total_attempts || 0) + 1);
  sh.getRange(found.row, 7).setValue(ts);

  if (nextLessonId == null) {
    sh.getRange(found.row, 8).setValue(ts); // completed_at
  } else {
    sh.getRange(found.row, 3).setValue(nextLessonId);
  }
}

function resetProgress_(chatId) {
  const found = findProgressRow_(chatId);
  const first = getFirstQuestion_();
  const startId = first ? first.id : 1;
  const ts = nowIso_();

  if (!found.row) {
    progressSheet_().appendRow([chatId, "", startId, 0, 0, ts, ts, ""]);
    return;
  }

  const sh = progressSheet_();
  sh.getRange(found.row, 3, 1, 6).setValues([
    [startId, 0, 0, ts, ts, ""],
  ]);
}

/** Cuenta cuántas veces este chat ha respondido esta lección (para attempt_number). */
function countAttemptsForLesson_(chatId, lessonId) {
  const sh = attemptsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const values = sh.getRange(2, 2, last - 1, 3).getValues(); // chat_id, username, lesson_id
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0]) === String(chatId) &&
      toInt_(values[i][2]) === lessonId
    ) {
      count++;
    }
  }
  return count;
}

function logAttempt_(chatId, username, lessonId, answer, isCorrect) {
  const attemptNumber = countAttemptsForLesson_(chatId, lessonId) + 1;
  attemptsSheet_().appendRow([
    nowIso_(),
    chatId,
    username || "",
    lessonId,
    answer,
    isCorrect ? "TRUE" : "FALSE",
    attemptNumber,
  ]);
  return attemptNumber;
}

function progressSummaryText_(chatId) {
  const found = findProgressRow_(chatId);
  if (!found.row) {
    return "Aún no has empezado. Envía /start para comenzar.";
  }
  const total = countActiveQuestions_();
  const cur = found.data.current_lesson_id || 0;

  if (found.data.completed_at) {
    return [
      "🏁 ¡Curso completado!",
      `Correctas: ${found.data.total_correct}`,
      `Intentos totales: ${found.data.total_attempts}`,
      `Terminado: ${found.data.completed_at}`,
    ].join("\n");
  }

  return [
    "📊 Tu progreso",
    `Lección actual: ${cur} (de ${total})`,
    `Correctas: ${found.data.total_correct}`,
    `Intentos totales: ${found.data.total_attempts}`,
  ].join("\n");
}
