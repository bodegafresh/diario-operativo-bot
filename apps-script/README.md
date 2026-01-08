# 🤖 TurboCotiza / Diario Operativo Bot (Telegram + Google Apps Script)

Este proyecto documenta la creación de un **bot de Telegram** orientado
a **productividad personal** (diario, check-ins conscientes y Pomodoro),
usando **Google Apps Script** como backend y un **Cloudflare Worker**
como proxy estable para el webhook.

El objetivo de este README es que **cualquier persona pueda replicarlo,
adaptarlo o extenderlo** para sus propias necesidades.

------------------------------------------------------------------------

## ✨ Funcionalidades

-   📓 **/diario** -- Registro diario guiado (guardado en Google Sheets)
-   ⏱️ **/pomodoro start \| stop \| status** -- Técnica 25/5 ×4 +
    descanso largo
-   🧠 **Check-ins aleatorios** (3 al día, 06--22)
-   🔔 Recordatorio diario para completar el diario
-   📊 Persistencia en Google Sheets
-   🧠 Diseño pensado para autoconciencia y foco
-   🛡️ Webhook estable (sin errores 302/500)

------------------------------------------------------------------------

## 🧱 Arquitectura

    Telegram
       ↓
    Cloudflare Worker (proxy, siempre responde 200 OK)
       ↓
    Google Apps Script (lógica del bot)
       ↓
    Google Sheets (datos)

> **Por qué usar un Worker:**\
> Telegram no tolera redirects (302).\
> Apps Script **sí** redirige internamente.\
> El Worker absorbe eso y estabiliza el webhook.

------------------------------------------------------------------------

## 🧰 Herramientas necesarias

-   Cuenta de **Telegram**
-   **BotFather** (para crear el bot)
-   **Google Apps Script**
-   **Google Sheets**
-   Cuenta **Cloudflare (gratis)** → Workers
-   Navegador (Chrome recomendado)

------------------------------------------------------------------------

## 🚀 Paso 1 -- Crear el bot en Telegram

1.  Abre Telegram → busca **@BotFather**

2.  Ejecuta:

        /start
        /newbot

3.  Guarda el **BOT_TOKEN**

------------------------------------------------------------------------

## 🚀 Paso 2 -- Google Apps Script

### Crear el proyecto

1.  Ve a https://script.google.com
2.  Nuevo proyecto
3.  Pega el código del bot (handlers, pomodoro, diario, check-ins)

### Web App

1.  **Implementar → Administrar implementaciones**
2.  Tipo: **Aplicación web**
3.  Ejecutar como: **Tú**
4.  Acceso: **Cualquiera**
5.  Copia la URL:

```{=html}
<!-- -->
```
    https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

Ese `<DEPLOYMENT_ID>` es clave.

------------------------------------------------------------------------

## ⚙️ Script Properties requeridas

En **Configuración del proyecto → Propiedades del script**:

    BOT_TOKEN=xxxxx
    SPREADSHEET_ID=xxxxx
    WEBAPP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

(Opcional)

    CHAT_ID=se_autodetecta

------------------------------------------------------------------------

## 🧪 Endpoints obligatorios

En el código de Apps Script:

``` js
function doGet() {
  return ContentService.createTextOutput("ok");
}

function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    // manejar mensaje
  } catch (e) {
    console.error(e);
  }
  return ContentService.createTextOutput("ok");
}
```

------------------------------------------------------------------------

## ☁️ Paso 3 -- Cloudflare Worker (gratis)

### Crear Worker

1.  https://dash.cloudflare.com
2.  **Workers & Pages**
3.  **Create application → Worker**

### Código del Worker

``` js
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("ok", { status: 200 });
    }

    const body = await request.text();

    await fetch(env.GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      redirect: "follow",
    });

    return new Response("ok", { status: 200 });
  },
};
```

### Variable de entorno del Worker

    GAS_WEBAPP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

Deploy.

Obtendrás una URL tipo:

    https://mi-bot.workers.dev

------------------------------------------------------------------------

## 🔗 Paso 4 -- Setear el webhook (desde Apps Script)

``` js
function setWebhookToWorker_() {
  const workerUrl = PropertiesService
    .getScriptProperties()
    .getProperty("WORKER_URL");

  const res = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + getBotToken_() + "/setWebhook",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        url: workerUrl,
        drop_pending_updates: true,
      }),
    }
  );

  Logger.log(res.getContentText());
}
```

Script Property adicional:

    WORKER_URL=https://mi-bot.workers.dev

------------------------------------------------------------------------

## ✅ Verificación

-   Ejecuta `getWebhookInfo`
-   Debe mostrar la URL del Worker
-   Prueba en Telegram:
    -   `/help`
    -   `/status`
    -   `/diario`

------------------------------------------------------------------------

## 🖼️ Imagen del bot

1.  Telegram → **@BotFather**
2.  `/mybots`
3.  Elegir bot → **Edit Bot → Edit Botpic**
4.  Subir imagen (512×512 recomendado)

------------------------------------------------------------------------

## 📦 Persistencia (Google Sheets)

Hojas típicas: - `Daily` - `Checkins` - `Pomodoro`

Se crean automáticamente si no existen.

------------------------------------------------------------------------

## 🧠 Ideas para extender

-   Autenticación por chat
-   Múltiples usuarios
-   Resúmenes semanales
-   Exportación CSV
-   IA para feedback reflexivo
-   Web UI

------------------------------------------------------------------------

## 🧩 Aprendizajes clave

-   Apps Script **no es un webhook confiable directo**
-   Telegram **no acepta redirects**
-   Un proxy (Worker) simplifica todo
-   Responder **200 OK siempre** es clave

------------------------------------------------------------------------

## 📜 Licencia

Uso libre para aprendizaje y proyectos personales.\
Si lo usas en producción o divulgación, menciona la idea original 🙌

------------------------------------------------------------------------

Hecho con ❤️, foco y muchas horas de debugging.
