/**
 * course.gs
 * Lógica del curso:
 *  - Bienvenida y envío de pregunta actual.
 *  - Procesamiento de respuesta (correcta → video + siguiente; incorrecta → reintenta).
 */

function courseStart_(chatId, username, replyToMessageId) {
  const progress = getOrCreateProgress_(chatId, username);
  const total = countActiveQuestions_();

  if (total === 0) {
    tgSend_(
      chatId,
      "⚠️ No hay preguntas configuradas todavía. Pide al admin que llene la hoja Questions.",
      replyToMessageId
    );
    return;
  }

  const welcome = [
    "👋 ¡Bienvenido al curso!",
    "",
    `Vas en la lección ${progress.current_lesson_id} de ${total}.`,
    "Responde tocando la alternativa correcta. Si aciertas, te envío un video.",
    "Si fallas, vuelves a intentarlo con la misma pregunta.",
    "",
    "Usa /progreso para ver tu avance, /reset para reiniciar.",
  ].join("\n");

  tgSend_(chatId, welcome, replyToMessageId);
  sendQuestionToUser_(chatId, progress.current_lesson_id);
}

function courseSendCurrent_(chatId, username, replyToMessageId) {
  const progress = getOrCreateProgress_(chatId, username);

  if (progress.completed_at) {
    tgSend_(
      chatId,
      "🏁 Ya completaste el curso. Usa /reset si quieres volver a empezar.",
      replyToMessageId
    );
    return;
  }

  sendQuestionToUser_(chatId, progress.current_lesson_id);
}

function sendQuestionToUser_(chatId, lessonId) {
  const q = getQuestionById_(lessonId);
  if (!q) {
    tgSend_(
      chatId,
      "⚠️ No encontré la pregunta " +
        lessonId +
        ". Revisa el Sheet o usa /reset."
    );
    return;
  }

  const lines = [`📘 Lección ${q.id}`];
  if (q.modulo) lines.push(`Módulo: ${q.modulo}`);
  lines.push("");
  lines.push(q.pregunta);

  const buttons = [];
  ["A", "B", "C", "D"].forEach((letter) => {
    const optText = q[letter];
    if (optText && String(optText).trim()) {
      buttons.push([
        {
          text: letter + ") " + optText,
          callback_data:
            DEFAULTS.CALLBACK_PREFIX + ":" + q.id + ":" + letter,
        },
      ]);
    }
  });

  tgSend_(chatId, lines.join("\n"), null, { inline_keyboard: buttons });
}

function processAnswer_(chatId, username, lessonId, letter, callbackQueryId, originalMessageId) {
  const q = getQuestionById_(lessonId);
  if (!q) {
    tgAnswerCallbackQuery_(callbackQueryId, "Pregunta no encontrada");
    return;
  }

  const isCorrect = letter.toUpperCase() === String(q.correcta).toUpperCase();
  logAttempt_(chatId, username, lessonId, letter, isCorrect);

  if (!isCorrect) {
    tgAnswerCallbackQuery_(callbackQueryId, "❌ Incorrecto, intenta otra vez");
    incrementAttempts_(chatId);
    // Dejamos los botones intactos para que pueda reintentar.
    return;
  }

  // Correcto
  tgAnswerCallbackQuery_(callbackQueryId, "✅ ¡Correcto!");

  const correctOpt = q[q.correcta] || "";
  tgEditMessageText_(
    chatId,
    originalMessageId,
    `📘 Lección ${q.id}\n${q.pregunta}\n\n✅ Correcto: ${q.correcta}) ${correctOpt}`
  );

  const next = getNextQuestionAfter_(lessonId);
  const nextId = next ? next.id : null;
  advanceProgress_(chatId, nextId);

  // Envía el video de la lección recién acertada (con su explicación como caption).
  sendVideoFromDrive_(chatId, q.video_file_id, q.explicacion);

  if (next) {
    sendQuestionToUser_(chatId, next.id);
  } else {
    tgSend_(
      chatId,
      "🏁 ¡Felicidades! Completaste todas las lecciones del curso. Usa /progreso para ver tu resumen."
    );
  }
}
