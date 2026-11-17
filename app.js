(function () {
var BOUNDS = [[54.46, -6.74], [54.79, -6.10]];
var CENTRE = [54.62, -6.41];
var GSNI = 'https://map.bgs.ac.uk/arcgis/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/WMSServer';
/* Positions are approximate, placed by eye at river mouths and on the shore. */
var RIVERS = [
{ name: 'Blackwater', t: 173, ll: [54.517, -6.570], side: 'down' },
{ name: 'Main', t: 74, ll: [54.724, -6.290], side: 'up' },
{ name: 'Upper Bann', t: 66, ll: [54.507, -6.503], side: 'right' },
{ name: 'Ballinderry', t: 37, ll: [54.655, -6.500], side: 'left' },
{ name: 'Six Mile Water', t: 29, ll: [54.712, -6.240], side: 'down' },
{ name: 'Moyola', t: 29, ll: [54.735, -6.495], side: 'left' }
];
var SMALL = [
{ name: 'Crumlin', ll: [54.632, -6.262] },
{ name: 'Glenavy', ll: [54.595, -6.262] }
];
var OUTFLOW = { name: 'Lower Bann, out to sea', ll: [54.756, -6.463] };
var ZPOS = {
toome: [[54.748, -6.468], 'left'], north: [[54.700, -6.360], 'up'], antrim: [[54.705, -6.250], 'right'], east: [[54.605, -6.268], 'right'],
kinnego: [[54.495, -6.370], 'right'], south: [[54.504, -6.490], 'down'], washing: [[54.548, -6.582], 'left'], west: [[54.620, -6.500], 'left']
};
var STAKE = [
{ n: 'Toome eel fishery', ll: [54.753, -6.462], zone: 'toome', type: 'fishery', note: 'Home of the eel co-operative, where the Lower Bann leaves the lough' },
{ n: 'Moyola water intake', ll: [54.728, -6.497], zone: 'toome', type: 'intake', note: 'NI Water draws raw water here' },
{ n: 'Cranfield shore', ll: [54.695, -6.355], zone: 'north', type: 'marina', note: 'Shore anglers and small boats' },
{ n: 'Antrim Lough Shore Park', ll: [54.711, -6.238], zone: 'antrim', type: 'bathing', note: 'Walkers, dogs, paddlers, and the Rea\'s Wood monitoring buoy' },
{ n: 'Dunore Point water intake', ll: [54.675, -6.255], zone: 'east', type: 'intake', note: 'NI Water abstraction tower on the eastern shore' },
{ n: 'Sandy Bay and Rams Island', ll: [54.587, -6.270], zone: 'east', type: 'marina', note: 'Boat trips and moorings' },
{ n: 'Castor Bay water intake', ll: [54.497, -6.335], zone: 'kinnego', type: 'intake', note: 'Supplies around 324,000 people' },
{ n: 'Kinnego Marina and Oxford Island', ll: [54.492, -6.372], zone: 'kinnego', type: 'bathing', note: 'Sailing, watersports and a nature reserve' },
{ n: 'Bannfoot', ll: [54.503, -6.507], zone: 'south', type: 'marina', note: 'Where the Upper Bann comes in' },
{ n: 'Washing Bay', ll: [54.546, -6.586], zone: 'washing', type: 'bathing', note: 'Open water swimmers, and a DAERA monitoring buoy' },
{ n: 'Ardboe and Ballyronan', ll: [54.640, -6.505], zone: 'west', type: 'fishery', note: 'Fishing boats and Ballyronan Marina' }
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
var YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
var state = { scn: 'B', step: 0, day: 0, geo: 'sup', base: 'map', satDate: YESTERDAY };
var DATA = null;
var cache = {};
var LIVE = null;
function run() {
if (state.scn === 'L' && !LIVE) state.scn = 'B';
if (state.scn === 'L') return cache.L || (cache.L = runLive(LIVE));
return cache[state.scn] || (cache[state.scn] = runScenario(state.scn));
}
var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var COMPASS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function fmtDate(iso) { var d = new Date(iso + 'T12:00:00Z'); return DAYN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONN[d.getUTCMonth()]; }
function compassShort(deg) { return COMPASS_SHORT[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function zoneById(id) { for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return i; return -1; }
/* ---------- map ---------- */
var MAP = null, GEO = {}, LAYERS = {}, zoneMarkers = {}, windMarker = null, SAT = null;
function mk(html, size) { return L.divIcon({ html: html, className: 'mk', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }); }
function zoneIcon(z, lv) { return mk('<span class="zm l' + lv + '">' + LV[lv].charAt(0) + '</span><span class="zlab ' + ZPOS[z.id][1] + '">' + z.short + '</span>', 22); }
function windIcon(toward) {
return mk('<svg viewBox="-50 -50 100 100" width="96" height="96" style="transform:rotate(' + toward.toFixed(0) + 'deg)" aria-hidden="true"><line x1="0" y1="36" x2="0" y2="-16" stroke-width="7" stroke-linecap="round"/><path d="M0,-42 L-15,-13 L15,-13 Z"/></svg>', 96);
}
function buildMap() {
if (!window.L) { $('map').innerHTML = '<p class="mapfail">The map could not load. The rest of the page still works.</p>'; return; }
MAP = L.map('map', { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 8, maxZoom: 15, scrollWheelZoom: false, dragging: !L.Browser.mobile });
MAP.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(MAP);
MAP.fitBounds(BOUNDS);
var credit = 'Contains Geological Survey of Northern Ireland materials &copy; Crown Copyright ' + new Date().getFullYear();
GEO.sup = L.tileLayer.wms(GSNI, { layers: '6', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.6, attribution: credit });
GEO.bed = L.tileLayer.wms(GSNI, { layers: '5', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.6, attribution: credit });
var rm = RIVERS.map(function (r) {
var d = Math.round(10 + r.t / 173 * 16);
return L.marker(r.ll, { interactive: false, icon: mk('<span class="rdot" style="width:' + d + 'px;height:' + d + 'px"></span><span class="zlab ' + r.side + '">' + r.name + ' <i>' + r.t + ' t</i></span>', d) });
});
SMALL.forEach(function (r) { rm.push(L.marker(r.ll, { interactive: false, icon: mk('<span class="rdot" style="width:8px;height:8px"></span><span class="zlab right dim">' + r.name + '</span>', 8) })); });
rm.push(L.marker(OUTFLOW.ll, { interactive: false, icon: mk('<span class="rdot out" style="width:14px;height:14px"></span><span class="zlab up">' + OUTFLOW.name + '</span>', 14) }));
LAYERS.rivers = L.layerGroup(rm);
LAYERS.stake = L.layerGroup(STAKE.map(function (s, i) {
return L.marker(s.ll, { title: s.n, alt: s.n, icon: mk('<span class="sm ' + s.type + '">' + (i + 1) + '</span>', 22) });
}));
LAYERS.zones = L.layerGroup(ZONES.map(function (z) {
return (zoneMarkers[z.id] = L.marker(ZPOS[z.id][0], { title: z.name, alt: z.name, icon: zoneIcon(z, 0) }));
}));
SAT = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', { date: state.satDate, maxNativeZoom: 9, maxZoom: 15, attribution: 'Satellite imagery: NASA EOSDIS GIBS' });
windMarker = L.marker(CENTRE, { interactive: false, keyboard: false, zIndexOffset: -500, icon: windIcon(0) });
LAYERS.wind = L.layerGroup([windMarker]);
}
function buildData() {
if (!MAP || !DATA) return;
var yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
if (DATA.works && DATA.works.length) LAYERS.works = L.layerGroup(DATA.works.map(function (w) {
return L.circleMarker([w.lat, w.lon], { radius: 3.5, color: '#ffffff', weight: 1, fillColor: '#5b6770', fillOpacity: 0.9 }).bindTooltip(w.name + (w.into ? ', into ' + w.into : ''));
}));
if (DATA.algae) LAYERS.algae = L.layerGroup(DATA.algae.filter(function (a) { return a.date >= yearAgo; }).map(function (a) {
return L.circleMarker([a.lat, a.lon], { radius: 5, color: '#ffffff', weight: 1.5, fillColor: '#b0206a', fillOpacity: 0.9 }).bindTooltip(a.name + ', confirmed ' + fmtDate(a.date) + ' ' + a.date.slice(0, 4));
}));
var bu = (DATA.buoys || []).filter(function (b) { return b.lat != null; });
if (bu.length) LAYERS.buoys = L.layerGroup(bu.map(function (b) {
return L.marker([b.lat, b.lon], { title: b.name + ' buoy', alt: b.name + ' buoy', zIndexOffset: 300, icon: mk('<span class="bm">B</span>', 18) });
}));
}
function showLayer(layer, on) {
if (!MAP || !layer) return;
if (on && !MAP.hasLayer(layer)) layer.addTo(MAP);
if (!on && MAP.hasLayer(layer)) MAP.removeLayer(layer);
}
function paintZones(levels) {
if (!MAP) return;
ZONES.forEach(function (z, i) { zoneMarkers[z.id].setIcon(zoneIcon(z, levels[i])); });
}
function setWind(w) {
if (!MAP) return;
windMarker.setIcon(windIcon((w.dir + 180) % 360));
}
/* ---------- scene panels ---------- */
function chart30(r, endLabel) {
endLabel = endLabel || 'today';
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
var vals = []; for (var i = 0; i < 30; i++) vals.push(row.get(r.wx[i], i));
var lo = row.kind === 'line' ? Math.min(row.min, Math.floor(Math.min.apply(null, vals)) - 1) : row.min;
var hi = row.kind === 'area' ? row.max : Math.max(row.max, Math.ceil(Math.max.apply(null, vals)));
var y = function (v) { return yb - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * rowH; };
var last = vals[29];
h += '<text class="ct strong" x="8" y="' + (y0 - 4) + '">' + row.label + '</text>';
h += '<text class="ct" x="332" y="' + (y0 - 4) + '" text-anchor="end">' + endLabel + ' ' + last.toFixed(row.dec) + (row.unit ? ' ' + row.unit : '') + '</text>';
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
h += '<text class="ct" x="8" y="' + (H - 6) + '">30 days ago</text><text class="ct" x="332" y="' + (H - 6) + '" text-anchor="end">' + endLabel + '</text>';
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
'</dl><p class="small">Six main rivers flow in. Only one, the Lower Bann at Toome, flows out.</p>' +
'<h3>See it from space</h3>' +
'<div class="seg" role="group" aria-label="Map view">' +
[['map', 'Map'], ['sat', 'Satellite photo']].map(function (g) { return '<button type="button" id="base_' + g[0] + '" data-base="' + g[0] + '" aria-pressed="' + (state.base === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div>' +
(state.base === 'sat' ? '<p class="satrow"><label for="satDate">Photo date</label> <input type="date" id="satDate" min="2000-03-01" max="' + YESTERDAY + '" value="' + state.satDate + '"></p>' +
'<p class="small">A daily photo from NASA\'s Terra satellite. Each dot of the picture covers about 250 metres, so it shows the whole lough but no fine detail. Cloud often hides the lough, so try other dates. A strong bloom shows as green swirls in the water.</p>' : '');
} else if (s === 1) {
h += '<p>The coloured layer is the Geological Survey of Northern Ireland\'s 1:250,000 map. Where the surface is clay or peat, rain drains poorly and runs off the fields quickly, taking phosphorus with it.</p>' +
'<div class="seg" role="group" aria-label="Geology layer">' +
[['sup', 'Surface deposits'], ['bed', 'Bedrock'], ['off', 'Map only']].map(function (g) { return '<button type="button" id="geo_' + g[0] + '" data-geo="' + g[0] + '" aria-pressed="' + (state.geo === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div>' +
(state.geo !== 'off' ? '<details class="legendbox"><summary>What the colours mean</summary><div class="legendimg"><img alt="Key to the geology colours, from the Geological Survey of Northern Ireland" loading="lazy" src="' + GSNI + '?service=WMS&amp;version=1.3.0&amp;request=GetLegendGraphic&amp;format=image/png&amp;layer=' + (state.geo === 'sup' ? '6' : '5') + '"></div></details>' : '') +
'<ul class="list">' +
'<li><strong>Shallow water</strong><span class="sub">Warms fast, and a strong wind can stir the bed all the way up.</span></li>' +
'<li><strong>Phosphorus in the mud</strong><span class="sub">Decades of nutrients sit in the sediment. AFBI scientists have said they could keep feeding the lough for around 40 years.</span></li>' +
'<li><strong>Zebra mussels</strong><span class="sub">First found in 2005 and now everywhere in the lough. They filter the water clear, so sunlight reaches deeper and algae grow faster.</span></li>' +
'</ul>';
} else if (s === 2) {
var total = 0; RIVERS.forEach(function (rv) { total += rv.t; });
h += '<p>Blue-green algae feed on phosphorus. This is how much each river is estimated to carry into the lough in a year. Bigger dots on the map mean bigger loads.</p><div class="bars">';
RIVERS.concat([{ name: 'Smaller rivers', t: 66 }, { name: 'Straight into lough', t: 65 }]).forEach(function (rv) {
h += '<div class="bar"><span>' + rv.name + '</span><span class="track"><span class="fill" style="display:block;width:' + (rv.t / 173 * 100).toFixed(0) + '%"></span></span><span class="val">' + rv.t + ' t</span></div>';
});
h += '</div><h3>Where it comes from</h3>' +
'<div class="split" role="img" aria-label="Agriculture 61 percent, wastewater 29 percent, other 9 percent, septic tanks 1.3 percent">' +
'<span style="width:61%;background:var(--low)"></span><span style="width:29%;background:var(--water-ink)"></span><span style="width:9%;background:var(--muted)"></span><span style="width:1.3%;background:var(--med)"></span></div>' +
'<div class="legend"><span class="key"><span class="sw" style="background:var(--low)"></span>Agriculture 61%</span><span class="key"><span class="sw" style="background:var(--water-ink)"></span>Wastewater 29%</span><span class="key"><span class="sw" style="background:var(--muted)"></span>Other 9%</span><span class="key"><span class="sw" style="background:var(--med)"></span>Septic tanks 1.3%</span></div>' +
'<p class="small">AFBI modelling, 2021 reference year, tonnes of phosphorus. Provisional figures.</p>' +
(DATA && DATA.works && DATA.works.length ? '<p class="small">The small grey dots on the map are ' + DATA.works.length + ' NI Water wastewater treatment works in the area shown, from NI Water\'s May 2024 list published by DAERA. Not all of them drain to the lough.</p>' : '');
} else if (s === 3) {
h += '<p>These are the places and people a bloom hits first. In the model each one is tied to a stretch of shore, so a warning can name who needs to hear it.</p><ol class="list" style="list-style:none">';
STAKE.forEach(function (st, i) {
h += '<li><strong><span class="stepno">' + (i + 1) + '</span> ' + esc(st.n) + '</strong><span class="sub">' + esc(st.note) + '</span></li>';
});
h += '</ol>';
} else if (s === 4 && r.live) {
var lb = r.start.b, llv = level(lb), L = r.live;
h += '<div class="readout"><span>Bloom index today</span><span class="badge l' + llv + '">' + lb.toFixed(2) + ' ' + LV[llv] + (r.hist ? '' : ', assumed') + '</span></div>';
if (r.hist) {
h += '<p>The model has been run over the real weather of the last 30 days. Only the starting bloom level, 30 days ago, is assumed. It puts the water at about ' + r.start.tw.toFixed(1) + ' °C now.</p>' +
'<div class="chart">' + chart30(r, 'yesterday') + '</div>';
} else {
h += '<p>This is the real Met Office forecast for the middle of the lough. Past weather could not be loaded, so the model starts from an assumed low bloom level and a water temperature of ' + r.start.tw.toFixed(1) + ' °C, estimated from the air temperature.</p>';
}
var bu = DATA && DATA.buoys ? DATA.buoys.filter(function (x) { return x.temp != null || x.pc != null; }) : [];
if (bu.length) {
var temps = bu.filter(function (x) { return x.temp != null; }).map(function (x) { return x.temp; });
h += '<h3>What the DAERA buoys measured</h3><div class="tablewrap"><table class="wx"><thead><tr><th scope="col" class="lh">Buoy</th><th scope="col">Water</th><th scope="col">Algae pigment</th><th scope="col">Reading</th></tr></thead><tbody>';
bu.forEach(function (x) {
h += '<tr><th scope="row">' + esc(x.name) + '</th><td>' + (x.temp == null ? 'n/a' : x.temp.toFixed(1) + ' °C') + '</td><td>' + (x.pc == null ? 'n/a' : x.pc.toFixed(2) + ' RFU') + '</td><td>' + fmtDate(x.at.slice(0, 10)) + '</td></tr>';
});
h += '</tbody></table></div><p class="small">' + (temps.length ? 'The buoys averaged ' + (temps.reduce(function (p, q) { return p + q; }, 0) / temps.length).toFixed(1) + ' °C, against the model\'s ' + r.start.tw.toFixed(1) + ' °C. ' : '') + 'The pigment is phycocyanin, which blue-green algae contain, in relative fluorescence units. DAERA publishes these readings about a week late, they are provisional, and DAERA says no single value defines a bloom.</p>';
}
var yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
var recent = DATA && DATA.algae ? DATA.algae.filter(function (x) { return x.date >= yearAgo; }) : null;
if (recent) {
h += '<h3>Confirmed blue-green algae</h3><p>' + (recent.length ? 'DAERA has confirmed blue-green algae at ' + recent.length + ' location' + (recent.length === 1 ? '' : 's') + ' in and around the lough in the last 12 months, shown as pink dots. The most recent is ' + esc(recent[0].name) + ' on ' + fmtDate(recent[0].date) + ' ' + recent[0].date.slice(0, 4) + '.' : 'DAERA has no confirmed blue-green algae reports in and around the lough in the last 12 months.') + '</p>';
}
h += '<h3>Met Office forecast</h3><div class="tablewrap"><table class="wx"><thead><tr><th scope="col" class="lh">Day</th><th scope="col">Air temp</th><th scope="col">Wind from</th><th scope="col">Rain</th></tr></thead><tbody>';
[L.today].concat(L.days.slice(0, 5)).forEach(function (dy, i) {
h += '<tr><th scope="row">' + (i === 0 ? 'Today' : fmtDate(dy.date)) + '</th><td>' + dy.t.toFixed(0) + ' °C</td><td>' + compassShort(dy.dir) + ' ' + Math.round(dy.w) + ' mph</td><td>' + dy.r.toFixed(1) + ' mm</td></tr>';
});
h += '</tbody></table></div>' +
'<p class="small">Forecast from the Met Office Weather DataHub' + (L.modelRunDate ? ', model run ' + String(L.modelRunDate).slice(11, 16) + ' UTC on ' + fmtDate(String(L.modelRunDate).slice(0, 10)) : '') + ', averaged from three-hourly values.' + (r.hist ? ' Past weather is from the Open-Meteo weather model archive, not from a weather station.' : '') + (r.start.tw < 12 ? ' In this model algae do not grow in water below 12 °C, so cold weather keeps the risk low on every shore.' : '') + '</p>';
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
h += '<p><strong>Day ' + (state.day + 1) + (r.live ? ', ' + fmtDate(r.live.days[state.day].date) : '') + ':</strong> wind from the ' + compass(w.dir) + ' at about ' + Math.round(w.w) + ' mph, pushing surface water towards the ' + compass(w.dir + 180) + ' shore.</p>' +
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
['A', 'B', 'C', 'L'].forEach(function (k) { $('scn' + k).setAttribute('aria-pressed', String(k === state.scn)); });
Array.prototype.forEach.call($('steps').children, function (b, i) {
if (i === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
});
var risk = s >= 4;
showLayer(GEO.sup, s === 1 && state.geo === 'sup'); showLayer(GEO.bed, s === 1 && state.geo === 'bed');
showLayer(LAYERS.rivers, s === 2); showLayer(LAYERS.stake, s === 3);
showLayer(LAYERS.zones, risk); showLayer(LAYERS.wind, s === 4 || s === 5);
showLayer(SAT, s === 0 && state.base === 'sat');
showLayer(LAYERS.works, s === 2);
showLayer(LAYERS.algae, s === 4 && !!r.live); showLayer(LAYERS.buoys, s === 4 && !!r.live);
var cap = '';
if (s === 1) cap = state.geo === 'off' ? '<span>Base map: OpenStreetMap.</span>' : '<span>' + (state.geo === 'sup' ? 'Surface deposits' : 'Bedrock') + ', 1:250,000. Contains Geological Survey of Northern Ireland materials © Crown Copyright.</span>';
else if (s === 2) cap = '<span>Tonnes of phosphorus a year. Bigger dot, bigger load. Positions are approximate.</span>' + (LAYERS.works ? '<span class="key"><span class="sw dot" style="background:#5b6770"></span>Treatment works</span>' : '');
else if (s === 3) cap = '<span class="key"><span class="sw" style="background:var(--high)"></span>Drinking water intake</span><span class="key"><span class="sw" style="background:var(--med)"></span>Fishing</span><span class="key"><span class="sw" style="background:var(--accent)"></span>Recreation</span>';
else if (risk) cap = '<span class="key"><span class="sw" style="background:var(--low)"></span>L low</span><span class="key"><span class="sw" style="background:var(--med)"></span>M medium</span><span class="key"><span class="sw" style="background:var(--high)"></span>H high</span><span>' + (s === 4 ? 'Risk today' : s === 5 ? 'Risk on day ' + (state.day + 1) : 'Worst risk in the next 5 days') + '</span>' + (s === 4 && r.live && LAYERS.buoys ? '<span class="key"><span class="sw" style="background:#174a63"></span>B buoy</span>' : '') + (s === 4 && r.live && LAYERS.algae ? '<span class="key"><span class="sw dot" style="background:#b0206a"></span>Confirmed algae, last 12 months</span>' : '');
else cap = state.base === 'sat' ? '<span>Satellite photo for ' + fmtDate(state.satDate) + ' ' + state.satDate.slice(0, 4) + ': NASA Terra MODIS, from NASA Worldview GIBS.</span>' : '<span>Base map: OpenStreetMap. Pinch or use the buttons to zoom.</span>';
$('mapcap').innerHTML = cap;
if (s === 4) { paintZones(r.today.map(level)); setWind(r.todayW || r.wx[29]); }
if (s === 5) { paintZones(r.outlook[state.day].zones.map(function (c) { return c.lv; })); setWind(r.outlook[state.day].wind); }
if (s === 6) {
paintZones(ZONES.map(function (z, zi) { var m = 0; r.outlook.forEach(function (o) { m = Math.max(m, o.zones[zi].lv); }); return m; }));
}
$('panel').innerHTML = '<div><p class="stepno">Step ' + (s + 1) + ' of ' + STEPS.length + '</p><h2>' + (s === 4 && r.live ? 'The lough today' : STEPS[s]) + '</h2></div>' + sceneHtml(r) +
'<div class="nav"><button type="button" id="prevBtn" ' + (s === 0 ? 'disabled' : '') + '>Back</button><button type="button" class="next" id="nextBtn" ' + (s === STEPS.length - 1 ? 'disabled' : '') + '>' + (s === STEPS.length - 1 ? 'End' : 'Next: ' + STEPS[s + 1]) + '</button></div>';
}
function loadData() {
if (!window.fetch) return;
fetch('/api/lough').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok) return;
DATA = j; buildData(); render();
}).catch(function () {});
}
function loadLive() {
var note = $('liveNote'), btn = $('scnL');
var fail = function () { note.textContent = 'The live forecast is not available right now. The three weather stories still work.'; };
if (!window.fetch) { fail(); return; }
fetch('/api/weather').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok || !j.today || !j.days || j.days.length < 5) { fail(); return; }
LIVE = j; btn.disabled = false;
note.textContent = 'Live Met Office forecast loaded' + (j.modelRunDate ? ', model run ' + String(j.modelRunDate).slice(11, 16) + ' UTC on ' + fmtDate(String(j.modelRunDate).slice(0, 10)) : '') + '.';
}).catch(fail);
}
function start() {
$('steps').innerHTML = STEPS.map(function (t, i) { return '<button type="button" id="step' + i + '" data-step="' + i + '" aria-label="Step ' + (i + 1) + ': ' + t + '">' + (i + 1) + '</button>'; }).join('');
buildMap();
document.addEventListener('click', function (e) {
var t = e.target.closest ? e.target.closest('button') : null;
if (!t) return;
if (t.dataset.scn) { state.scn = t.dataset.scn; state.day = 0; if (state.step < 4) state.step = 4; }
else if (t.dataset.geo) state.geo = t.dataset.geo;
else if (t.dataset.base) state.base = t.dataset.base;
else if (t.dataset.step != null) state.step = +t.dataset.step;
else if (t.dataset.day != null) state.day = +t.dataset.day;
else if (t.id === 'prevBtn') state.step = Math.max(0, state.step - 1);
else if (t.id === 'nextBtn') state.step = Math.min(STEPS.length - 1, state.step + 1);
else return;
var id = t.id; render();
if (id && $(id) && !$(id).disabled) $(id).focus({ preventScroll: true });
});
document.addEventListener('change', function (e) {
if (e.target && e.target.id === 'satDate' && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value <= YESTERDAY) {
state.satDate = e.target.value;
if (SAT) { SAT.options.date = state.satDate; SAT.redraw(); }
render();
if ($('satDate')) $('satDate').focus({ preventScroll: true });
}
});
render();
loadLive();
loadData();
}
start();
})();
