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

function nowIso_() {
  return isoDateTime_(new Date());
}

function todayIso_() {
  return isoDate_(new Date());
}

function toInt_(v) {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : null;
}

function fullNameFromMsg_(msg) {
  const f = (msg && msg.from && msg.from.first_name) || "";
  const l = (msg && msg.from && msg.from.last_name) || "";
  const u = (msg && msg.from && msg.from.username) || "";
  const full = (f + " " + l).trim();
  return full || u || "";
}
