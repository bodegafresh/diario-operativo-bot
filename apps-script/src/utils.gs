/**
 * utils.gs
 */

function tz_() {
  return Session.getScriptTimeZone() || "America/Santiago";
}

function isoDate_(d) {
  return Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
}

function isoDateTime_(d) {
  return Utilities.formatDate(d, tz_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function clamp_(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toInt_(v) {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : null;
}

function toFloat_(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}

function toBool_(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1", "si", "sí"].indexOf(s) !== -1) return true;
  if (["false", "no", "n", "0"].indexOf(s) !== -1) return false;
  return null;
}

function isWeekdayChile_(d) {
  // 0=Dom ... 6=Sáb
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function withinWindow_(d, startH, startM, endH, endM) {
  const start = new Date(d);
  start.setHours(startH, startM || 0, 0, 0);
  const end = new Date(d);
  end.setHours(endH, endM || 0, 0, 0);
  return d >= start && d <= end;
}

function pickRandom_(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function deleteTriggersByHandler_(handlerName) {
  const ts = ScriptApp.getProjectTriggers();
  ts.forEach((t) => {
    if (t.getHandlerFunction && t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

/**
 * Genera N tiempos aleatorios entre start..end separados por al menos minGapMin.
 */
function randomTimesSpaced_(start, end, count, minGapMin) {
  const minGapMs = (minGapMin || 60) * 60 * 1000;
  const chosen = [];
  let attempts = 0;

  while (chosen.length < count && attempts < 5000) {
    attempts++;
    const r =
      start.getTime() + Math.random() * (end.getTime() - start.getTime());
    const d = new Date(r);

    let ok = true;
    for (let i = 0; i < chosen.length; i++) {
      if (Math.abs(chosen[i].getTime() - d.getTime()) < minGapMs) {
        ok = false;
        break;
      }
    }
    if (ok) chosen.push(d);
  }

  // fallback si no logró spacing perfecto
  while (chosen.length < count) {
    const r2 =
      start.getTime() + Math.random() * (end.getTime() - start.getTime());
    chosen.push(new Date(r2));
  }

  chosen.sort((a, b) => a.getTime() - b.getTime());
  return chosen;
}
