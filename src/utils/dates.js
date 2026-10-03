/**
 * All calendar dates are stored as 'YYYY-MM-DD' strings in the clinic's own
 * timezone. This avoids the classic "appointment shows on the wrong day" bug
 * when the server runs in UTC and the clinic is in IST.
 */
function todayYmd(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function toUtc(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(ymd, n) {
  return new Date(toUtc(ymd) + n * 86400000).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
function diffDays(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** Monday of the week containing ymd. */
function weekStart(ymd) {
  const dow = (new Date(toUtc(ymd)).getUTCDay() + 6) % 7;
  return addDays(ymd, -dow);
}

module.exports = { todayYmd, addDays, diffDays, weekStart };
