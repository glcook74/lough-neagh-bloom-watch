/* Daily weather over the lough for every year since 2023, for the Forecast tab's hindcast.
   The page itself runs the bloom score and compares it with the satellite record. */
var LAT = 54.62, LON = -6.41, FIRST = 2023;
function iso(d) { return d.toISOString().slice(0, 10); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
function ranks(a) { var idx = a.map(function (v, i) { return [v, i]; }).sort(function (x, y) { return x[0] - y[0]; }), r = [], i = 0; while (i < idx.length) { var j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (var k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function spearman(a, b) { if (a.length < 5) return null; var x = ranks(a), y = ranks(b), mx = mean(x), my = mean(y), s = 0, sx = 0, sy = 0; for (var i = 0; i < x.length; i++) { s += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) * (x[i] - mx); sy += (y[i] - my) * (y[i] - my); } return sx && sy ? s / Math.sqrt(sx * sy) : null; }

async function weatherYear(year, lastDay) {
  var from = year + '-01-01', to = year + '-12-31'; if (to > lastDay) to = lastDay; if (from > to) return [];
  var q = '?latitude=' + LAT + '&longitude=' + LON + '&start_date=' + from + '&end_date=' + to + '&hourly=temperature_2m,wind_speed_10m,precipitation,sunshine_duration&wind_speed_unit=mph&timezone=UTC';
  var hosts = ['https://archive-api.open-meteo.com/v1/archive', 'https://historical-forecast-api.open-meteo.com/v1/forecast'], j = null;
  for (var i = 0; i < hosts.length && !j; i++) { try { var r = await fetch(hosts[i] + q); if (r.ok) j = await r.json(); } catch (e) {} }
  if (!j) throw new Error('weather_' + year);
  var h = j.hourly, by = {}, order = [];
  h.time.forEach(function (tm, i) { var d = tm.slice(0, 10), o = by[d]; if (!o) { o = by[d] = { t: [], w: [], r: 0, s: 0 }; order.push(d); }
    if (typeof h.temperature_2m[i] === 'number') o.t.push(h.temperature_2m[i]); if (typeof h.wind_speed_10m[i] === 'number') o.w.push(h.wind_speed_10m[i]);
    o.r += h.precipitation[i] || 0; o.s += (h.sunshine_duration[i] || 0) / 3600; });
  return order.filter(function (d) { return by[d].t.length && by[d].w.length; }).map(function (d) { var o = by[d]; return { date: d, t: mean(o.t), tmax: Math.max.apply(null, o.t), w: mean(o.w), r: o.r, s: o.s }; });
}
function r1(v) { return Math.round(v * 10) / 10; }
module.exports = async function (req, res) {
  try {
    var now = new Date(), lastDay = iso(new Date(now - 6 * 86400000)), thisYear = now.getUTCFullYear(), years = [];
    for (var y = FIRST; y <= thisYear; y++) years.push(y);
    var got = await Promise.all(years.map(function (yy) { return weatherYear(yy, lastDay); })), out = {};
    /* each day: [month-day, mean air, warmest air, mean wind mph, rain mm, sun hours] */
    years.forEach(function (yy, i) { out[yy] = got[i].map(function (d) { return [d.date.slice(5), r1(d.t), r1(d.tmax), r1(d.w), r1(d.r), r1(d.s)]; }); });
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=43200, stale-while-revalidate=604800');
    res.status(200).json({ ok: true, madeOn: iso(now), weatherTo: lastDay, source: 'Open-Meteo ERA5 archive', years: out });
  } catch (e) {
    console.warn('Outlook weather failed:', String(e && e.message));
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message).slice(0, 60) });
  }
};
