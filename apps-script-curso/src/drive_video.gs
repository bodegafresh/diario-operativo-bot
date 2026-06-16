/**
 * drive_video.gs
 * Envío de videos desde Google Drive a Telegram.
 *
 * Estrategia:
 *  - Si video_file_id está vacío: envía solo la explicación como texto.
 *  - Si el archivo existe en Drive y pesa <= 50 MB: lo manda con sendVideo (multipart).
 *  - Si pesa más o falla la lectura: fallback a sendMessage con el link público de Drive.
 */

function sendVideoFromDrive_(chatId, videoFileId, caption) {
  const fileId = String(videoFileId || "").trim();
  if (!fileId) {
    if (caption) tgSend_(chatId, "💡 " + caption);
    return;
  }

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    console.error("Drive getFileById failed for " + fileId, err);
    sendVideoFallback_(chatId, fileId, caption, "No pude abrir el video.");
    return;
  }

  const sizeBytes = Number(file.getSize() || 0);
  if (sizeBytes > DEFAULTS.TELEGRAM_VIDEO_LIMIT_BYTES) {
    sendVideoFallback_(
      chatId,
      fileId,
      caption,
      "El video supera los 50 MB; te paso el link."
    );
    return;
  }

  let blob;
  try {
    blob = file.getBlob();
  } catch (err) {
    console.error("Drive getBlob failed for " + fileId, err);
    sendVideoFallback_(chatId, fileId, caption, "No pude leer el video.");
    return;
  }

  const url = "https://api.telegram.org/bot" + getBotToken_() + "/sendVideo";
  const payload = {
    chat_id: chatId,
    video: blob,
    supports_streaming: "true",
  };
  if (caption) payload.caption = String(caption);

  try {
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      payload: payload,
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code >= 300) {
      console.error("Telegram sendVideo error " + code + ": " + res.getContentText());
      sendVideoFallback_(chatId, fileId, caption, "Falló el envío del video.");
    }
  } catch (err) {
    console.error("UrlFetchApp sendVideo error", err);
    sendVideoFallback_(chatId, fileId, caption, "Falló el envío del video.");
  }
}

function sendVideoFallback_(chatId, fileId, caption, prefix) {
  const link = "https://drive.google.com/file/d/" + fileId + "/view";
  const lines = [];
  if (prefix) lines.push("⚠️ " + prefix);
  if (caption) lines.push(caption);
  lines.push("🎬 " + link);
  tgSend_(chatId, lines.join("\n"));
}
