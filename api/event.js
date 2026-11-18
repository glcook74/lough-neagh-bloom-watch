/* Everything we hold about the weeks before one day, for working out what led up to a bloom:
   daily weather over the lough, rain over each river basin, and the DAERA buoy readings.
   ?date=YYYY-MM-DD&before=75&after=10 */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var BUOYS = [['Reas_Wood_AquaTROLL_Metrics_View_', "Rea's Wood"], ['Toome_AquaTROLL_Metrics_View', 'Toome'], ['Washing_Bay_AquaTROLL_Metrics_View', 'Washing Bay']];
var LAT = 54.62, LON = -6.41;
/* One point roughly in the middle of each basin, for rainfall. */
var BASINS = [['Blackwater', 54.40, -6.85], ['Upper Bann', 54.33, -6.28], ['Main', 54.88, -6.30], ['Six Mile Water', 54.73, -6.05], ['Ballinderry', 54.65, -6.85], ['Moyola', 54.80, -6.75]];
function iso(d) { return d.toISOString().slice(0, 10); }
function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }
async function meteo(path) {
  var hosts = ['https://archive-api.open-meteo.com/v1/archive', 'https://historical-forecast-api.open-meteo.com/v1/forecast'], last;
  for (var i = 0; i < hosts.length; i++) {
    try { var r = await fetch(hosts[i] + path); if (r.ok) return { j: await r.json(), host: i }; last = 'status ' + r.status + ' ' + (await r.text()).slice(0, 120); } catch (e) { last = String(e); }
  }
  throw new Error('weather ' + last);
}
async function weather(from, to) {
  var got = await meteo('?latitude=' + LAT + '&longitude=' + LON + '&start_date=' + from + '&end_date=' + to + '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,sunshine_duration,shortwave_radiation&wind_speed_unit=mph&timezone=UTC');
  var h = got.j.hourly, by = {}, order = [];
  h.time.forEach(function (tm, i) {
    var d = tm.slice(0, 10), o = by[d]; if (!o) { o = by[d] = { t: [], w: [], vx: 0, vy: 0, r: 0, s: 0, rad: 0 }; order.push(d); }
    var t = h.temperature_2m[i], w = h.wind_speed_10m[i], dir = h.wind_direction_10m[i];
    if (typeof t === 'number') o.t.push(t);
    if (typeof w === 'number' && typeof dir === 'number') { o.w.push(w); o.vx += w * Math.sin(dir * Math.PI / 180); o.vy += w * Math.cos(dir * Math.PI / 180); }
    o.r += h.precipitation[i] || 0; o.s += (h.sunshine_duration[i] || 0) / 3600; o.rad += (h.shortwave_radiation[i] || 0) * 3600 / 1e6;
  });
  var mean = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
  return { source: got.host ? 'Open-Meteo historical forecast archive' : 'Open-Meteo ERA5 archive', days: order.map(function (d) {
    var o = by[d], dir = (Math.atan2(o.vx, o.vy) * 180 / Math.PI + 360) % 360, calm = o.w.filter(function (x) { return x < 6; }).length;
    return { date: d, t: r1(mean(o.t)), tmax: r1(Math.max.apply(null, o.t)), w: r1(mean(o.w)), wmax: r1(Math.max.apply(null, o.w)), dir: Math.round(dir), calmHours: calm, rain: r1(o.r), sun: r1(o.s), rad: r1(o.rad) };
  }) };
}
async function basinRain(from, to) {
  var got = await meteo('?latitude=' + BASINS.map(function (b) { return b[1]; }).join(',') + '&longitude=' + BASINS.map(function (b) { return b[2]; }).join(',') + '&start_date=' + from + '&end_date=' + to + '&daily=precipitation_sum&timezone=UTC');
  var list = Array.isArray(got.j) ? got.j : [got.j];
  return { dates: list[0].daily.time, basins: list.map(function (x, k) { return { name: BASINS[k][0], mm: x.daily.precipitation_sum.map(r1) }; }) };
}
async function buoy(svc, name, from, to) {
  var url = ORG + '/' + svc + '/FeatureServer/1/query', rows = [], styles = [function (d) { return "TIMESTAMP '" + d + " 00:00:00'"; }, function (d) { return "'" + d + "'"; }], err = null;
  for (var s = 0; s < styles.length && !rows.length; s++) {
    try {
      for (var page = 0; page < 12; page++) {
        var where = 'Date >= ' + styles[s](from) + ' AND Date <= ' + styles[s](to);
        var r = await fetch(url + '?where=' + encodeURIComponent(where) + '&outFields=Metric_Value,Metric_Type,Date&orderByFields=Date&resultOffset=' + rows.length + '&resultRecordCount=2000&f=json');
        var j = await r.json(); if (j.error) throw new Error(j.error.message);
        var f = j.features || []; f.forEach(function (x) { rows.push(x.attributes); });
        if (!j.exceededTransferLimit || !f.length) break;
      }
    } catch (e) { err = String(e.message); }
  }
  var by = {};
  rows.forEach(function (a) {
    if (typeof a.Metric_Value !== 'number' || !isFinite(a.Metric_Value) || !a.Date) return;
    var d = iso(new Date(a.Date)), m = by[a.Metric_Type] = by[a.Metric_Type] || {}, o = m[d] = m[d] || { s: 0, n: 0, max: -Infinity };
    o.s += a.Metric_Value; o.n++; if (a.Metric_Value > o.max) o.max = a.Metric_Value;
  });
  var metrics = {};
  Object.keys(by).forEach(function (k) { metrics[k] = Object.keys(by[k]).sort().map(function (d) { var o = by[k][d]; return [d, +(o.s / o.n).toFixed(2), +o.max.toFixed(2)]; }); });
  return { name: name, rows: rows.length, error: rows.length ? undefined : err, metrics: metrics };
}
module.exports = async function (req, res) {
  var q = req.query || {}, date = String(q.date || '');
  if (!/^20\d\d-\d\d-\d\d$/.test(date) || isNaN(Date.parse(date))) { res.status(400).json({ ok: false, error: 'bad_date' }); return; }
  var before = Math.min(120, Math.max(7, +q.before || 75)), after = Math.min(30, Math.max(0, +q.after || 10));
  var t0 = Date.parse(date + 'T00:00:00Z'), from = iso(new Date(t0 - before * 86400000)), to = iso(new Date(Math.min(Date.now() - 6 * 86400000, t0 + after * 86400000)));
  var safe = function (p) { return p.catch(function (e) { return { error: String(e && e.message).slice(0, 160) }; }); };
  var got = await Promise.all([safe(weather(from, to)), safe(basinRain(from, to))].concat(q.buoys === '0' ? [] : BUOYS.map(function (b) { return safe(buoy(b[0], b[1], from, to)); })));
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).json({ ok: true, date: date, from: from, to: to, weather: got[0], rain: got[1], buoys: got.slice(2) });
};
