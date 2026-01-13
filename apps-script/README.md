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

### 📓 Diario Operativo

- `/diario` → Registra tu día en Google Sheets (tab `Daily`)
- **Auto-fill de fecha**: La fecha actual se completa automáticamente
- **18 estados emocionales normalizados**: calma, enfocado, energético, confianza, motivado, neutral, estable, cansado, disperso, ansioso, inquieto, irritable, frustrado, abrumado, vulnerable, impulsivo, desanimado, gratitud
- **Formato mejorado**: Muestra todas las opciones de mood en el prompt

### 🧘 Coach V3 (Sistema de 90 días)

- **Programa estructurado**: 12 semanas divididas en 4 ciclos de 21 días
- **Sprints semanales**: Foco específico con reglas, objetivos y micro-hábitos
- **Plan diario personalizado**: Lectura, voz, inglés, storytelling, ritual, entreno
- **Niveles de intensidad**: suave, estándar, desafiante (ajusta minutos de cada actividad)
- **Comandos**:
  - `/coach on|off|status|reset21|reset90`
  - `/nivel suave|estandar|desafiante`
  - `/plan` → Plan completo del día
  - `/entreno` → Detalles del entreno de hoy
  - `/ritual` → Micro-ritual (4 afirmaciones + ejercicio)

### 🎯 Ritual Diario

- **4 afirmaciones personalizadas** (una de cada categoría):
  - Núcleo: identidad y valores
  - Emocional: regulación y resiliencia
  - Presencia: atención y conciencia
  - Trabajo: productividad y propósito
- **Caché diario**: Las mismas 4 afirmaciones persisten todo el día
- **Ejercicio guiado**: Respiración + reencuadre + acción mínima (2-4 min)

### 🧠 Check-ins Inteligentes

- **3 preguntas diarias** (horarios aleatorios 06:00-22:00)
- **Sistema anti-repetición**: Historial de preguntas para evitar repeticiones
- **Selección inteligente**: Garantiza que todas las preguntas se usen antes de repetir
- **Registro completo**: Pregunta, intensidad (1-10) y respuesta detallada

### 🍅 Pomodoro Laboral

- `/pomodoro start|stop|status`
- **Ciclo**: 25/5 ×4 + 15 min descanso largo
- **Horario**: Lun–Vie 09:00–18:00
- **Auto-stop**: Se detiene fuera de horario laboral

### 📊 Sistema de Información

- `/status` → Estado completo de todos los módulos
- `/help` → Ayuda con todos los comandos disponibles
- **Formato optimizado**: Mensajes con emojis y estructura clara para Telegram

### ⏰ Recordatorios Automáticos

- **Plan matinal**: 08:30 (plan completo del día)
- **4 recordatorios aleatorios**: Durante el día (horarios variables)
- **Check-in nocturno**: 22:30 (resumen del día con 8 valores)
- **Recordatorio de diario**: 21:30

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

| Key              | Value               | Ejemplo                                       |
| ---------------- | ------------------- | --------------------------------------------- |
| `BOT_TOKEN`      | Token BotFather     | `123:ABC...`                                  |
| `SPREADSHEET_ID` | ID del Sheet        | `1M_h0B...`                                   |
| `WEBAPP_URL`     | URL Web App `/exec` | `https://script.google.com/macros/s/XXX/exec` |
| `WORKER_URL`     | URL Worker          | `https://xxx.workers.dev/`                    |

#### Seguridad personal (single-user)

- `CHAT_ID` se usa como **ALLOWED_CHAT_ID**
- Puedes dejarlo vacío para que el bot lo “aprenda” en el primer mensaje privado

| Key       | Value                  |
| --------- | ---------------------- |
| `CHAT_ID` | _(vacío)_ o tu chat id |

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

    // Validar secret de Telegram (esto SÍ va aquí)
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (env.TG_WEBHOOK_SECRET && got !== env.TG_WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }

    const body = await request.text();

    // Reenvía a GAS y SÍ sigue redirects (script.google.com -> googleusercontent.com)
    const headers = { "content-type": "application/json" };
    headers["X-Telegram-Bot-Api-Secret-Token"] = got;

    const r = await fetch(env.GAS_WEBAPP_URL, {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    });

    // OJO: a Telegram SIEMPRE respóndele 200, aunque GAS falle, para no cortar el webhook.
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("GAS upstream error", r.status, txt);
    }

    return new Response("ok", { status: 200 });
  },
};
```

### 6.3 Variables de entorno del Worker

En Worker → **Settings → Variables** (o Environment Variables):

| Name                | Type   | Value                                | Descripción                                              |
| ------------------- | ------ | ------------------------------------ | -------------------------------------------------------- |
| `GAS_WEBAPP_URL`    | Plain  | `https://script.google.com/.../exec` | **REQUERIDO**: URL del Web App de Apps Script            |
| `TG_WEBHOOK_SECRET` | Secret | `tu-secret-token-generado`           | **OPCIONAL**: Token de validación de webhook de Telegram |

#### Explicación de las variables:

**`GAS_WEBAPP_URL`** (Requerida)

- Es la URL del Web App que creaste en Apps Script (paso 4)
- Formato: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`
- El Worker enviará aquí todas las peticiones de Telegram
- Tipo: **Plain text** (no es secreto)

**`TG_WEBHOOK_SECRET`** (Opcional pero recomendada)

- Token secreto para validar que las peticiones vienen de Telegram
- Debe ser el mismo valor que configuraste en Apps Script Properties
- Genera uno con: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
- Tipo: **Secret** (se encripta en Cloudflare)
- Si no la configuras, cualquiera que conozca la URL del Worker podría enviar peticiones

#### Cómo configurar:

1. En el dashboard de Cloudflare, ve a tu Worker
2. Settings → Variables and Secrets
3. Para cada variable:
   - Click **Add variable**
   - Name: nombre de la variable
   - Value: el valor correspondiente
   - Type: Plain text o Encrypt (para secrets)
4. Click **Save and Deploy**

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

| Key                 | Value              |
| ------------------- | ------------------ |
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
  const got =
    (e.headers &&
      (e.headers["X-Telegram-Bot-Api-Secret-Token"] ||
        e.headers["x-telegram-bot-api-secret-token"])) ||
    "";
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

## 🎨 Mejoras Recientes (Enero 2026)

### Coach System

- ✅ Programa completo de 90 días con 4 ciclos de 21 días
- ✅ 12 sprints semanales con temas específicos
- ✅ 3 fases de evolución (Fundación, Consolidación, Integración)
- ✅ Sistema de niveles ajustable (suave/estándar/desafiante)
- ✅ Rutinas de entreno variadas (fuerza, HIIT, core, recuperación)

### Ritual Mejorado

- ✅ 4 afirmaciones diarias (una por categoría)
- ✅ Banco de 90 afirmaciones organizadas por tipo
- ✅ Caché diario para consistencia
- ✅ Formato optimizado para Telegram

### Check-ins Inteligentes

- ✅ Sistema anti-repetición con historial
- ✅ Garantiza uso de todas las preguntas antes de repetir
- ✅ Registro mejorado en Google Sheets

### Diario Operativo

- ✅ Auto-fill de fecha actual
- ✅ 18 mood options normalizados en español
- ✅ Prompt muestra todas las opciones disponibles
- ✅ Mapeo automático de términos en inglés
- ✅ Formato mejorado para Telegram

### UI/UX

- ✅ Todos los mensajes optimizados para Telegram
- ✅ Emojis consistentes en toda la interfaz
- ✅ Información actualizada sobre horarios aleatorios
- ✅ Mejor estructura y legibilidad

---

## 🔒 Seguridad (modo personal)

El bot se protege con:

1. **Solo chat privado**
2. **Solo un chat permitido** (`CHAT_ID` como allowlist)
3. (Opcional PRO) **secret token** del webhook

> Recomendación: rechazar no-autorizados silenciosamente (sin responder).

---

## 🧪 Funciones útiles (Apps Script)

| Función                    | Uso                                 |
| -------------------------- | ----------------------------------- |
| `setup()`                  | crea sheets/triggers base           |
| `run_setWebhookToWorker()` | set webhook al Worker (recomendado) |
| `run_getWebhookInfo()`     | ver estado del webhook              |
| `run_resetWebhook()`       | deleteWebhook + setWebhook (debug)  |
| `run_fixWebhookNow()`      | repara webhook directo (debug)      |
| `run_debugWebAppHttp()`    | test GET a WEBAPP_URL               |
| `debugWebhookPost()`       | simula POST (debug)                 |

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
