
# 🤖 Bot Diario Operativo en Telegram (Apps Script + Cloudflare Worker)

Este proyecto muestra cómo construir un **bot de Telegram productivo** usando:

- **Google Apps Script** (backend lógico, Sheets, triggers)
- **Google Sheets** (persistencia)
- **Cloudflare Workers** (proxy estable para Webhook de Telegram)
- **Telegram Bot API**

Está pensado para **replicar, adaptar o extender**, y documenta todos los problemas reales encontrados (302, 500, webhooks inestables) y su solución.

---

## 🧠 ¿Qué hace el bot?

- 📓 `/diario` → registra tu día en Google Sheets
- 🍅 `/pomodoro start|stop|status`
- 📊 `/status` → estado del sistema
- ❓ `/help`
- ⏰ Recordatorio diario automático
- 🎲 Check-ins aleatorios diarios
- 🧠 Aprendizaje del `chat_id` automáticamente

---

## 🏗️ Arquitectura

```
Telegram
   │
   │  (Webhook HTTPS)
   ▼
Cloudflare Worker  (endpoint estable, sin redirects)
   │
   │  POST JSON (update)
   ▼
Google Apps Script WebApp (/exec)
   │
   ├─ telegram.gs   → router / comandos
   ├─ setup.gs      → setup, triggers, webhook
   ├─ sheets.gs     → persistencia
   └─ config.gs     → Script Properties
   │
   ▼
Google Sheets
```

👉 **Motivo del Worker**  
Telegram **NO tolera** respuestas `302` ni redirects.  
Apps Script responde con `302` intermitente → Cloudflare Worker lo soluciona.

---

## 🔧 Requisitos

### Cuentas
- ✅ Google (Apps Script + Sheets)
- ✅ Telegram
- ✅ Cloudflare (plan **FREE**, suficiente)

### Herramientas
- Node.js (opcional)
- `clasp` (opcional para desarrollo local)
- Editor Apps Script

---

## 1️⃣ Crear el Bot en Telegram

1. Habla con **@BotFather**
2. `/start`
3. `/newbot`
4. Guarda el **BOT_TOKEN**

---

## 2️⃣ Google Sheets

1. Crea un Sheet
2. Copia el **SPREADSHEET_ID**
3. Las hojas se crean solas al ejecutar `setup()`

---

## 3️⃣ Google Apps Script

### 📁 Archivos clave

- `telegram.gs` → webhook + router
- `setup.gs` → inicialización + debug
- `config.gs` → helpers de Script Properties
- `sheets.gs` → escritura en Sheets

### 🔐 Script Properties (OBLIGATORIO)

En **Configuración del proyecto → Propiedades del script**:

| Key | Value |
|----|------|
| `BOT_TOKEN` | token de BotFather |
| `SPREADSHEET_ID` | ID del Sheet |
| `WEBAPP_URL` | URL del WebApp (`/exec`) |
| `WORKER_URL` | URL del Worker (`https://xxx.workers.dev`) |

⚠️ **Son privadas** (solo el proyecto las ve).

---

## 4️⃣ Desplegar Apps Script como WebApp

1. **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Ejecuta como: **Tú**
4. Acceso: **Cualquiera**
5. Copia la URL `/exec` → `WEBAPP_URL`

---

## 5️⃣ Funciones que DEBES ejecutar (en este orden)

### 🟢 Inicialización
```js
setup()
```
Crea hojas + triggers base.

---

### 🟢 Webhook directo (solo debug)
```js
run_fixWebhookNow()
```
⚠️ Puede fallar por 302 (esperado).

---

### 🟢 Ver estado actual
```js
run_getWebhookInfo()
```

---

## 6️⃣ Cloudflare Worker (SOLUCIÓN DEFINITIVA)

### Crear Worker

1. Cloudflare Dashboard
2. Workers → Create
3. Tipo: **HTTP Worker**

### Código del Worker

```js
export default {
  async fetch(request) {
    const url = "https://script.google.com/macros/s/XXXXXXXX/exec";

    const res = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return new Response(await res.text(), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
};
```

👉 Reemplaza con tu `WEBAPP_URL` real.

Guarda → obtén:
```
https://tu-worker.workers.dev
```

---

## 7️⃣ Setear Webhook a Cloudflare (FINAL)

### Ejecutar en Apps Script:

```js
run_setWebhookToWorker()
```

Esto ejecuta:
```js
setWebhookToWorker_()
```

✔️ Telegram → Worker → Apps Script  
✔️ Sin 302  
✔️ Sin errores 500  
✔️ Estable

---

## 8️⃣ Verificación

### Desde Apps Script
```js
run_getWebhookInfo()
```

Debe mostrar:
```json
"url": "https://xxx.workers.dev"
```

### Desde Telegram
- `/help`
- `/status`
- `/diario`

---

## 🧪 Funciones de Debug útiles

| Función | Qué hace |
|------|--------|
| `run_debugWebAppHttp()` | Test GET /exec |
| `run_debugWebhookPost()` | Simula POST Telegram |
| `run_debugEffectiveWebhook()` | Verifica URL final |
| `run_resetWebhook()` | Borra + re-set webhook |
| `run_fixWebhookNow()` | Reparación inmediata |
| `webhookHealthcheck_()` | Auto-reparación |
| `ensureWebhookHealthcheckTrigger_()` | Trigger cada 15 min |

---

## 🔄 Flujo de Webhook (resumen)

```
Telegram
  ↓
Cloudflare Worker  (200 OK siempre)
  ↓
Apps Script /exec
  ↓
doPost(e)
  ↓
handleMessage_()
```

---

## 🛡️ Seguridad

- Tokens **NO** están en código
- Script Properties = privadas
- Worker no expone lógica interna

---

## 🎨 Imagen del Bot

Para cambiar la imagen:

1. Habla con **@BotFather**
2. `/setuserpic`
3. Sube una imagen (512×512 recomendado)

---

## 🚀 Ideas para extender

- Multi-usuario
- OAuth por chat
- Dashboard web
- IA (OpenAI / Gemini)
- Notificaciones inteligentes

---

## 📌 Conclusión

Este setup evita **todos los errores clásicos**:
- ❌ 302 Moved Temporarily
- ❌ 500 Internal Server Error
- ❌ Webhook inconsistente

Y queda **100% replicable y estable**.

Si lo usas en tu canal de divulgación:  
👉 **linkea este repo + explica el Worker** (es la clave).

¡Buen hacking! 🚀
