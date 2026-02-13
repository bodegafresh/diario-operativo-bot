/**
 * english.gs
 * Orquestación del flujo: descarga → Drive → Whisper → Análisis → respuesta
 */

/**
 * Entry point: Procesa nota de voz para English Journal
 * Maneja: lock, descarga, Drive, Whisper, Analysis, respuesta
 */
function englishProcessVoiceAsync_(msg, voiceMeta) {
  const chatId = msg && msg.chat && msg.chat.id ? String(msg.chat.id) : "";
  const messageId = msg && msg.message_id ? msg.message_id : null;
  const traceId = dbgTraceId_(chatId, messageId);

  if (!chatId || !messageId) return;

  // PASO 1: Verificar si ya hay procesamiento activo
  if (!englishLock_()) {
    tgSend_(
      chatId,
      "⏳ Estoy procesando tu audio anterior. Intenta en 1–2 minutos.",
      messageId
    );
    return;
  }

  try {
    // PASO 2: Validar tamaño (máximo configurado en DEFAULTS)
    const maxMb = DEFAULTS.ENGLISH_MAX_MB || 25;
    const maxBytes = maxMb * 1024 * 1024;
    if (voiceMeta.file_size && voiceMeta.file_size > maxBytes) {
      englishUnlock_();
      tgSend_(
        chatId,
        `❌ Audio demasiado grande (máx ${maxMb}MB). Intenta con otro.`,
        messageId
      );
      return;
    }

    // PASO 3: Loguear RECEIVED
    const replyToMsgId = msg.reply_to_message ? msg.reply_to_message.message_id : null;
    appendEnglishVoice_(chatId, messageId, replyToMsgId, voiceMeta);

    // PASO 4: Notificar usuario que está procesando
    tgSend_(chatId, "🔄 Procesando audio…", messageId);

    // PASO 5: Descarga y guarda en Drive
    const driveResult = englishDownloadAndSave_(
      voiceMeta.file_id,
      `english_${isoDate_(new Date())}_${chatId}_${messageId}.ogg`,
      voiceMeta.mime_type,
      chatId,
      messageId,
      traceId
    );

    if (!driveResult || !driveResult.fileId) {
      updateEnglishVoiceLog_(messageId, {
        status: "FAILED",
        error_message: "Error descargando audio de Telegram"
      });
      englishUnlock_();
      tgSend_(chatId, "❌ Error descargando audio. Intenta de nuevo.", messageId);
      return;
    }

    // PASO 6: Transcribir y analizar
    const analysisResult = englishTranscribeAndAnalyze_(
      driveResult.fileId,
      driveResult.downloadUrl || "",
      messageId,
      chatId,
      traceId
    );

    if (!analysisResult || !analysisResult.success) {
      updateEnglishVoiceLog_(messageId, {
        status: "FAILED",
        error_message: analysisResult?.error || "Error en transcripción/análisis"
      });
      englishUnlock_();
      tgSend_(
        chatId,
        `❌ ${analysisResult?.error || "Error procesando"}. Contáctame si persiste.`,
        messageId
      );
      return;
    }

    // PASO 7: Formatear respuesta
    const response = englishFormatResponse_(analysisResult);

    // PASO 8: Enviar respuesta al usuario
    tgSendSafe_(chatId, response, messageId);

    // PASO 9: Marcar como REPLIED
    updateEnglishVoiceLog_(messageId, { status: "REPLIED" });

    englishUnlock_();
  } catch (err) {
    console.error("englishProcessVoiceAsync_ error:", err);
    try {
      updateEnglishVoiceLog_(messageId, {
        status: "FAILED",
        error_message: String(err.message || err)
      });
    } catch (_) {}
    englishUnlock_();
    tgSend_(chatId, "❌ Error inesperado. Intenta más tarde.", messageId);
  }
}

/**
 * Descarga audio de Telegram y lo guarda en Google Drive
 */
function englishDownloadAndSave_(fileId, filename, mimeType, chatId, messageId, traceId) {
  const t0 = dbgNowMs_();
  const _trace = traceId || dbgTraceId_(chatId, messageId);

  try {
    dbgMark_(_trace, "DOWNLOAD_START", chatId, messageId, true, { fileId, filename, mimeType }, t0);

    // 1) getFile info
    const t1 = dbgNowMs_();
    const fileInfo = tgGetFileInfo_(fileId); // <-- aquí suele romper por 401/403/429/5xx
    dbgMark_(_trace, "TG_GET_FILE_INFO_OK", chatId, messageId, true, { has: !!fileInfo, file_path: fileInfo && fileInfo.file_path }, t1);

    if (!fileInfo || !fileInfo.file_path) {
      throw new Error("No se pudo obtener file_path de Telegram");
    }

    // 2) download blob
    const t2 = dbgNowMs_();
    const audioBlob = tgDownloadAudioBlob_(fileInfo.file_path, filename, mimeType); // <-- aquí puede romper por 404/413/5xx
    dbgMark_(_trace, "TG_DOWNLOAD_BLOB_OK", chatId, messageId, true, {
      has: !!audioBlob,
      size: audioBlob ? audioBlob.getBytes().length : null,
      contentType: audioBlob ? audioBlob.getContentType() : null
    }, t2);

    if (!audioBlob) {
      throw new Error("Falla al descargar blob");
    }

    // 3) upload drive
    const t3 = dbgNowMs_();
    const driveFileId = driveUploadAudioFile_(audioBlob, filename); // <-- aquí rompe por permisos/folderId
    dbgMark_(_trace, "DRIVE_UPLOAD_OK", chatId, messageId, true, { driveFileId }, t3);

    if (!driveFileId) {
      throw new Error("Falla al subir a Drive");
    }

    // 4) update log
    const t4 = dbgNowMs_();
    updateEnglishVoiceLog_(messageId, {
      status: "SAVED_TO_DRIVE",
      drive_file_id: driveFileId,
      drive_file_url: `https://drive.google.com/file/d/${driveFileId}/view`,
      trace_id: _trace,
      debug_step: "SAVED_TO_DRIVE"
    });
    dbgMark_(_trace, "LOG_SAVED_TO_DRIVE_OK", chatId, messageId, true, {}, t4);

    return {
      fileId: driveFileId,
      downloadUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
      blob: audioBlob,
      traceId: _trace
    };
  } catch (err) {
    dbgFail_(_trace, "DOWNLOAD_FAILED", chatId, messageId, err, t0, { fileId, filename, mimeType });
    console.error("englishDownloadAndSave_ error:", err);
    throw err;
  }
}


/**
 * Transcribe con OpenAI Whisper y analiza con ChatGPT
 */
function englishTranscribeAndAnalyze_(driveFileId, driveUrl, messageId, chatId, traceId) {
  const t0 = dbgNowMs_();
  const _trace = traceId || dbgTraceId_(chatId, messageId);

  try {
    dbgMark_(_trace, "TRANSCRIBE_START", chatId, messageId, true, { driveFileId }, t0);

    // 1) Read drive blob
    const t1 = dbgNowMs_();
    const file = DriveApp.getFileById(driveFileId); // <-- rompe si fileId inválido o permisos
    const audioBlob = file.getBlob();
    dbgMark_(_trace, "DRIVE_READ_OK", chatId, messageId, true, {
      name: file.getName(),
      mime: file.getMimeType(),
      size: audioBlob.getBytes().length
    }, t1);

    // 2) Transcribe (OpenAI)
    const t2 = dbgNowMs_();
    const transcript = openaiTranscribe_(audioBlob, file.getName(), file.getMimeType());
    dbgMark_(_trace, "OPENAI_TRANSCRIBE_OK", chatId, messageId, true, {
      transcript_len: transcript ? String(transcript).length : 0
    }, t2);

    if (!transcript) throw new Error("Transcripción vacía");

    updateEnglishVoiceLog_(messageId, {
      status: "TRANSCRIBED",
      transcript_full: transcript,
      transcript_short: String(transcript).substring(0, 150),
      trace_id: _trace,
      debug_step: "TRANSCRIBED"
    });

    // 3) Analyze (OpenAI)
    const t3 = dbgNowMs_();
    const analysis = openaiAnalyzeEnglish_(transcript);
    dbgMark_(_trace, "OPENAI_ANALYZE_OK", chatId, messageId, true, {
      type: typeof analysis,
      preview: dbgTrunc_(analysis, 200)
    }, t3);

    if (!analysis) throw new Error("Análisis vacío");

    // 4) Parse JSON robusto
    const t4 = dbgNowMs_();
    let parsed = analysis;

    if (typeof analysis === "string") {
      // Si viene con texto extra, intenta extraer el primer JSON {...}
      const s = String(analysis).trim();
      let jsonStr = s;

      // heurística simple: toma desde primer { hasta último }
      const i = s.indexOf("{");
      const j = s.lastIndexOf("}");
      if (i !== -1 && j !== -1 && j > i) jsonStr = s.slice(i, j + 1);

      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        dbgFail_(_trace, "PARSE_JSON_FAILED", chatId, messageId, e, t4, { preview: dbgTrunc_(analysis, 400) });
        throw new Error("No pude parsear JSON del análisis (respuesta no estricta).");
      }
    }

    dbgMark_(_trace, "PARSE_JSON_OK", chatId, messageId, true, { keys: Object.keys(parsed || {}) }, t4);

    // 5) Log analysis fields
    updateEnglishVoiceLog_(messageId, {
      status: "ANALYZED",
      transcript_short: parsed.transcript_short || String(transcript).substring(0, 150),
      fixes_1: (parsed.top_fixes && parsed.top_fixes[0]) || "",
      fixes_2: (parsed.top_fixes && parsed.top_fixes[1]) || "",
      fixes_3: (parsed.top_fixes && parsed.top_fixes[2]) || "",
      better_version: parsed.better_version || "",
      tomorrow_drill: parsed.tomorrow_drill || "",
      verb_focus: parsed.verb_focus || "",
      trace_id: _trace,
      debug_step: "ANALYZED"
    });

    return {
      success: true,
      traceId: _trace,
      transcript: transcript,
      transcript_short: parsed.transcript_short || String(transcript).substring(0, 150),
      top_fixes: parsed.top_fixes || [],
      better_version: parsed.better_version || "",
      tomorrow_drill: parsed.tomorrow_drill || "",
      verb_focus: parsed.verb_focus || ""
    };
  } catch (err) {
    dbgFail_(_trace, "TRANSCRIBE_ANALYZE_FAILED", chatId, messageId, err, t0, { driveFileId });
    console.error("englishTranscribeAndAnalyze_ error:", err);
    return { success: false, traceId: _trace, error: String(err.message || err) };
  }
}


/**
 * Formatea la respuesta final para Telegram
 */
function englishFormatResponse_(analysisResult) {
  const ts = analysisResult.transcript_short || "(no transcript)";
  const fixes = analysisResult.top_fixes || [];
  const bv = analysisResult.better_version || "(no version)";
  const drill = analysisResult.tomorrow_drill || "(no drill)";
  const focus = analysisResult.verb_focus || "(no focus)";

  const fix1 = fixes[0] ? `1) ${fixes[0]}` : "";
  const fix2 = fixes[1] ? `2) ${fixes[1]}` : "";
  const fix3 = fixes[2] ? `3) ${fixes[2]}` : "";

  const msg = [
    "✅ **Transcript:**",
    `"${ts}"`,
    "",
    "🎯 **Top 3 fixes:**",
    fix1.length > 0 ? fix1 : "1) (no fix)",
    fix2.length > 0 ? fix2 : "2) (no fix)",
    fix3.length > 0 ? fix3 : "3) (no fix)",
    "",
    "🗣️ **Better version:**",
    `"${bv}"`,
    "",
    "🏋️ **Tomorrow's drill (60s):**",
    drill,
    "",
    "📌 **Verb focus:**",
    focus,
  ].join("\n");

  return msg;
}

/**
 * Lock con TTL para evitar procesamiento concurrente
 */
function englishLock_() {
  const lock = LockService.getUserLock();
  const timeoutMs = (DEFAULTS.ENGLISH_PROCESSING_TIMEOUT_MIN || 5) * 60 * 1000;

  try {
    return lock.tryLock(timeoutMs);
  } catch (e) {
    return false;
  }
}

function englishUnlock_() {
  try {
    const lock = LockService.getUserLock();
    lock.releaseLock();
  } catch (_) {}
}
