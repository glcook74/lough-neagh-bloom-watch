/* Hindcast and seasonal outlook. Runs a simple weather-driven bloom score over every year since 2023,
   tunes it on the earlier years, tests it on the latest year it has not seen, and compares it with the
   Sentinel-2 algae index. Then uses each past summer as a "what if 2027 had this weather" scenario.
   ?summary=1 leaves out the weekly series. */
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
/* Whole-lough index for each usable satellite pass, from this site's own statistics feed. */
async function satellite(host, years) {
  var jobs = []; years.forEach(function (y) { jobs.push([y, 1]); jobs.push([y, 2]); });
  var got = await Promise.all(jobs.map(function (jb) { return fetch('https://' + host + '/api/satstats?year=' + jb[0] + '&half=' + jb[1]).then(function (r) { return r.json(); }).catch(function () { return null; }); }));
  var days = {}, missing = 0; got.forEach(function (g) { if (!g || !g.ok) { missing++; return; } g.days.forEach(function (d) { days[d.date] = d.z; }); });
  var dates = Object.keys(days).sort(), zmax = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  dates.forEach(function (d) { days[d].forEach(function (z, k) { if (z && z[2] > zmax[k]) zmax[k] = z[2]; }); });
  var all = zmax.reduce(function (a, b) { return a + b; }, 0), out = [];
  dates.forEach(function (d) { var n = 0, m = 0, h = 0; days[d].forEach(function (x, k) { if (!x || x[2] < 0.3 * zmax[k]) return; n += x[2]; m += x[0] * x[2]; h += x[1] * x[2]; }); if (n >= 0.4 * all) out.push({ date: d, m: m / n, h: h / n }); });
  return { passes: out, missing: missing };
}
/* The score. Algae build up on warm, bright, light-wind days and are knocked back by wind; calm brings them to the surface. */
function run(days, p) {
  var tw = 6, b = 0.02, out = [], prevW = 10;
  days.forEach(function (d) {
    tw += 0.15 * ((d.t + p.off) - tw);
    var fT = clamp((tw - p.t0) / (22 - p.t0), 0, 1.2), fL = clamp(d.s / 12, 0.2, 1), fM = d.w <= 7 ? 1 : Math.max(0.2, 1 - (d.w - 7) / 12);
    b = clamp(b + b * p.r * fT * fL * fM * (1 - b) - b * (p.loss + (d.w > 15 ? 0.04 : 0)), 0.02, 1);
    var w2 = (d.w + prevW) / 2, surf = w2 <= 5 ? 1 : Math.max(0.25, 1 - (w2 - 5) / 10); prevW = d.w;
    out.push({ date: d.date, tw: tw, b: b, score: b * surf });
  });
  return out;
}
function inSeason(date) { var m = +date.slice(5, 7); return m >= 6 && m <= 10; }
function pairs(scoreBy, passes, seasonOnly) { var a = [], b = []; passes.forEach(function (s) { if (seasonOnly && !inSeason(s.date)) return; if (scoreBy[s.date] != null) { a.push(scoreBy[s.date]); b.push(s.m); } }); return [a, b]; }
function evaluate(scoreBy, passes, thr) {
  var all = pairs(scoreBy, passes, false), sea = pairs(scoreBy, passes, true), hits = 0, high = 0, alarms = 0, falseAl = 0, low = 0;
  passes.forEach(function (s) { if (!inSeason(s.date) || scoreBy[s.date] == null) return; var isHigh = s.h >= 0.5, alarm = scoreBy[s.date] >= thr; if (isHigh) { high++; if (alarm) hits++; } else { low++; if (alarm) falseAl++; } if (alarm) alarms++; });
  return { passes: all[0].length, seasonPasses: sea[0].length, rho: spearman(all[0], all[1]), rhoSeason: spearman(sea[0], sea[1]), highDays: high, caught: hits, lowDays: low, falseAlarms: falseAl };
}
function r3(v) { return v == null ? null : Math.round(v * 1000) / 1000; }

module.exports = async function (req, res) {
  try {
    var now = new Date(), lastDay = iso(new Date(now - 6 * 86400000)), thisYear = now.getUTCFullYear(), years = [];
    for (var y = FIRST; y <= thisYear; y++) years.push(y);
    var host = req.headers.host || 'lough-neagh-bloom-watch.vercel.app';
    var got = await Promise.all([satellite(host, years)].concat(years.map(function (yy) { return weatherYear(yy, lastDay); })));
    var sat = got[0], wx = {}; years.forEach(function (yy, i) { wx[yy] = got[i + 1]; });
    var passesOf = function (list) { return sat.passes.filter(function (s) { return list.indexOf(+s.date.slice(0, 4)) >= 0; }); };
    /* tune on all years but the latest, test on the latest */
    var testYear = years[years.length - 1], trainYears = years.slice(0, -1), grid = [];
    [0, 2].forEach(function (off) { [0.15, 0.25, 0.35].forEach(function (r) { [0.02, 0.04].forEach(function (loss) { [12, 14].forEach(function (t0) { grid.push({ off: off, r: r, loss: loss, t0: t0 }); }); }); }); });
    var scoreFor = function (p, list) { var by = {}; list.forEach(function (yy) { run(wx[yy], p).forEach(function (d) { by[d.date] = d.score; }); }); return by; };
    var best = null; grid.forEach(function (p) { var pr = pairs(scoreFor(p, trainYears), passesOf(trainYears), true), rho = spearman(pr[0], pr[1]); if (rho != null && (!best || rho > best.rho)) best = { p: p, rho: rho }; });
    var P = best.p, byAll = scoreFor(P, years);
    /* alarm level: the score that best separates high days from the rest in the training years */
    var tr = passesOf(trainYears).filter(function (s) { return inSeason(s.date) && byAll[s.date] != null; }), cands = tr.map(function (s) { return byAll[s.date]; }).sort(function (a, b) { return a - b; }), thr = cands[Math.floor(cands.length / 2)] || 0.1, bestJ = -9;
    cands.forEach(function (c) { var hi = 0, hit = 0, lo = 0, fa = 0; tr.forEach(function (s) { if (s.h >= 0.5) { hi++; if (byAll[s.date] >= c) hit++; } else { lo++; if (byAll[s.date] >= c) fa++; } }); if (!hi || !lo) return; var J = hit / hi - fa / lo; if (J > bestJ) { bestJ = J; thr = c; } });
    /* a baseline to beat: just knowing the time of year */
    var monthMean = {}; for (var mo = 1; mo <= 12; mo++) { var v = passesOf(trainYears).filter(function (s) { return +s.date.slice(5, 7) === mo; }).map(function (s) { return s.m; }); monthMean[mo] = v.length ? mean(v) : 0; }
    var clim = {}; sat.passes.forEach(function (s) { clim[s.date] = monthMean[+s.date.slice(5, 7)]; });
    var skill = { train: Object.assign({ years: trainYears }, evaluate(byAll, passesOf(trainYears), thr)), test: Object.assign({ years: [testYear] }, evaluate(byAll, passesOf([testYear]), thr)),
      calendarOnly: { test: evaluate(clim, passesOf([testYear]), 1e9).rhoSeason, train: evaluate(clim, passesOf(trainYears), 1e9).rhoSeason } };
    ['train', 'test'].forEach(function (k) { skill[k].rho = r3(skill[k].rho); skill[k].rhoSeason = r3(skill[k].rhoSeason); }); skill.calendarOnly.test = r3(skill.calendarOnly.test); skill.calendarOnly.train = r3(skill.calendarOnly.train);
    var perYear = years.map(function (yy) {
      var days = wx[yy], series = run(days, P), summer = days.filter(function (d) { return inSeason(d.date); }), ps = passesOf([yy]), sea = ps.filter(function (s) { return inSeason(s.date); });
      var above = ps.filter(function (s) { return s.m >= 0.1; }), pk = ps.slice().sort(function (a, b) { return b.m - a.m; })[0];
      var alarmDays = series.filter(function (d) { return d.score >= thr; }), mpk = series.slice().sort(function (a, b) { return b.score - a.score; })[0];
      var weekly = []; if (!req.query.summary) for (var i = 0; i + 6 < series.length; i += 7) { var wk = series.slice(i, i + 7); weekly.push([wk[0].date.slice(5), +mean(wk.map(function (d) { return d.score; })).toFixed(3), +mean(wk.map(function (d) { return d.tw; })).toFixed(1)]); }
      return { year: yy, complete: days.length >= 300 || (days.length && days[days.length - 1].date >= yy + '-10-31'),
        summer: summer.length ? { days: summer.length, meanTemp: +mean(summer.map(function (d) { return d.t; })).toFixed(1), warmCalmDays: summer.filter(function (d) { return d.tmax >= 19 && d.w < 9 && d.s >= 9; }).length, calmDays: summer.filter(function (d) { return d.w < 6; }).length, rain: Math.round(summer.reduce(function (s, d) { return s + d.r; }, 0)), sunHours: Math.round(summer.reduce(function (s, d) { return s + d.s; }, 0)) } : null,
        satellite: { usable: ps.length, seasonUsable: sea.length, highDays: sea.filter(function (s) { return s.h >= 0.5; }).length, first: above.length ? above[0].date : null, last: above.length ? above[above.length - 1].date : null, peak: pk ? { date: pk.date, m: r3(pk.m) } : null, seasonMean: r3(mean(sea.map(function (s) { return s.m; }))) },
        model: { alarmDays: alarmDays.length, first: alarmDays.length ? alarmDays[0].date : null, last: alarmDays.length ? alarmDays[alarmDays.length - 1].date : null, peak: mpk ? { date: mpk.date, score: r3(mpk.score) } : null, seasonTotal: r3(series.filter(function (d) { return inSeason(d.date); }).reduce(function (s, d) { return s + d.score; }, 0)) },
        weekly: weekly, passes: req.query.summary ? undefined : ps.map(function (s) { return [s.date.slice(5), +s.m.toFixed(3), +s.h.toFixed(2)]; }) };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=604800');
    res.status(200).json({ ok: true, madeOn: iso(now), weatherTo: lastDay, params: P, trainRho: r3(best.rho), alarmLevel: r3(thr), satelliteHalvesMissing: sat.missing, skill: skill, years: perYear });
  } catch (e) {
    console.warn('Outlook failed:', String(e && e.message));
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message).slice(0, 60) });
  }
};
