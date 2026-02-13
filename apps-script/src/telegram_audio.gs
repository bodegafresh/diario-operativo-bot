/**
 * telegram_audio.gs
 * Descarga de archivos desde Telegram + Subida a Google Drive
 */

/**
 * Obtiene información del archivo desde Telegram (getFile endpoint)
 */
function tgGetFileInfo_(fileId) {
  const token = getBotToken_();
  const url = "https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(fileId);

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code >= 300) {
      throw new Error("Telegram getFile error " + code);
    }

    const result = JSON.parse(response.getContentText());
    if (result.ok && result.result) {
      return result.result; // { file_id, file_unique_id, file_size, file_path }
    }
    throw new Error("Telegram getFile returned not ok");
  } catch (err) {
    console.error("tgGetFileInfo_ error:", err);
    throw err;
  }
}

/**
 * Descarga blob de audio desde Telegram usando file_path
 */
function tgDownloadAudioBlob_(filePath, filename, mimeType) {
  const token = getBotToken_();
  const url = "https://api.telegram.org/file/bot" + token + "/" + filePath;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code >= 300) {
      throw new Error("Telegram download error " + code);
    }

    const blob = response.getBlob();
    if (!blob) {
      throw new Error("No blob returned from Telegram");
    }

    // Asegurar nombre y MIME type
    return blob.setName(filename || "audio.ogg").setContentType(mimeType || "audio/ogg");
  } catch (err) {
    console.error("tgDownloadAudioBlob_ error:", err);
    throw err;
  }
}

/**
 * Sube archivo a Google Drive en la carpeta configurada
 * Lee config de ENGLISH_CONFIG property (JSON) o usa raíz
 * Devuelve file ID o null si falla
 */
function driveUploadAudioFile_(audioBlob, filename) {
  try {
    let folder = null;
    
    // Intentar leer carpeta desde ENGLISH_CONFIG (JSON property)
    const configJson = cfgGet_(PROP.ENGLISH_CONFIG, "");
    if (configJson) {
      try {
        const cfg = JSON.parse(configJson);
        if (cfg.driveFolderId) {
          folder = DriveApp.getFolderById(cfg.driveFolderId);
        }
      } catch (_) {
        // Si JSON parse falla, ignora
      }
    }

    // Fallback: usar raíz
    if (!folder) {
      folder = DriveApp.getRootFolder();
    }

    // Crear archivo
    const file = folder.createFile(audioBlob);
    
    if (!file) {
      throw new Error("CreateFile retornó null");
    }

    return file.getId();
  } catch (err) {
    console.error("driveUploadAudioFile_ error:", err);
    throw err;
  }
}
