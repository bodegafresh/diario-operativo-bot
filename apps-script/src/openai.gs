/**
 * openai.gs
 * Llamadas a OpenAI API: Whisper (transcription) + ChatGPT (analysis)
 */

/**
 * Transcribe audio usando OpenAI Whisper API
 * @param {Blob} audioBlob - Blob de audio (OGG/MP3/etc)
 * @param {string} filename - Nombre del archivo
 * @param {string} mimeType - Tipo MIME
 * @return {string} Texto transcrito
 */
function openaiTranscribe_(audioBlob, filename, mimeType) {
  const apiKey = cfgGet_(PROP.OPENAI_API_KEY, "");
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en Script Properties");
  }

  const url = "https://api.openai.com/v1/audio/transcriptions";

  // Preparar multipart form data (UrlFetchApp puede manejar Blob directamente)
  const boundary = "----WebKitFormBoundary" + Utilities.getUuid();
  let body = "";

  // Agregar modelo
  body += "--" + boundary + "\r\n";
  body += 'Content-Disposition: form-data; name="model"\r\n\r\n';
  body += "whisper-1\r\n";

  // Agregar language (optional but helps)
  body += "--" + boundary + "\r\n";
  body += 'Content-Disposition: form-data; name="language"\r\n\r\n';
  body += "en\r\n";

  // Preparar payload (file se agrega después)
  // En Apps Script, es más fácil usar FormData si disponible, o el siguiente approach:
  
  const payload = {
    model: "whisper-1",
    language: "en",
    file: audioBlob
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        Authorization: "Bearer " + apiKey
      },
      payload: payload,
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code >= 300) {
      const errMsg = text ? JSON.parse(text).error?.message || text : "Error desconocido";
      throw new Error("Whisper error (" + code + "): " + errMsg);
    }

    const result = JSON.parse(text);
    return result.text || "";
  } catch (err) {
    console.error("openaiTranscribe_ error:", err);
    throw err;
  }
}

/**
 * Analiza transcripción en inglés usando ChatGPT
 * Devuelve JSON con fixes, better_version, drill, verb_focus
 * @param {string} transcript - Texto transcrito
 * @return {Object|string} Objeto/string JSON con análisis
 */
function openaiAnalyzeEnglish_(transcript) {
  const apiKey = cfgGet_(PROP.OPENAI_API_KEY, "");
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en Script Properties");
  }

  const url = "https://api.openai.com/v1/chat/completions";

  const systemPrompt = `You are an English speaking coach and grammar expert. 
Analyze the user's spoken English (provided as a transcript) and give specific, actionable feedback.
Return a JSON object (only JSON, no markdown or extra text) with these exact fields:
{
  "transcript_short": "First 1-2 sentences of transcript or 1-2 line summary",
  "top_fixes": ["Fix 1: specific error with explanation", "Fix 2...", "Fix 3..."],
  "better_version": "A rewritten, natural version of what they said (1-2 sentences)",
  "tomorrow_drill": "A specific 60-second speaking drill instruction for tomorrow",
  "verb_focus": "A grammar focus: e.g. 'Simple present vs present continuous - explanation'"
}
Be concise, clear, and encouraging. Focus on practical improvements.`;

  const userPrompt = `Analyze this English transcript and provide coaching feedback:\n\n"${transcript}"`;

  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code >= 300) {
      const errMsg = text ? (function() {
        try {
          return JSON.parse(text).error?.message || text;
        } catch (_) {
          return text;
        }
      })() : "Error desconocido";
      throw new Error("ChatGPT error (" + code + "): " + errMsg);
    }

    const result = JSON.parse(text);
    const content = result.choices && result.choices[0] && result.choices[0].message ? 
                    result.choices[0].message.content : "";

    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Intentar parsear como JSON
    try {
      return JSON.parse(content);
    } catch (_) {
      // Si no es JSON válido, devolver como string para que english.gs maneje
      console.warn("OpenAI response no es JSON válido:", content);
      return {
        transcript_short: transcript.substring(0, 150),
        top_fixes: ["(Error parsing response)"],
        better_version: transcript,
        tomorrow_drill: "(No drill provided)",
        verb_focus: "(No focus provided)"
      };
    }
  } catch (err) {
    console.error("openaiAnalyzeEnglish_ error:", err);
    throw err;
  }
}
