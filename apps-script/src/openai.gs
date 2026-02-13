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
  const lang = cfgGet_(PROP.ENGLISH_COACH_LANG, "es");

  const explainLangLine = (lang === "es")
    ? "El usuario es hispanohablante. Explica EN ESPAÑOL..."
    : "Explain in ENGLISH...";
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en Script Properties");
  }

  const url = "https://api.openai.com/v1/chat/completions";

  const systemPrompt = `
  Eres un coach de speaking en inglés y experto en gramática.
  ${explainLangLine}
  El usuario es hispanohablante. Explica EN ESPAÑOL, pero mantén en INGLÉS:
  - transcript_short
  - better_version
  - ejemplos del drill (las frases a decir)

  Devuelve SOLO JSON válido (sin markdown, sin texto extra) con EXACTAMENTE estas llaves:
  {
    "transcript_short": "English. 1-2 lines max.",
    "top_fixes": ["Español. 1-2 líneas cada fix, con ejemplo corto en inglés si aplica.", "…", "…"],
    "better_version": "English. Natural rewrite (1-2 sentences).",
    "tomorrow_drill": "Español. Instrucción 60s + lista de 3-5 frases ejemplo en inglés.",
    "verb_focus": "Español. Tema gramatical + explicación ultra breve + 1 ejemplo en inglés."
  }

  Reglas:
  - Sé corto y accionable.
  - No agregues campos extra.
  - Si el transcript es muy corto, igual da 3 fixes (pueden ser micro-mejoras).
  `.trim();


  const userPrompt = `Analyze this English transcript and provide coaching feedback:\n\n"${transcript}"`;

  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 350
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
