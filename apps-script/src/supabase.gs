/**
 * supabase.gs
 *
 * Cliente HTTP mínimo para el API PostgREST de Supabase.
 * Todas las funciones son "fire-and-don't-crash": si Supabase falla, el error
 * se loguea en console pero nunca se propaga al flujo principal del bot.
 *
 * Configuración requerida en Script Properties:
 *   SUPABASE_URL          → https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  → eyJ...  (service_role key)
 *
 * Si alguna de las dos no está configurada, todas las llamadas se saltan
 * silenciosamente — Supabase es opcional, Google Sheets es el primario.
 */

// ── Test manual (ejecutar desde el editor para diagnosticar) ────────────────────

/**
 * Ejecutar manualmente desde el editor para verificar credenciales y conexión.
 * Los resultados se ven en View → Execution Log (o Ctrl+Enter).
 */
function testSupabase() {
  var url = cfgGet_(PROP.SUPABASE_URL, '');
  var key = cfgGet_(PROP.SUPABASE_SERVICE_KEY, '');

  Logger.log('=== TEST SUPABASE ===');
  Logger.log('URL: ' + (url ? url.slice(0, 60) : '*** EMPTY ***'));
  Logger.log('KEY: ' + (key ? 'SET (longitud=' + key.length + ')' : '*** EMPTY ***'));

  if (!url || !key) {
    Logger.log('RESULTADO: Sin credenciales — el dual-write se saltará silenciosamente');
    return;
  }

  // GET simple: select 1 fila de english_voice
  var testUrl = url.replace(/\/$/, '') + '/rest/v1/english_voice?limit=1';
  var resp = UrlFetchApp.fetch(testUrl, {
    method: 'GET',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
    muteHttpExceptions: true,
  });
  Logger.log('GET english_voice → HTTP ' + resp.getResponseCode());
  Logger.log('Body: ' + resp.getContentText().slice(0, 300));

  // POST de test: insertar fila con ignore-duplicates
  var now = new Date();
  var testRow = {
    recorded_at: now.toISOString(),
    updated_at:  now.toISOString(),
    date:        Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    chat_id:     'TEST',
    message_id:  'TEST_' + now.getTime(),
    status:      'RECEIVED',
  };
  var postUrl = url.replace(/\/$/, '') + '/rest/v1/english_voice?on_conflict=' + encodeURIComponent('message_id');
  var postResp = UrlFetchApp.fetch(postUrl, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=ignore-duplicates,return=minimal',
    },
    payload: JSON.stringify([testRow]),
    muteHttpExceptions: true,
  });
  Logger.log('POST english_voice (test row) → HTTP ' + postResp.getResponseCode());
  Logger.log('Body: ' + postResp.getContentText().slice(0, 300));
  Logger.log('=== FIN TEST ===');
}

// ── Funciones públicas ──────────────────────────────────────────────────────────

/**
 * INSERT con ON CONFLICT (upsert).
 * @param {string} table     Nombre de la tabla
 * @param {Object[]} rows    Array de objetos a insertar
 * @param {string} conflictCols  Columnas de conflicto separadas por coma ("date,from_user")
 * @param {boolean} ignoreOnConflict  true = DO NOTHING, false = DO UPDATE
 */
function sbUpsert_(table, rows, conflictCols, ignoreOnConflict) {
  if (!rows || rows.length === 0) return;
  var prefer = ignoreOnConflict
    ? 'resolution=ignore-duplicates,return=minimal'
    : 'resolution=merge-duplicates,return=minimal';
  var params = 'on_conflict=' + encodeURIComponent(conflictCols);
  _sbFetch_('POST', table, rows, params, prefer);
}

/**
 * INSERT puro (sin conflict handling).
 * Usar para tablas de log append-only como coach_state donde el UNIQUE
 * constraint en recorded_at ya previene duplicados a nivel de BD.
 * @param {string} table
 * @param {Object[]} rows
 */
function sbInsert_(table, rows) {
  if (!rows || rows.length === 0) return;
  _sbFetch_('POST', table, rows, null, 'return=minimal');
}

/**
 * PATCH (update) de filas que cumplan los filtros.
 * @param {string} table
 * @param {Object} eqFilters  Filtros de igualdad: { message_id: "eq.123", status: "eq.RECEIVED" }
 * @param {Object} patch      Campos a actualizar
 */
function sbUpdate_(table, eqFilters, patch) {
  if (!patch || Object.keys(patch).length === 0) return;
  var params = Object.keys(eqFilters)
    .map(function(k) { return k + '=' + encodeURIComponent(eqFilters[k]); })
    .join('&');
  _sbFetch_('PATCH', table, patch, params, 'return=minimal');
}


// ── Internals ───────────────────────────────────────────────────────────────────

/**
 * Realiza la petición HTTP a Supabase PostgREST con retry exponencial.
 * Nunca lanza — todos los errores quedan en console.log (Cloud Logging).
 */
function _sbFetch_(method, table, body, queryParams, prefer) {
  var url  = cfgGet_(PROP.SUPABASE_URL, '');
  var key  = cfgGet_(PROP.SUPABASE_SERVICE_KEY, '');
  console.log('[SB] _sbFetch_ ' + method + ' ' + table + ' url=' + (url ? url.slice(0, 50) : 'EMPTY') + ' key=' + (key ? 'SET(len=' + key.length + ')' : 'EMPTY'));
  if (!url || !key) {
    console.log('[SB] SKIP — SUPABASE_URL o SUPABASE_SERVICE_KEY no configurado');
    return null;
  }

  var fullUrl = url.replace(/\/$/, '') + '/rest/v1/' + table;
  if (queryParams) fullUrl += '?' + queryParams;

  var options = {
    method:           method,
    headers: {
      'apikey':         key,
      'Authorization':  'Bearer ' + key,
      'Content-Type':   'application/json',
      'Prefer':         prefer || 'return=minimal',
    },
    payload:           JSON.stringify(body),
    muteHttpExceptions: true,  // necesario para leer el código de respuesta sin excepción
  };

  return _sbRetry_(function() {
    return UrlFetchApp.fetch(fullUrl, options);
  }, table + ' ' + method);
}

/**
 * Wrapper de retry con backoff exponencial.
 * Reintentos en: 429 (rate limit), 500, 502, 503, 504.
 * No reintenta en: 400, 401, 403, 404, 409, etc. (errores de cliente, no se corrigen solos).
 *
 * @param {function} fn         Función que hace el UrlFetchApp.fetch() y retorna una HTTPResponse
 * @param {string} context      Texto para el log (ej: "daily POST")
 * @returns {HTTPResponse|null} Respuesta si exitoso, null si falló definitivamente
 */
function _sbRetry_(fn, context) {
  var MAX_ATTEMPTS  = 4;
  var BASE_DELAY_MS = 600;
  var RETRY_CODES   = [429, 500, 502, 503, 504];

  var lastErr = '';

  for (var i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      var resp = fn();
      var code = resp.getResponseCode();

      if (code < 400) {
        console.log('[SB] OK ' + code + ' — ' + context);
        return resp;
      }

      // ¿Vale la pena reintentar?
      if (RETRY_CODES.indexOf(code) === -1) {
        // Error de cliente — no mejorar con reintentos
        var body = resp.getContentText().slice(0, 400);
        console.log('[SB] ERROR no retriable ' + code + ' (' + context + '): ' + body);
        return null;
      }

      lastErr = 'HTTP ' + code;

    } catch (e) {
      lastErr = e.message;
    }

    if (i < MAX_ATTEMPTS - 1) {
      var delay = BASE_DELAY_MS * Math.pow(2, i);  // 600ms, 1.2s, 2.4s
      console.log('[SB] Intento ' + (i + 1) + ' fallido (' + context + '): ' +
                 lastErr + '. Reintentando en ' + delay + 'ms…');
      Utilities.sleep(delay);
    }
  }

  console.log('[SB] Fallo definitivo tras ' + MAX_ATTEMPTS + ' intentos (' +
             context + '): ' + lastErr);
  return null;  // nunca lanza
}
