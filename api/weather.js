/* Fetches the Met Office Global Spot three-hourly forecast for the centre of Lough Neagh
   and returns daily averages. The API key stays on the server and is never sent to the page. */
var LAT = 54.62, LON = -6.41;
var SOURCE = 'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/three-hourly' +
  '?excludeParameterMetadata=true&includeLocationName=false&latitude=' + LAT + '&longitude=' + LON;

/* Hours of daylight at the lough on a given date. */
function daylight(dateStr) {
  var d = new Date(dateStr + 'T12:00:00Z');
  var n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  var decl = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365) * Math.PI / 180;
  var x = -Math.tan(LAT * Math.PI / 180) * Math.tan(decl);
  return 24 / Math.PI * Math.acos(Math.max(-1, Math.min(1, x)));
}
/* Rough share of clear sky from the Met Office significant weather code. */
function clearShare(code) {
  if (code == null) return 0.4;
  if (code <= 1) return 0.9;
  if (code <= 3) return 0.6;
  if (code <= 6) return 0.2;
  if (code === 7) return 0.35;
  return 0.1;
}
function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

function summarise(date, steps) {
  var tSum = 0, tN = 0, wSum = 0, wN = 0, vx = 0, vy = 0, rain = 0, cSum = 0, cN = 0;
  steps.forEach(function (p) {
    var hi = num(p.maxScreenAirTemp), lo = num(p.minScreenAirTemp), scr = num(p.screenTemperature);
    var t = hi != null && lo != null ? (hi + lo) / 2 : (scr != null ? scr : (hi != null ? hi : lo));
    if (t != null) { tSum += t; tN++; }
    var w = num(p.windSpeed10m), dir = num(p.windDirectionFrom10m);
    if (w != null) { wSum += w; wN++; }
    if (w != null && dir != null) { vx += w * Math.sin(dir * Math.PI / 180); vy += w * Math.cos(dir * Math.PI / 180); }
    var r = num(p.totalPrecipAmount); if (r != null) rain += r;
    var hour = +String(p.time).slice(11, 13);
    if (hour >= 6 && hour <= 18) { cSum += clearShare(num(p.significantWeatherCode)); cN++; }
  });
  if (!tN || !wN) return null;
  var dir = (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360;
  return {
    date: date,
    t: +(tSum / tN).toFixed(1),
    w: +((wSum / wN) * 2.23694).toFixed(1),          /* metres per second to mph */
    dir: Math.round(dir),
    r: +rain.toFixed(1),
    s: +(daylight(date) * (cN ? cSum / cN : 0.4)).toFixed(1),
    steps: steps.length
  };
}

module.exports = async function (req, res) {
  /* Remove any spaces or line breaks picked up when the key was pasted. */
  var key = (process.env.MET_OFFICE_API_KEY || '').replace(/\s+/g, '');
  if (!key) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ ok: false, error: 'not_configured' }); return; }
  try {
    var r = await fetch(SOURCE, { headers: { apikey: key, accept: 'application/json' } });
    if (!r.ok) {
      var why = '';
      try { why = (await r.text()).slice(0, 300); } catch (e) {}
      console.warn('Met Office refused the request', r.status, 'key length', key.length, 'token-shaped', /^eyJ/.test(key) && key.split('.').length === 3, why);
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.status(502).json({ ok: false, error: 'met_office_refused', status: r.status });
      return;
    }
    var j = await r.json();
    var f = j && j.features && j.features[0];
    var ts = f && f.properties && f.properties.timeSeries;
    if (!Array.isArray(ts) || !ts.length) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.status(502).json({ ok: false, error: 'no_forecast_data' });
      return;
    }
    var todayStr = new Date().toISOString().slice(0, 10), byDate = {}, order = [];
    ts.forEach(function (p) {
      var d = String(p.time).slice(0, 10);
      if (d < todayStr) return;
      if (!byDate[d]) { byDate[d] = []; order.push(d); }
      byDate[d].push(p);
    });
    order.sort();
    var all = order.map(function (d) { return summarise(d, byDate[d]); }).filter(Boolean);
    var today = all.length && all[0].date === todayStr ? all.shift() : null;
    var days = all.filter(function (d) { return d.steps >= 4; }).slice(0, 5);
    if (!today) today = days[0] || null;
    if (!today || days.length < 5) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.status(502).json({ ok: false, error: 'forecast_too_short', days: days.length });
      return;
    }
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=10800');
    res.status(200).json({
      ok: true,
      source: 'Met Office Weather DataHub, Global Spot three-hourly forecast',
      point: { latitude: LAT, longitude: LON },
      modelRunDate: (f.properties && f.properties.modelRunDate) || null,
      fetchedAt: new Date().toISOString(),
      today: today,
      days: days
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
