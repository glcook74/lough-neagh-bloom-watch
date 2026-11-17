/* MODEL-START */
/* Illustrative bloom-risk model for Lough Neagh. Indicative only, not calibrated. */
var ZONES = [
{ id: 'toome',   name: 'Toome Bay',         short: 'Toome',    bearing: 330, shelter: 1.05, x: 128, y: 92 },
{ id: 'north',   name: 'Cranfield shore',   short: 'Cranfield',bearing: 0,   shelter: 1.0,  x: 180, y: 84 },
{ id: 'antrim',  name: 'Antrim Bay',        short: 'Antrim',   bearing: 45,  shelter: 1.1,  x: 258, y: 98 },
{ id: 'east',    name: 'Sandy Bay',         short: 'Sandy Bay',bearing: 90,  shelter: 1.0,  x: 266, y: 215 },
{ id: 'kinnego', name: 'Kinnego Bay',       short: 'Kinnego',  bearing: 140, shelter: 1.1,  x: 236, y: 334 },
{ id: 'south',   name: 'Bannfoot shore',    short: 'Bannfoot', bearing: 180, shelter: 1.0,  x: 182, y: 348 },
{ id: 'washing', name: 'Washing Bay',       short: 'Washing Bay', bearing: 225, shelter: 1.05, x: 116, y: 322 },
{ id: 'west',    name: 'Ardboe shore',      short: 'Ardboe',   bearing: 270, shelter: 1.0,  x: 106, y: 196 }
];
function mulberry32(a) {
return function () {
a |= 0; a = a + 0x6D2B79F5 | 0;
var t = Math.imul(a ^ a >>> 15, 1 | a);
t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
}
function gauss(rand) {
var u = 0, v = 0;
while (u === 0) u = rand();
while (v === 0) v = rand();
return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, k) { return a + (b - a) * k; }
/* 30 days of history (index 0..29) plus a 5-day outlook (index 30..34). */
function makeWeather(key) {
var rand = mulberry32(key === 'A' ? 11 : key === 'B' ? 23 : 37);
var n = function (s) { return (rand() * 2 - 1) * s; };
var days = [];
for (var d = 0; d < 35; d++) {
var w;
if (key === 'A') {
w = { t: 15.5 + n(1.5), w: 14 + n(4), dir: 250 + n(25), r: rand() < 0.6 ? 1 + rand() * 6 : 0, s: 4 + n(1.5) };
} else if (key === 'B') {
if (d < 12) {
w = { t: 14 + n(1), w: 12 + n(3), dir: 230 + n(20), r: rand() < 0.85 ? 6 + rand() * 10 : 1, s: 2.5 + n(0.8) };
} else if (d < 30) {
var k = (d - 12) / 17;
w = { t: lerp(18, 25, k) + n(0.8), w: 4 + n(1.5), dir: 220 + n(20), r: 0, s: 11.5 + n(1.5) };
} else {
w = { t: 25 + n(0.8), w: 4 + n(1), dir: 225 + n(10), r: 0, s: 11 + n(1) };
}
} else {
if (d < 18) {
w = { t: 20 + n(1), w: 9 + n(2), dir: 240 + n(20), r: rand() < 0.25 ? 1 + rand() * 2 : 0, s: 7 + n(1) };
} else if (d < 22) {
w = { t: 16 + n(0.8), w: 20 + n(3), dir: 270 + n(15), r: 18 + rand() * 10, s: 1 + rand() };
} else if (d < 30) {
var k2 = (d - 22) / 7;
w = { t: lerp(21, 23, k2) + n(0.6), w: 5 + n(1.5), dir: lerp(300, 345, k2) + n(8), r: 0, s: 9 + n(1) };
} else {
var k3 = (d - 30) / 4;
w = { t: 23.5 + n(0.6), w: 5 + n(1), dir: lerp(10, 40, k3) + n(6), r: 0, s: 10 + n(1) };
}
}
w.w = Math.max(0.5, w.w); w.s = clamp(w.s, 0, 15); w.dir = (w.dir + 360) % 360;
days.push(w);
}
return days;
}
var START = { A: { tw: 14, b: 0.06 }, B: { tw: 13, b: 0.06 }, C: { tw: 16.5, b: 0.06 } };
/* One step of the lough state. s = { tw, n, b } */
function step(s, w) {
var tw = s.tw + 0.18 * ((w.t - 2.5) - s.tw);
var nut = s.n + 0.06 * (0.55 - s.n) + 0.012 * w.r + (w.w > 15 ? 0.01 * (w.w - 15) : 0);
nut = clamp(nut, 0, 1);
var fT = clamp((tw - 12) / 8, 0, 1.15);
var fL = clamp(w.s / 10, 0.2, 1.1);
var fM = w.w <= 6 ? 1 : Math.max(0.15, 1 - (w.w - 6) / 12);
var grow = 0.099 * fT * fL * fM * (0.5 + 0.6 * nut);   /* 0.099 = doubling in 7 days at best */
var loss = 0.035 + (w.w > 14 ? 0.03 : 0) + (w.r > 10 ? 0.02 : 0);
var b = clamp(s.b + s.b * grow * (1 - s.b) * 4 - s.b * loss, 0.02, 1);
var calm = w.w <= 5 ? 1 : Math.max(0.2, 1 - (w.w - 5) / 12);
return { tw: tw, n: nut, b: b, scum: b * calm };
}
function onshore(zone, dir) {
var toward = (dir + 180) % 360;
var diff = (zone.bearing - toward) * Math.PI / 180;
return Math.max(0, Math.cos(diff));
}
function zoneRisk(zone, scum, dirToday, dirYesterday) {
var on = 0.65 * onshore(zone, dirToday) + 0.35 * onshore(zone, dirYesterday);
return clamp(scum * (0.3 + 0.85 * on) * zone.shelter * 1.25, 0, 1);
}
function level(r) { return r >= 0.5 ? 2 : r >= 0.25 ? 1 : 0; }
function runScenario(key) {
var wx = makeWeather(key);
var s = { tw: START[key].tw, n: 0.55, b: START[key].b };
var hist = [];
for (var d = 0; d < 30; d++) {
s = step(s, wx[d]);
hist.push({ tw: s.tw, n: s.n, b: s.b, scum: s.scum });
}
var today = ZONES.map(function (z) { return zoneRisk(z, s.scum, wx[29].dir, wx[28].dir); });
/* 5-day outlook: 40 members, weather error grows with lead time. */
var rand = mulberry32(key.charCodeAt(0) * 97);
var M = 40, out = [];
for (var k = 0; k < 5; k++) out.push(ZONES.map(function () { return []; }));
var bSeries = [[], [], [], [], []];
for (var m = 0; m < M; m++) {
var ms = { tw: s.tw, n: s.n, b: s.b };
var prevDir = wx[29].dir;
for (var k4 = 0; k4 < 5; k4++) {
var base = wx[30 + k4], lead = k4 + 1;
var pw = {
t: base.t + gauss(rand) * 0.5 * lead,
w: Math.max(0.5, base.w + gauss(rand) * 0.9 * lead),
dir: (base.dir + gauss(rand) * 12 * lead + 720) % 360,
r: base.r,
s: clamp(base.s + gauss(rand) * 0.6 * lead, 0, 15)
};
ms = step(ms, pw);
bSeries[k4].push(ms.b);
for (var z = 0; z < ZONES.length; z++) out[k4][z].push(zoneRisk(ZONES[z], ms.scum, pw.dir, prevDir));
prevDir = pw.dir;
}
}
var q = function (arr, p) { var a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
var outlook = out.map(function (dayArr, k5) {
return {
wind: wx[30 + k5],
bMid: q(bSeries[k5], 0.5), bLo: q(bSeries[k5], 0.1), bHi: q(bSeries[k5], 0.9),
zones: dayArr.map(function (arr) {
var pHigh = arr.filter(function (v) { return v >= 0.5; }).length / arr.length;
var pMed = arr.filter(function (v) { return v >= 0.25; }).length / arr.length;
var lv = pHigh >= 0.5 ? 2 : (pMed >= 0.5 || pHigh >= 0.2) ? 1 : 0;
return { lv: lv, pHigh: pHigh, pMed: pMed, lo: q(arr, 0.1), mid: q(arr, 0.5), hi: q(arr, 0.9) };
})
};
});
return { key: key, wx: wx, hist: hist, today: today, outlook: outlook };
}
