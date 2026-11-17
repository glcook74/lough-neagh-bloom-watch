(function () {
var RIVERS = [
{ name: 'Blackwater',     t: 173, mx: 136, my: 348, sx: 36,  sy: 424, lx: 8,   ly: 360, a: 'start' },
{ name: 'Main',           t: 74,  mx: 212, my: 86,  sx: 226, sy: 6,   lx: 236, ly: 44,  a: 'start' },
{ name: 'Upper Bann',     t: 66,  mx: 192, my: 356, sx: 222, sy: 426, lx: 232, ly: 414, a: 'start' },
{ name: 'Ballinderry',    t: 37,  mx: 99,  my: 165, sx: 6,   sy: 150, lx: 8,   ly: 142, a: 'start' },
{ name: 'Six Mile Water', t: 29,  mx: 272, my: 100, sx: 354, sy: 78,  lx: 352, ly: 70,  a: 'end' },
{ name: 'Moyola',         t: 29,  mx: 116, my: 97,  sx: 14,  sy: 56,  lx: 8,   ly: 48,  a: 'start' }
];
var SMALL = [
{ name: 'Crumlin', mx: 273, my: 168, sx: 354, sy: 160 },
{ name: 'Glenavy', mx: 273, my: 198, sx: 354, sy: 206 }
];
var TOWNS = [
{ n: 'Toome', x: 112, y: 74, a: 'end' }, { n: 'Antrim', x: 282, y: 92, a: 'start' },
{ n: 'Ballyronan', x: 90, y: 128, a: 'end' }, { n: 'Ardboe', x: 88, y: 200, a: 'end' },
{ n: 'Maghery', x: 122, y: 368, a: 'end' }, { n: 'Lurgan', x: 262, y: 366, a: 'start' },
{ n: 'Crumlin', x: 290, y: 150, a: 'start' }
];
var ZLAB = {
toome: [112, 78, 'end'], north: [180, 64, 'middle'], antrim: [276, 86, 'start'], east: [284, 219, 'start'],
kinnego: [254, 348, 'start'], south: [165, 378, 'middle'], washing: [98, 342, 'end'], west: [88, 200, 'end']
};
var STAKE = [
{ n: 'Toome eel fishery', x: 132, y: 86, zone: 'toome', type: 'fishery', note: 'Home of the eel co-operative, where the Lower Bann leaves the lough' },
{ n: 'Moyola water intake', x: 113, y: 106, zone: 'toome', type: 'intake', note: 'NI Water draws raw water here' },
{ n: 'Cranfield shore', x: 180, y: 80, zone: 'north', type: 'marina', note: 'Shore anglers and small boats' },
{ n: 'Antrim Lough Shore Park', x: 266, y: 94, zone: 'antrim', type: 'bathing', note: 'Walkers, dogs, paddlers, and the Rea\'s Wood monitoring buoy' },
{ n: 'Dunore Point water intake', x: 270, y: 142, zone: 'east', type: 'intake', note: 'NI Water abstraction tower on the eastern shore' },
{ n: 'Sandy Bay and Rams Island', x: 268, y: 214, zone: 'east', type: 'marina', note: 'Boat trips and moorings' },
{ n: 'Castor Bay water intake', x: 250, y: 316, zone: 'kinnego', type: 'intake', note: 'Supplies around 324,000 people' },
{ n: 'Kinnego Marina and Oxford Island', x: 234, y: 338, zone: 'kinnego', type: 'bathing', note: 'Sailing, watersports and a nature reserve' },
{ n: 'Bannfoot', x: 190, y: 354, zone: 'south', type: 'marina', note: 'Where the Upper Bann comes in' },
{ n: 'Washing Bay', x: 112, y: 324, zone: 'washing', type: 'bathing', note: 'Open water swimmers, and a DAERA monitoring buoy' },
{ n: 'Ardboe and Ballyronan', x: 101, y: 190, zone: 'west', type: 'fishery', note: 'Fishing boats and Ballyronan Marina' }
];
var DO = {
bathing: 'Signs up at the shore: no swimming or paddling, keep dogs out of the water.',
intake: 'NI Water steps up testing of raw water at the intake.',
fishery: 'Fishermen told before the boats go out.',
marina: 'Boat users and clubs warned.'
};
var STEPS = ['The lough', 'Beneath the surface', 'What flows in', 'What is at stake', 'The last 30 days', 'The next 5 days', 'Who needs to know'];
var LV = ['Low', 'Medium', 'High'];
var COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function compass(deg) { return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
var state = { scn: 'B', step: 0, day: 0 };
var cache = {};
function run() { return cache[state.scn] || (cache[state.scn] = runScenario(state.scn)); }
function $(id) { return document.getElementById(id); }
function show(id, on) { var el = $(id); if (on) el.removeAttribute('hidden'); else el.setAttribute('hidden', ''); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function zoneById(id) { for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return i; return -1; }
/* ---------- static map layers ---------- */
function buildMap() {
var h = '<path d="M128,84 L118,6" fill="none" stroke="var(--water-ink)" stroke-width="3" stroke-dasharray="5 4" marker-end="url(#ah)" opacity="0.8"/>';
RIVERS.forEach(function (r) {
var sw = (1.5 + r.t / 173 * 6).toFixed(1);
h += '<line x1="' + r.sx + '" y1="' + r.sy + '" x2="' + r.mx + '" y2="' + r.my + '" stroke="var(--water-ink)" stroke-width="' + sw + '" stroke-linecap="round" opacity="0.75"/>';
});
SMALL.forEach(function (r) {
h += '<line x1="' + r.sx + '" y1="' + r.sy + '" x2="' + r.mx + '" y2="' + r.my + '" stroke="var(--water-ink)" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>';
});
h += '<g id="gRiverLabels" hidden>';
RIVERS.forEach(function (r) {
h += '<text class="mt b" x="' + r.lx + '" y="' + r.ly + '" text-anchor="' + r.a + '">' + r.name + ' <tspan class="ct">' + r.t + ' t</tspan></text>';
});
h += '<text class="mt dim" x="352" y="152" text-anchor="end">Crumlin</text><text class="mt dim" x="352" y="222" text-anchor="end">Glenavy</text>';
h += '<text class="mt dim" x="134" y="28" text-anchor="start">Lower Bann out</text></g>';
$('gRivers').innerHTML = h;
$('gTowns').innerHTML = TOWNS.map(function (t) {
return '<text class="mt dim" x="' + t.x + '" y="' + t.y + '" text-anchor="' + t.a + '">' + t.n + '</text>';
}).join('');
$('gStake').innerHTML = STAKE.map(function (s, i) {
var fill = s.type === 'intake' ? 'var(--high)' : s.type === 'fishery' ? 'var(--med)' : 'var(--accent)';
return '<g><circle cx="' + s.x + '" cy="' + s.y + '" r="8" fill="' + fill + '" stroke="var(--surface)" stroke-width="1.5"/>' +
'<text class="zl" x="' + s.x + '" y="' + (s.y + 3.5) + '">' + (i + 1) + '</text></g>';
}).join('') + '<text class="mt wat" x="185" y="208" text-anchor="middle">eel and pollan</text><text class="mt wat" x="185" y="221" text-anchor="middle">fished lough-wide</text>';
$('gZones').innerHTML = ZONES.map(function (z) {
var l = ZLAB[z.id];
return '<g class="zone" id="z_' + z.id + '"><circle cx="' + z.x + '" cy="' + z.y + '" r="11" fill="var(--low)" stroke="var(--surface)" stroke-width="2"/>' +
'<text class="zl" x="' + z.x + '" y="' + (z.y + 3.5) + '">L</text>' +
'<text class="mt b" x="' + l[0] + '" y="' + l[1] + '" text-anchor="' + l[2] + '">' + z.short + '</text></g>';
}).join('');
}
function paintZones(levels) {
var fills = ['var(--low)', 'var(--med)', 'var(--high)'];
ZONES.forEach(function (z, i) {
var g = $('z_' + z.id);
g.querySelector('circle').setAttribute('fill', fills[levels[i]]);
g.querySelector('.zl').textContent = LV[levels[i]].charAt(0);
});
}
function setWind(w) {
var toward = (w.dir + 180) % 360;
$('windArrow').style.transform = 'rotate(' + toward.toFixed(0) + 'deg)';
$('windText').textContent = 'surface drift';
}
/* ---------- scene panels ---------- */
function chart30(r) {
var W = 340, x = function (i) { return 8 + i * (324 / 29); };
var rows = [
{ label: 'Water temperature', unit: '°C', get: function (d, i) { return r.hist[i].tw; }, min: 10, max: 22, kind: 'line', dec: 1 },
{ label: 'Wind (dashed: calm, under 6 mph)', unit: 'mph', get: function (d) { return d.w; }, min: 0, max: 26, kind: 'line', dec: 0, guide: 6, gtext: 'calm below 6' },
{ label: 'Rain', unit: 'mm', get: function (d) { return d.r; }, min: 0, max: 30, kind: 'bar', dec: 0 },
{ label: 'Bloom index', unit: '', get: function (d, i) { return r.hist[i].b; }, min: 0, max: 1, kind: 'area', dec: 2, guides: [0.25, 0.5] }
];
var rowH = 40, gap = 24, top = 14, h = '';
rows.forEach(function (row, k) {
var y0 = top + k * (rowH + gap), yb = y0 + rowH;
var y = function (v) { return yb - (Math.max(row.min, Math.min(row.max, v)) - row.min) / (row.max - row.min) * rowH; };
var vals = []; for (var i = 0; i < 30; i++) vals.push(row.get(r.wx[i], i));
var last = vals[29];
h += '<text class="ct strong" x="8" y="' + (y0 - 4) + '">' + row.label + '</text>';
h += '<text class="ct" x="332" y="' + (y0 - 4) + '" text-anchor="end">today ' + last.toFixed(row.dec) + (row.unit ? ' ' + row.unit : '') + '</text>';
h += '<line x1="8" y1="' + yb + '" x2="332" y2="' + yb + '" stroke="var(--line)" stroke-width="1"/>';
if (row.guide != null) {
h += '<line x1="8" y1="' + y(row.guide) + '" x2="332" y2="' + y(row.guide) + '" stroke="var(--muted)" stroke-width="0.8" stroke-dasharray="3 3"/>';
}
if (row.guides) row.guides.forEach(function (g, gi) {
h += '<line x1="8" y1="' + y(g) + '" x2="332" y2="' + y(g) + '" stroke="' + (gi ? 'var(--high)' : 'var(--med)') + '" stroke-width="0.9" stroke-dasharray="3 3"/>';
});
if (row.kind === 'bar') {
vals.forEach(function (v, i) {
if (v > 0.05) h += '<rect x="' + (x(i) - 3.5) + '" y="' + y(v) + '" width="7" height="' + (yb - y(v)) + '" fill="var(--water-ink)" rx="1"/>';
});
} else {
var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
if (row.kind === 'area') h += '<polygon points="8,' + yb + ' ' + pts + ' 332,' + yb + '" fill="var(--low)" opacity="0.3"/>';
h += '<polyline points="' + pts + '" fill="none" stroke="' + (row.kind === 'area' ? 'var(--low)' : 'var(--water-ink)') + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
h += '<circle cx="' + x(29) + '" cy="' + y(last) + '" r="3" fill="' + (row.kind === 'area' ? 'var(--low)' : 'var(--water-ink)') + '"/>';
}
});
var H = top + rows.length * (rowH + gap);
h += '<text class="ct" x="8" y="' + (H - 6) + '">30 days ago</text><text class="ct" x="332" y="' + (H - 6) + '" text-anchor="end">today</text>';
return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Water temperature, wind, rain and bloom index over the last 30 days">' + h + '</svg>';
}
function sceneHtml(r) {
var s = state.step, h = '';
if (s === 0) {
h += '<p>Lough Neagh is big, shallow and slow to empty. Those three things explain most of what follows. It warms quickly in a hot spell, and whatever washes in stays for a long time.</p>' +
'<dl class="facts">' +
'<div><dt>Surface area</dt><dd>383 km²</dd></div><div><dt>Average depth</dt><dd>9 m</dd></div>' +
'<div><dt>Shoreline</dt><dd>about 125 km</dd></div><div><dt>Share of NI that drains into it</dt><dd>42%</dd></div>' +
'<div><dt>Time water stays in the lough</dt><dd>16 months</dd></div><div><dt>Share of NI drinking water</dt><dd>about 40%</dd></div>' +
'</dl><p class="small">Six main rivers flow in. Only one, the Lower Bann at Toome, flows out.</p>';
} else if (s === 1) {
h += '<p>The ground around the lough shapes what reaches it. Heavy clay soils to the south and west drain poorly, so rain runs off the fields quickly and takes phosphorus with it.</p>' +
'<ul class="list">' +
'<li><strong>Shallow water</strong><span class="sub">Warms fast, and a strong wind can stir the bed all the way up.</span></li>' +
'<li><strong>Phosphorus in the mud</strong><span class="sub">Decades of nutrients sit in the sediment. AFBI scientists have said they could keep feeding the lough for around 40 years.</span></li>' +
'<li><strong>Zebra mussels</strong><span class="sub">First found in 2005 and now everywhere in the lough. They filter the water clear, so sunlight reaches deeper and algae grow faster.</span></li>' +
'</ul>';
} else if (s === 2) {
var total = 0; RIVERS.forEach(function (rv) { total += rv.t; });
h += '<p>Blue-green algae feed on phosphorus. This is how much each river is estimated to carry into the lough in a year. Line thickness on the map matches.</p><div class="bars">';
RIVERS.concat([{ name: 'Smaller rivers', t: 66 }, { name: 'Straight into lough', t: 65 }]).forEach(function (rv) {
h += '<div class="bar"><span>' + rv.name + '</span><span class="track"><span class="fill" style="display:block;width:' + (rv.t / 173 * 100).toFixed(0) + '%"></span></span><span class="val">' + rv.t + ' t</span></div>';
});
h += '</div><h3>Where it comes from</h3>' +
'<div class="split" role="img" aria-label="Agriculture 61 percent, wastewater 29 percent, other 9 percent, septic tanks 1.3 percent">' +
'<span style="width:61%;background:var(--low)"></span><span style="width:29%;background:var(--water-ink)"></span><span style="width:9%;background:var(--muted)"></span><span style="width:1.3%;background:var(--med)"></span></div>' +
'<div class="legend"><span class="key"><span class="sw" style="background:var(--low)"></span>Agriculture 61%</span><span class="key"><span class="sw" style="background:var(--water-ink)"></span>Wastewater 29%</span><span class="key"><span class="sw" style="background:var(--muted)"></span>Other 9%</span><span class="key"><span class="sw" style="background:var(--med)"></span>Septic tanks 1.3%</span></div>' +
'<p class="small">AFBI modelling, 2021 reference year, tonnes of phosphorus. Provisional figures.</p>';
} else if (s === 3) {
h += '<p>These are the places and people a bloom hits first. In the model each one is tied to a stretch of shore, so a warning can name who needs to hear it.</p><ol class="list" style="list-style:none">';
STAKE.forEach(function (st, i) {
h += '<li><strong><span class="stepno">' + (i + 1) + '</span> ' + esc(st.n) + '</strong><span class="sub">' + esc(st.note) + '</span></li>';
});
h += '</ol>';
} else if (s === 4) {
var b = r.hist[29].b, lv = level(b);
var story = { A: 'Cool air and a steady breeze keep the water mixed and below the temperature algae like. The index stays flat.',
B: 'Twelve wet days wash nutrients in. Then the wind drops, the sun comes out and the water warms past 20 °C. The index doubles roughly every week.',
C: 'A warm spell starts things off. Four days of heavy rain and wind knock the bloom back but wash in a fresh load of nutrients. When the calm returns, it grows faster than before.' }[state.scn];
h += '<div class="readout"><span>Bloom index today</span><span class="badge l' + lv + '">' + b.toFixed(2) + ' ' + LV[lv] + '</span></div>' +
'<p>' + story + '</p><div class="chart">' + chart30(r) + '</div>' +
'<p class="small">The index runs from 0 to 1. It rises with warm water, sunshine, calm days and nutrients, and falls when wind mixes the lough. Dashed lines mark medium (0.25) and high (0.5). The map shows where today\'s wind is pushing the scum.</p>';
} else if (s === 5) {
var o = r.outlook;
h += '<p>Algae float, so the wind decides which shore gets the scum. Tap a day to see it on the map.</p><div class="tablewrap"><table><thead><tr><th scope="col"><span class="small">Shore</span></th>';
for (var d = 0; d < 5; d++) h += '<th scope="col"><button type="button" id="dayBtn' + d + '" data-day="' + d + '" aria-pressed="' + (d === state.day) + '">Day ' + (d + 1) + '</button></th>';
h += '</tr></thead><tbody>';
ZONES.forEach(function (z, zi) {
h += '<tr><th scope="row">' + z.short + '</th>';
for (var d2 = 0; d2 < 5; d2++) {
var c = o[d2].zones[zi];
h += '<td class="' + (d2 === state.day ? 'sel' : '') + '"><span class="cell l' + c.lv + '">' + LV[c.lv].charAt(0) + '<small>' + Math.round(c.pHigh * 100) + '%</small></span></td>';
}
h += '</tr>';
});
h += '</tbody></table></div>';
var w = o[state.day].wind, wide = 0, wz = 0;
o[4].zones.forEach(function (c, i) { if (c.hi - c.lo > wide) { wide = c.hi - c.lo; wz = i; } });
h += '<p><strong>Day ' + (state.day + 1) + ':</strong> wind from the ' + compass(w.dir) + ' at about ' + Math.round(w.w) + ' mph, pushing surface water towards the ' + compass(w.dir + 180) + ' shore.</p>' +
'<p class="small">L, M and H are low, medium and high. The percentage is the chance of high risk, from 40 runs of the model with slightly different weather. Day 1 is tomorrow. The runs agree less the further out they go: at ' + ZONES[wz].name + ' the risk score ranges from ' + o[0].zones[wz].lo.toFixed(2) + ' to ' + o[0].zones[wz].hi.toFixed(2) + ' on day 1 and from ' + o[4].zones[wz].lo.toFixed(2) + ' to ' + o[4].zones[wz].hi.toFixed(2) + ' on day 5.</p>';
} else {
var items = [];
ZONES.forEach(function (z, zi) {
var first = -1, worst = 0;
for (var d3 = 0; d3 < 5; d3++) { var l3 = r.outlook[d3].zones[zi].lv; if (l3 > worst) { worst = l3; first = d3; } }
if (worst > 0) items.push({ z: z, lv: worst, day: first });
});
items.sort(function (a, b2) { return b2.lv - a.lv || a.day - b2.day; });
var nHigh = items.filter(function (i) { return i.lv === 2; }).length;
if (!items.length) {
h += '<div class="allclear"><strong>No warnings needed.</strong> Every stretch of shore stays at low risk for the next 5 days. Routine monitoring carries on.</div>';
} else {
h += '<p>' + (nHigh ? nHigh + ' of 8 stretches of shore reach high risk in the next 5 days.' : 'No shore reaches high risk, but some need watching.') + ' The point of a forecast is the head start: the people below hear before the scum arrives.</p><ul class="actions">';
items.forEach(function (it) {
var who = STAKE.filter(function (st) { return st.zone === it.z.id; });
var when = it.day === 0 ? 'from tomorrow' : 'from day ' + (it.day + 1);
h += '<li class="l' + it.lv + '"><div class="head"><strong>' + it.z.name + '</strong><span class="badge l' + it.lv + '">' + LV[it.lv] + ' ' + when + '</span></div><ul>';
if (it.lv === 2) who.forEach(function (st) { h += '<li><strong>' + esc(st.n) + ':</strong> ' + DO[st.type] + '</li>'; });
else h += '<li>Keep watch at ' + who.map(function (st) { return esc(st.n); }).join(' and ') + '. Have signs ready.</li>';
h += '</ul></li>';
});
h += '</ul>';
}
h += '<p class="small">If you see a bloom, stay out of the water, keep pets away and report it.</p>';
}
return h;
}
/* ---------- render ---------- */
function render() {
var r = run(), s = state.step;
['A', 'B', 'C'].forEach(function (k) { $('scn' + k).setAttribute('aria-pressed', String(k === state.scn)); });
Array.prototype.forEach.call($('steps').children, function (b, i) {
if (i === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
});
show('gGeo', s === 1); show('gDepth', s === 1); show('gGeoLabels', s === 1);
show('gRiverLabels', s === 2);
show('gTowns', s === 0);
show('gStake', s === 3);
var risk = s >= 4;
show('gZones', risk); show('gWind', s === 4 || s === 5);
var cap = '';
if (s === 1) cap = '<span class="key"><span class="sw" style="background:var(--basalt)"></span>Basalt</span><span class="key"><span class="sw" style="background:var(--clay)"></span>Clays and sandstone</span><span class="key"><span class="sw" style="background:var(--peat)"></span>Peat</span><span>Simplified sketch</span>';
else if (s === 2) cap = '<span>Tonnes of phosphorus a year. Thicker line, bigger load.</span>';
else if (s === 3) cap = '<span class="key"><span class="sw" style="background:var(--high)"></span>Drinking water intake</span><span class="key"><span class="sw" style="background:var(--med)"></span>Fishing</span><span class="key"><span class="sw" style="background:var(--accent)"></span>Recreation</span>';
else if (risk) cap = '<span class="key"><span class="sw" style="background:var(--low)"></span>L low</span><span class="key"><span class="sw" style="background:var(--med)"></span>M medium</span><span class="key"><span class="sw" style="background:var(--high)"></span>H high</span><span>' + (s === 4 ? 'Risk today' : s === 5 ? 'Risk on day ' + (state.day + 1) : 'Worst risk in the next 5 days') + '</span>';
else cap = '<span>Schematic map, north at the top. Not for navigation.</span>';
$('mapcap').innerHTML = cap;
if (s === 4) { paintZones(r.today.map(level)); setWind(r.wx[29]); }
if (s === 5) { paintZones(r.outlook[state.day].zones.map(function (c) { return c.lv; })); setWind(r.outlook[state.day].wind); }
if (s === 6) {
paintZones(ZONES.map(function (z, zi) { var m = 0; r.outlook.forEach(function (o) { m = Math.max(m, o.zones[zi].lv); }); return m; }));
}
$('panel').innerHTML = '<div><p class="stepno">Step ' + (s + 1) + ' of ' + STEPS.length + '</p><h2>' + STEPS[s] + '</h2></div>' + sceneHtml(r) +
'<div class="nav"><button type="button" id="prevBtn" ' + (s === 0 ? 'disabled' : '') + '>Back</button><button type="button" class="next" id="nextBtn" ' + (s === STEPS.length - 1 ? 'disabled' : '') + '>' + (s === STEPS.length - 1 ? 'End' : 'Next: ' + STEPS[s + 1]) + '</button></div>';
}
function start() {
$('steps').innerHTML = STEPS.map(function (t, i) { return '<button type="button" id="step' + i + '" data-step="' + i + '" aria-label="Step ' + (i + 1) + ': ' + t + '">' + (i + 1) + '</button>'; }).join('');
buildMap();
document.addEventListener('click', function (e) {
var t = e.target.closest ? e.target.closest('button') : null;
if (!t) return;
if (t.dataset.scn) { state.scn = t.dataset.scn; state.day = 0; if (state.step < 4) state.step = 4; }
else if (t.dataset.step != null) state.step = +t.dataset.step;
else if (t.dataset.day != null) state.day = +t.dataset.day;
else if (t.id === 'prevBtn') state.step = Math.max(0, state.step - 1);
else if (t.id === 'nextBtn') state.step = Math.min(STEPS.length - 1, state.step + 1);
else return;
var id = t.id; render();
if (id && $(id) && !$(id).disabled) $(id).focus({ preventScroll: true });
});
render();
}
start();
})();
