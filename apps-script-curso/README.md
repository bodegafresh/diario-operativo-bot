# Curso Bot (Apps Script)

Bot de Telegram para un **curso interactivo de preguntas y videos**:

1. El usuario escribe `/start` al bot.
2. El bot le envía la pregunta de la lección actual con alternativas (A/B/C/D) como botones.
3. Si responde **correcto**, el bot le envía un video corto desde Google Drive y avanza a la siguiente lección.
4. Si responde **incorrecto**, el bot le pide volver a intentarlo con la misma pregunta.

Multi-usuario: cada `chat_id` tiene su propio progreso.

## Estructura

```
apps-script-curso/
├── .clasp.json           # config clasp (rellenar scriptId)
├── README.md
└── src/
    ├── appsscript.json   # manifest GAS
    ├── config.gs         # PROP, SHEETS, DEFAULTS, cfgGet/Set
    ├── utils.gs          # helpers fecha/parsing
    ├── sheets.gs         # ensureCoreSheets_, lookups
    ├── setup.gs          # setup(), seedExampleQuestions_(), setWebhook()
    ├── telegram.gs       # doPost, handleMessage_, handleCallbackQuery_, tgSend_
    ├── course.gs         # lógica del curso (preguntas + alternativas)
    ├── progress.gs       # estado por chat_id (Progress + Attempts)
    └── drive_video.gs    # sendVideo nativo desde Drive
```

## Setup

1. Instalar clasp y crear el proyecto:

   ```bash
   npm i -g @google/clasp
   clasp login
   cd apps-script-curso
   clasp create --type standalone --title "Curso Bot"
   # ó pega un scriptId existente en .clasp.json
   clasp push
   ```

2. En la UI de Apps Script, **Project Settings → Script Properties**, configura:

   | Key | Descripción |
   |---|---|
   | `BOT_TOKEN` | Token del bot de Telegram (BotFather) |
   | `SPREADSHEET_ID` | ID del Google Sheet del curso |
   | `WEBAPP_URL` | URL del Web App (después del primer deploy) |
   | `TG_WEBHOOK_SECRET` | (opcional) string aleatoria para validar webhook |

3. Ejecuta `setup()` desde el editor: crea las tabs `Questions`, `Progress`, `Attempts` y siembra 5 preguntas de ejemplo (colores).

4. **Deploy → New deployment → Web app**, "Anyone" como acceso. Copia la URL `/exec` a `WEBAPP_URL` y vuelve a ejecutar `setWebhook()`.

5. Sube los videos a Google Drive y pega el `video_file_id` de cada uno en la columna `video_file_id` del Sheet `Questions`. El `file_id` lo encuentras en la URL: `https://drive.google.com/file/d/<file_id>/view`.

6. Escríbele al bot `/start` desde Telegram y prueba el flujo.

## Comandos

- `/start` → bienvenida + primera pregunta (o donde quedaste).
- `/pregunta` → reenvía la pregunta actual.
- `/progreso` → muestra lección actual y estadísticas.
- `/reset` → reinicia tu progreso a la lección 1.

## Esquema del Sheet

### Tab `Questions`
`id | modulo | pregunta | A | B | C | D | correcta | video_file_id | explicacion | activa`

### Tab `Progress`
`chat_id | username | current_lesson_id | total_correct | total_attempts | started_at | updated_at | completed_at`

### Tab `Attempts`
`timestamp | chat_id | username | lesson_id | answer | is_correct | attempt_number`
