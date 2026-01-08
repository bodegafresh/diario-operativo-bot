# 🤖 Bot Diario Operativo en Telegram (Apps Script + Google Sheets + Cloudflare Worker)

Este repositorio documenta un bot de Telegram orientado a productividad personal (diario, check-ins y Pomodoro) usando:

- **Google Apps Script** como backend (webhook + lógica + triggers)
- **Google Sheets** como base de datos
- **Cloudflare Worker** como proxy estable para el webhook (evita 302/500)
- **Telegram Bot API**

Incluye un patrón de **seguridad de uso personal**:
- Solo **chat privado**
- Solo **un chat autorizado** (single-user)
- (Opcional PRO) Validación criptográfica del webhook con `TG_WEBHOOK_SECRET`

---

## ✨ Funcionalidades

- 📓 `/diario` → registra tu día en Google Sheets (tab `Daily`)
- 🍅 `/pomodoro start|stop|status` → 25/5 ×4 + 15 (Lun–Vie 09–18 Chile)
- 🧠 Check-ins aleatorios (3 al día, 06–22)
- 📝 Recordatorio diario para completar `/diario`
- 📊 `/status` → estado del sistema
- ❓ `/help` → ayuda

---

## 🏗️ Arquitectura

```
┌──────────┐
│ Telegram │
└────┬─────┘
     │ Webhook HTTPS (POST updates)
     ▼
┌───────────────────────┐
│ Cloudflare Worker     │  ✅ responde 200 OK siempre
│ (proxy anti-redirect) │  ✅ permite redirects hacia GAS
└─────────┬─────────────┘
          │ POST JSON
          ▼
┌───────────────────────┐
│ Google Apps Script     │
│ Web App (/exec)        │
│ doPost(e) → router     │
└─────────┬─────────────┘
          │ append rows
          ▼
┌───────────────────────┐
│ Google Sheets          │
│ Daily / Checkins / ... │
└───────────────────────┘
```

👉 Telegram **no tolera redirects (302)**.  
👉 Apps Script puede responder con 302 en ciertos despliegues.  
✅ El Worker lo estabiliza definitivamente.

---

## 🔧 Requisitos

### Cuentas
- Google (Apps Script + Sheets)
- Telegram
- Cloudflare (**Free** sirve)

### Herramientas (opcionales)
- `clasp` si quieres versionar Apps Script desde local

---

## 1️⃣ Crear el bot en Telegram

1. Habla con **@BotFather**
2. Ejecuta `/newbot`
3. Guarda el `BOT_TOKEN` (secreto)

---

## 2️⃣ Crear Google Sheet

1. Crea un Sheet
2. Copia el `SPREADSHEET_ID` (en la URL: `/d/<ID>/edit`)
3. Las tabs se crean solas con `setup()` si tu código las crea en `ensureCoreSheets_()`

---

## 3️⃣ Configurar Apps Script

### 3.1 Crear proyecto + pegar código
1. https://script.google.com
2. Nuevo proyecto
3. Pega tus archivos `.gs` (telegram.gs, setup.gs, etc.)

### 3.2 Script Properties (OBLIGATORIO)
En **Configuración del proyecto → Propiedades del script** agrega:

| Key | Value | Ejemplo |
|---|---|---|
| `BOT_TOKEN` | Token BotFather | `123:ABC...` |
| `SPREADSHEET_ID` | ID del Sheet | `1M_h0B...` |
| `WEBAPP_URL` | URL Web App `/exec` | `https://script.google.com/macros/s/XXX/exec` |
| `WORKER_URL` | URL Worker | `https://xxx.workers.dev/` |

#### Seguridad personal (single-user)
- `CHAT_ID` se usa como **ALLOWED_CHAT_ID**
- Puedes dejarlo vacío para que el bot lo “aprenda” en el primer mensaje privado

| Key | Value |
|---|---|
| `CHAT_ID` | *(vacío)* o tu chat id |

---

## 4️⃣ Desplegar como Web App (GAS)

1. **Implementar → Administrar implementaciones**
2. **Nueva implementación**
3. Tipo: **Aplicación web**
4. Ejecutar como: **Tú**
5. Acceso: **Cualquiera**
6. Implementar
7. Copia la URL `/exec` y guárdala en `WEBAPP_URL`

> `<DEPLOYMENT_ID>` es lo que va entre `/s/` y `/exec`.

---

## 5️⃣ IMPORTANTE: Cómo aplicar cambios (deploy correcto)

En Apps Script **no basta con pegar código**.  
Para que Telegram use el código nuevo:

✅ **Siempre que cambies el bot debes:**
1. **Crear una nueva versión del Web App**
   - Implementar → Administrar implementaciones → Editar → **Nueva versión** → Implementar
2. **Re-setear el webhook al Worker**
   - Ejecuta: `run_setWebhookToWorker()`

---

## 6️⃣ Cloudflare Worker (proxy estable)

### 6.1 Crear Worker
1. https://dash.cloudflare.com
2. Workers & Pages → Create Worker
3. Pega código

### 6.2 Código Worker recomendado
```js
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("ok", { status: 200 });

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

### 6.3 Variable de entorno del Worker
En Worker → **Settings → Variables**:

| Name | Value |
|---|---|
| `GAS_WEBAPP_URL` | tu `WEBAPP_URL` (`.../exec`) |

Deploy → copia la URL `https://xxx.workers.dev/` → guárdala en `WORKER_URL` en Apps Script.

---

## 7️⃣ Setear webhook (lo que se ejecuta realmente)

### 7.1 Inicialización (1 vez)
Ejecuta en Apps Script:
- `setup()`

### 7.2 Set webhook al Worker (siempre que redeployes)
Ejecuta:
- `run_setWebhookToWorker()`

### 7.3 Verificar
Ejecuta:
- `run_getWebhookInfo()`

Debe mostrar:
```json
"url": "https://tu-worker.workers.dev/"
```

---

## 🔐 (OPCIONAL PRO) Configurar `TG_WEBHOOK_SECRET`

Esto agrega una capa extra: aunque alguien descubra tu webhook, no puede postear updates falsos.

### 8.1 Crear el secret
Genera una cadena larga (32+ chars). En macOS:

```bash
python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
```

### 8.2 Guardarlo en Apps Script
En **Propiedades del script** agrega:

| Key | Value |
|---|---|
| `TG_WEBHOOK_SECRET` | tu secret generado |

### 8.3 Enviar `secret_token` en setWebhook
Tu `setWebhookToWorker_()` debe incluir:

```js
const payload = {
  url: workerUrl,
  drop_pending_updates: true,
};

const secret = cfgGet_("TG_WEBHOOK_SECRET", "");
if (secret) payload.secret_token = secret;
```

### 8.4 Validar header en `doPost`
Valida el header que Telegram enviará:

- Header: `X-Telegram-Bot-Api-Secret-Token`
- Debe coincidir con `TG_WEBHOOK_SECRET`

Ejemplo:

```js
const expected = cfgGet_("TG_WEBHOOK_SECRET", "");
if (expected) {
  const got = (e.headers && (e.headers["X-Telegram-Bot-Api-Secret-Token"] || e.headers["x-telegram-bot-api-secret-token"])) || "";
  if (String(got) !== String(expected)) {
    return ContentService.createTextOutput("ok"); // silencioso
  }
}
```

### 8.5 Aplicar cambios
Como cambiaste código/config:

1. **Redeploy Web App** (Nueva versión)
2. Ejecuta `run_setWebhookToWorker()` nuevamente

---

## 🔒 Seguridad (modo personal)

El bot se protege con:

1. **Solo chat privado**
2. **Solo un chat permitido** (`CHAT_ID` como allowlist)
3. (Opcional PRO) **secret token** del webhook

> Recomendación: rechazar no-autorizados silenciosamente (sin responder).

---

## 🧪 Funciones útiles (Apps Script)

| Función | Uso |
|---|---|
| `setup()` | crea sheets/triggers base |
| `run_setWebhookToWorker()` | set webhook al Worker (recomendado) |
| `run_getWebhookInfo()` | ver estado del webhook |
| `run_resetWebhook()` | deleteWebhook + setWebhook (debug) |
| `run_fixWebhookNow()` | repara webhook directo (debug) |
| `run_debugWebAppHttp()` | test GET a WEBAPP_URL |
| `debugWebhookPost()` | simula POST (debug) |

---

## 🖼️ Cambiar imagen del bot

1. Telegram → **@BotFather**
2. `/mybots`
3. Selecciona el bot → **Edit Bot → Edit Botpic**
4. Sube imagen (512×512 recomendado)

---

## ✅ Checklist final

- [ ] `BOT_TOKEN`, `SPREADSHEET_ID`, `WEBAPP_URL`, `WORKER_URL` seteados
- [ ] Web App desplegada (acceso: cualquiera)
- [ ] Worker creado con `GAS_WEBAPP_URL`
- [ ] Ejecutaste `setup()`
- [ ] Ejecutaste `run_setWebhookToWorker()`
- [ ] `/status` responde en Telegram
- [ ] Guarda en Sheets

Opcional PRO:
- [ ] `TG_WEBHOOK_SECRET` seteado
- [ ] Redeploy + `run_setWebhookToWorker()` nuevamente

---

## 📜 Licencia

Uso libre para aprendizaje y divulgación.
Si lo usas para enseñar, menciona el patrón Worker + GAS (es la clave).
