# 🤖 TurboCotiza -- Bot de Productividad (Telegram + Apps Script + Cloudflare)

Este repositorio documenta **paso a paso** cómo construir un bot de
Telegram robusto usando **Google Apps Script** como backend, **Google
Sheets** como almacenamiento y un **Cloudflare Worker** como proxy para
evitar errores típicos de webhooks (302 / 500).

Está pensado para **divulgación técnica** y para que cualquier persona
pueda **replicarlo, adaptarlo o extenderlo**.

------------------------------------------------------------------------

## ✨ Funcionalidades

-   📓 `/diario` -- Registro diario guiado (persistente en Google
    Sheets)
-   ⏱️ `/pomodoro start | stop | status` -- 25/5 ×4 + descanso largo
-   🧠 Check-ins aleatorios conscientes (3 por día)
-   🔔 Recordatorio diario automático
-   📊 Persistencia en Google Sheets
-   🛡️ Webhook estable (sin caídas por redirects)

------------------------------------------------------------------------

## 🧠 Arquitectura (visión general)

    ┌──────────┐
    │ Telegram │
    └────┬─────┘
         │ Webhook HTTPS
         ▼
    ┌────────────────────┐
    │ Cloudflare Worker  │  ← proxy (siempre responde 200 OK)
    └────┬───────────────┘
         │ POST (redirects permitidos)
         ▼
    ┌────────────────────┐
    │ Google Apps Script │
    │  - doPost()        │
    │  - lógica bot      │
    └────┬───────────────┘
         │
         ▼
    ┌────────────────────┐
    │ Google Sheets      │
    │ (Daily, Checkins, │
    │  Pomodoro)        │
    └────────────────────┘

👉 **Clave:** Telegram NO tolera redirects (302).\
👉 Apps Script SÍ redirige internamente.\
👉 El Worker absorbe eso y estabiliza el sistema.

------------------------------------------------------------------------

## 🧰 Herramientas necesarias

-   Cuenta de **Telegram**
-   **@BotFather**
-   **Google Apps Script**
-   **Google Sheets**
-   Cuenta **Cloudflare (gratis)** → Workers
-   Navegador web

------------------------------------------------------------------------

## 🚀 Paso 1 -- Crear el bot en Telegram

1.  Abrir Telegram → buscar **@BotFather**

2.  Ejecutar:

        /newbot

3.  Elegir nombre y username

4.  Guardar el **BOT_TOKEN** (muy importante)

------------------------------------------------------------------------

## 🚀 Paso 2 -- Google Apps Script (backend)

### Crear proyecto

1.  https://script.google.com
2.  Nuevo proyecto
3.  Pegar el código del bot (handlers, pomodoro, diario, check-ins)

### Funciones obligatorias del Web App

``` js
function doGet() {
  return ContentService.createTextOutput("ok");
}

function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    // manejar comandos: /help, /status, /diario, /pomodoro
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput("ok");
}
```

------------------------------------------------------------------------

## 🌐 Crear la Web App (muy importante)

1.  **Implementar → Administrar implementaciones**
2.  **Nueva implementación**
3.  Tipo: **Aplicación web**
4.  Ejecutar como: **Tú**
5.  Quién tiene acceso: **Cualquiera**
6.  Implementar
7.  Copiar la URL:

```{=html}
<!-- -->
```
    https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

📌 El `<DEPLOYMENT_ID>` es la parte entre `/s/` y `/exec`.

------------------------------------------------------------------------

## ⚙️ Script Properties (Apps Script)

Ir a: **Configuración del proyecto → Propiedades del script**

Agregar:

    BOT_TOKEN=xxxxxxxxxxxxxxxx
    SPREADSHEET_ID=xxxxxxxxxxxxxxxx
    WEBAPP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

Opcional (se autodetecta):

    CHAT_ID=

------------------------------------------------------------------------

## 📄 Google Sheets

Crear una hoja y copiar su ID (`/d/<ID>/edit`).

El script crea automáticamente las hojas: - `Daily` - `Checkins` -
`Pomodoro`

------------------------------------------------------------------------

## ☁️ Paso 3 -- Cloudflare Worker (proxy)

### Crear Worker (gratis)

1.  https://dash.cloudflare.com
2.  **Workers & Pages**
3.  **Create application → Worker**
4.  Pegar este código:

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

En **Settings → Variables**:

    GAS_WEBAPP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

Deploy.

Obtendrás una URL como:

    https://mi-worker.workers.dev

------------------------------------------------------------------------

## 🔗 Paso 4 -- Setear el webhook (desde Apps Script)

### Script Property adicional

    WORKER_URL=https://mi-worker.workers.dev

### Función para setear el webhook

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
        drop_pending_updates: true
      }),
    }
  );

  Logger.log(res.getContentText());
}
```

### Ejecutar (orden recomendado)

1.  `setup()` (si existe)
2.  `setWebhookToWorker_()`
3.  `getWebhookInfo_()` (verificación)

------------------------------------------------------------------------

## ✅ Verificación final

En Telegram probar varias veces: - `/help` - `/status` - `/diario` -
`/pomodoro start`

El bot **no debe caerse**.

------------------------------------------------------------------------

## 🖼️ Imagen del bot

1.  Telegram → **@BotFather**
2.  `/mybots`
3.  Elegir bot → **Edit Bot → Edit Botpic**
4.  Subir imagen (512×512 recomendado)

------------------------------------------------------------------------

## 🧠 Aprendizajes clave

-   Apps Script **no es confiable como webhook directo**
-   Telegram **rechaza redirects**
-   Un proxy simple soluciona el 100% de los problemas
-   Responder `200 OK` siempre es crítico
-   Cloudflare Workers Free es suficiente

------------------------------------------------------------------------

## 🚀 Ideas para extender

-   Multiusuario
-   Autenticación
-   Resúmenes semanales
-   IA para feedback reflexivo
-   Dashboard web
-   Exportaciones CSV

------------------------------------------------------------------------

## 📜 Licencia

Uso libre para aprendizaje y divulgación. Si lo usas en producción o
enseñanza, menciona la idea original 🙌

------------------------------------------------------------------------

Hecho con ❤️, foco y debugging real.
