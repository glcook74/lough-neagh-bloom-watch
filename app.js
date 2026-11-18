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
/* Phosphorus leaving each basin, AFBI modelling, 2021 reference year (provisional). */
var BASIN_P = [
{ k: /blackwater/i, kg: 1.16, t: 173 }, { k: /upper bann/i, kg: 1.08, t: 66 }, { k: /six\s?mile/i, kg: 1.05, t: 29 },
{ k: /main/i, kg: 1.03, t: 74 }, { k: /lough neagh/i, kg: 0.98, t: 66 }, { k: /moyola/i, kg: 0.92, t: 29 },
{ k: /ballinderry/i, kg: 0.85, t: 37 }, { k: /lower bann/i, kg: 0.85, t: 76, down: true }
];
var OCHRE = ['#f3e3b5', '#e3c26f', '#cf9b3a', '#a8701f', '#7a4a12'];
var BLUES = ['#e3eef5', '#b9d3e6', '#86b2d3', '#4f8bba', '#1f5f93'];
var RISK = { 1: ['Low', '#2c8a57'], 2: ['Medium', '#c97f00'], 3: ['High', '#bf3528'] };
var GOTO = [['Maghery', 54.512, -6.58], ['Glenavy shore', 54.575, -6.28], ['Kinnego', 54.492, -6.36], ['Ballyronan', 54.708, -6.52]];
function basinP(name) { for (var i = 0; i < BASIN_P.length; i++) if (BASIN_P[i].k.test(name || '')) return BASIN_P[i]; return null; }
function ramp(v, lo, hi, cols) { var k = hi > lo ? (v - lo) / (hi - lo) : 0; return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(k * cols.length)))]; }
function nf(v) { return Math.round(v).toLocaleString('en-GB'); }
var STOCK = { cattle: ['Cattle', 'TotalNumberofCattle', 1], sheep: ['Sheep', 'TotalNumberofsheep', 1], pigs: ['Pigs', 'TotalNumberOfPigs', 1], poultry: ['Poultry', 'TotalNumberOfPoultry000', 1000] };
var REDS = ['#f6d9d3', '#eaa79b', '#d97464', '#bf3528', '#7f1d14'];
var CLC = 'https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer';
function stockPerHa(p) { var k = STOCK[state.stock]; return p.TotalAreaFarmedInHa > 0 ? (p[k[1]] || 0) * k[2] / p.TotalAreaFarmedInHa : 0; }
/* Shade by rank, a fifth of the areas in each colour, so one extreme area cannot wash out all the others. */
function farmBreaks() { var v = LAND.farms.features.map(function (f) { return stockPerHa(f.properties); }).sort(function (a, b) { return a - b; }); return [0.2, 0.4, 0.6, 0.8].map(function (q) { return v[Math.min(v.length - 1, Math.floor(q * v.length))]; }); }
function farmStyle(f) { var br = farmBreaks(), v = stockPerHa(f.properties), i = 0; while (i < br.length && v >= br[i]) i++; return { color: '#ffffff', weight: 1.5, fillColor: BLUES[i], fillOpacity: 0.7 }; }
function farmTop() { var best = null; LAND.farms.features.forEach(function (f) { if (!best || stockPerHa(f.properties) > stockPerHa(best)) best = f.properties; }); return best; }
function incidentColour(n) { return REDS[n >= 16 ? 4 : n >= 8 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0]; }
function slurryHtml() {
var now = new Date(), m = now.getMonth() + 1, d = now.getDate();
var closed = (m === 10 && d >= 15) || m > 10 || m === 1, edge = (m === 10 && d < 15) || m === 2;
var h = '<h3>Slurry spreading today</h3>';
if (closed) h += '<p><span class="badge l2">Closed period</span> Slurry cannot be spread between 15 October and 31 January.</p>';
else {
var rain = LIVE && LIVE.days && LIVE.days.length > 1 ? LIVE.days[0].r + LIVE.days[1].r : null;
h += '<p><span class="badge l0">Open season</span> ' + (edge ? 'Lower spreading rates and wider buffer strips apply in early October and in February. ' : '') + (rain != null ? 'The Met Office forecast shows ' + rain.toFixed(1) + ' mm of rain over the next two days. ' : '') + 'The rules say not to spread on waterlogged or frozen ground, or when heavy rain is forecast within 48 hours.</p>';
}
return h + '<p class="small">There is no public record of where or when slurry is actually spread, so livestock numbers are the best open guide to how much is produced. The dates and rules are from DAERA\'s Nutrients Action Programme guidance.</p>';
}
function cattlePerHa(p) { return p.TotalAreaFarmedInHa > 0 ? p.TotalNumberofCattle / p.TotalAreaFarmedInHa : 0; }
function farmRange() { var v = LAND.farms.features.map(function (f) { return stockPerHa(f.properties); }); return [Math.min.apply(null, v), Math.max.apply(null, v)]; }
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
var state = { scn: 'B', step: 0, day: 0, base: 'map', satDate: YESTERDAY, s2date: null, s2year: '', s2algae: false, shade: 'none', on: {}, stock: 'cattle', basin: 'River Blackwater' };
/* Each step of the tour switches on the layers that suit it. The reader can then change them freely. */
function preset() {
var s = state.step, live = state.scn === 'L' && !!LIVE;
state.shade = s === 1 ? 'sup' : 'none';
state.on = { rivers: s === 2, works: s === 2, stake: s === 3, zones: s >= 4, buoys: s === 4 && live, algae: s === 4 && live, fields: false, incidents: false, srp: false, overflows: false };
}
function landMode() { return state.shade === 'sources' ? 'sources' : state.shade === 'basins' ? 'basins' : state.shade === 'farms' ? 'farms' : state.shade === 'cover' ? 'cover' : state.shade === 'status' ? 'status' : state.on.incidents ? 'incidents' : state.on.srp ? 'srp' : state.on.overflows ? 'sewage' : state.on.fields ? 'fields' : 'rivers'; }
function setLand(m) {
state.shade = m === 'basins' || m === 'farms' || m === 'cover' || m === 'status' || m === 'sources' ? m : 'none';
state.on.fields = m === 'fields'; state.on.incidents = m === 'incidents'; state.on.srp = m === 'srp'; state.on.overflows = m === 'sewage';
state.on.rivers = m === 'rivers'; state.on.works = m === 'rivers' || m === 'sewage';
}
var DATA = null, LAND = null, WATER = null, SOURCES = null;
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
var MAP = null, GEO = {}, LAYERS = {}, zoneMarkers = {}, windMarker = null, SATS = {};
function mk(html, size) { return L.divIcon({ html: html, className: 'mk', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }); }
function zoneIcon(z, lv) { return mk('<span class="zm l' + lv + '">' + LV[lv].charAt(0) + '</span><span class="zlab ' + ZPOS[z.id][1] + '">' + z.short + '</span>', 22); }
function windIcon(toward) {
return mk('<svg viewBox="-50 -50 100 100" width="96" height="96" style="transform:rotate(' + toward.toFixed(0) + 'deg)" aria-hidden="true"><line x1="0" y1="36" x2="0" y2="-16" stroke-width="7" stroke-linecap="round"/><path d="M0,-42 L-15,-13 L15,-13 Z"/></svg>', 96);
}
function buildMap() {
if (!window.L) { $('map').innerHTML = '<p class="mapfail">The map could not load. The rest of the page still works.</p>'; return; }
MAP = L.map('map', { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 8, maxZoom: 17, scrollWheelZoom: false, dragging: !L.Browser.mobile });
MAP.createPane('s2').style.zIndex = 250; MAP.createPane('s2a').style.zIndex = 260;
MAP.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, zIndex: 1, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(MAP);
MAP.fitBounds(BOUNDS);
var credit = 'Contains Geological Survey of Northern Ireland materials &copy; Crown Copyright ' + new Date().getFullYear();
GEO.sup = L.tileLayer.wms(GSNI, { layers: '6', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.6, zIndex: 5, attribution: credit });
GEO.cover = L.tileLayer.wms(CLC, { layers: '12', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.65, zIndex: 5, attribution: 'Corine Land Cover 2018: Copernicus Land Monitoring Service, EEA' });
GEO.bed = L.tileLayer.wms(GSNI, { layers: '5', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.6, zIndex: 5, attribution: credit });
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
SATS.daily = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', { date: state.satDate, maxNativeZoom: 9, maxZoom: 17, zIndex: 2, attribution: 'Daily photo: NASA EOSDIS GIBS' });
SATS.aerial = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 18, maxZoom: 17, zIndex: 2, attribution: 'Aerial photos: Esri, Maxar, Earthstar Geographics and the GIS user community' });
SATS.sat = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg', { maxNativeZoom: 15, maxZoom: 17, zIndex: 2, attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)' });
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
var wasSources = false;
function sourceStyle(f) {
var b = SOURCES ? SOURCES.basins.filter(function (x) { return x.name === f.properties.NAME; })[0] : null;
if (!b) return { color: '#ffffff', weight: 1, fillColor: '#9aa3a8', fillOpacity: 0.3 };
var r = rankOf(testMean, b), N = SOURCES.basins.length, sel = b.name === state.basin;
return { color: sel ? '#10262e' : '#ffffff', weight: sel ? 3.5 : 1.5, fillColor: r == null ? '#9aa3a8' : VIOLETS[Math.min(4, Math.floor((N - r) / N * 5))], fillOpacity: 0.65 };
}
function buildSources() {
if (!MAP || !SOURCES || !LAND || !LAND.basins || LAYERS.sources) return;
LAYERS.sources = L.geoJSON(LAND.basins, {
style: sourceStyle,
onEachFeature: function (f, l) {
var known = SOURCES.basins.some(function (x) { return x.name === f.properties.NAME; });
if (known) l.on('click', function () { state.basin = f.properties.NAME; render(); });
else l.bindPopup('<strong>' + esc(f.properties.NAME) + '</strong><br>Does not flow into the lough');
}
});
}
function buildWater() {
if (!MAP || !WATER) return;
if (WATER.status) LAYERS.status = L.geoJSON(WATER.status, {
style: function (f) { return { color: '#ffffff', weight: 1, fillColor: wfd(f.properties.F2018_statu)[1], fillOpacity: 0.6 }; },
onEachFeature: function (f, l) { l.bindPopup('<strong>' + esc(f.properties.namespace || 'Water body') + '</strong><br>' + wfd(f.properties.F2018_statu)[0] + ' status, 2018' + (/EP/.test(f.properties.F2018_statu || '') ? '<br>Heavily modified water, graded on ecological potential' : '')); }
});
if (WATER.failing && WATER.failing.features && WATER.failing.features.length) LAYERS.failing = L.geoJSON(WATER.failing, {
style: function () { return { color: '#10262e', weight: 2.5, fill: false, dashArray: '5 4' }; }, interactive: false
});
if (WATER.srp && WATER.srp.length) { var br = srpBreaks(); LAYERS.srp = L.layerGroup(WATER.srp.map(function (x) {
var ch = x.prev == null ? '' : '<br>2015 to 2019 average: ' + x.prev.toFixed(3) + ' mg/l';
return L.circleMarker([x.lat, x.lon], { radius: 6, color: '#ffffff', weight: 1.5, fillColor: srpColour(x.mean, br), fillOpacity: 0.95 }).bindPopup('<strong>' + esc(tidyName(x.name)) + '</strong><br>' + esc(x.basin || '') + ' basin, site ' + esc(x.code) + '<br>2020 to 2024 average: ' + x.mean.toFixed(3) + ' mg/l of dissolved phosphorus<br>' + x.n + ' readings' + ch);
})); }
if (WATER.overflows && WATER.overflows.length) LAYERS.overflows = L.layerGroup(WATER.overflows.map(function (x) {
var bad = /unsat/i.test(x.cls), c = bad ? '#bf3528' : '#4f6b7a';
return L.circleMarker([x.lat, x.lon], { radius: Math.min(11, 3 + Math.sqrt(x.spills) / 1.6), color: '#ffffff', weight: 1, fillColor: c, fillOpacity: 0.85 }).bindPopup('<strong>' + esc(x.name) + '</strong><br>Predicted to spill ' + nf(x.spills) + ' times a year<br>Predicted volume: ' + nf(x.vol) + ' m³ a year' + (x.cls ? '<br>Classed: ' + esc(x.cls) : '') + (x.into && !/undefined/i.test(x.into) ? '<br>Into: ' + esc(x.into) : '') + (x.mon ? '<br>Monitored: ' + esc(x.mon) : ''));
}));
}
var fieldsLayer = null, fieldsKey = '', wasFields = false;
function buildLand() {
if (!MAP || !LAND) return;
if (LAND.basins) LAYERS.basins = L.geoJSON(LAND.basins, {
style: function (f) { var b = basinP(f.properties.NAME); return { color: '#ffffff', weight: 1.5, fillColor: b ? ramp(b.kg, 0.8, 1.2, OCHRE) : '#9aa3a8', fillOpacity: b ? 0.65 : 0.35 }; },
onEachFeature: function (f, l) { var b = basinP(f.properties.NAME); l.bindPopup('<strong>' + esc(f.properties.NAME) + '</strong><br>' + (b ? b.kg.toFixed(2) + ' kg of phosphorus per hectare a year<br>' + b.t + ' tonnes a year in total' + (b.down ? '<br>Downstream of the lough' : '') : 'Drains elsewhere, not to the lough')); }
});
if (LAND.incidents && LAND.incidents.length) LAYERS.incidents = L.layerGroup(LAND.incidents.map(function (x) {
var c = incidentColour(x.t);
return L.rectangle([[x.b[0], x.b[1]], [x.b[2], x.b[3]]], { color: c, weight: 0.5, fillColor: c, fillOpacity: 0.75 }).bindPopup('<strong>' + x.t + ' confirmed incident' + (x.t === 1 ? '' : 's') + ', 2011 to 2024</strong><br>From farms: ' + x.farm + '<br>From homes: ' + x.dom + '<br>From industry: ' + x.ind + '<br>From NI Water: ' + x.niw + '<br>High severity: ' + x.high + '<br>Since 2020: ' + x.recent);
}));
if (LAND.farms) { LAYERS.farms = L.geoJSON(LAND.farms, {
style: farmStyle,
onEachFeature: function (f, l) { var p = f.properties; l.bindPopup('<strong>' + esc(String(p.DEAName).toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); })) + '</strong><br>' + cattlePerHa(p).toFixed(2) + ' cattle per hectare farmed<br>' + nf(p.TotalNumberofCattle) + ' cattle, ' + nf(p.TotalNumberofsheep) + ' sheep<br>' + nf(p.TotalNumberOfPigs) + ' pigs, ' + nf((p.TotalNumberOfPoultry000 || 0) * 1000) + ' poultry<br>' + nf(p.NumberOfFarms) + ' farms on ' + nf(p.TotalAreaFarmedInHa) + ' ha'); }
}); }
fieldsLayer = L.geoJSON(null, {
style: function (f) { var c = (RISK[f.properties.ruleid] || RISK[1])[1]; return { color: c, weight: 0.7, fillColor: c, fillOpacity: 0.45 }; },
onEachFeature: function (f, l) { var p = f.properties; l.bindPopup('<strong>' + esc(p.bh || 'Farmland') + '</strong><br>' + (RISK[p.ruleid] || ['Unknown'])[0] + ' risk of losing nutrients to water' + (p.hydoconnec ? '<br>Connected to a watercourse: ' + esc(String(p.hydoconnec).toLowerCase()) : '')); }
});
MAP.on('moveend', updateFields);
}
function updateFields() {
if (!MAP || !fieldsLayer) return;
var on = !!state.on.fields;
showLayer(fieldsLayer, on);
if (L.Browser.mobile) { if (on) MAP.dragging.enable(); else MAP.dragging.disable(); }
if (!on) { if (wasFields) { wasFields = false; MAP.closePopup(); MAP.fitBounds(BOUNDS); } return; }
wasFields = true;
var say = function (txt) { var n = $('fieldNote'); if (n) n.textContent = txt; };
if (MAP.getZoom() < 13) { fieldsLayer.clearLayers(); fieldsKey = ''; say('Zoom in closer to load the fields.'); return; }
var b = MAP.getBounds(), g = 0.02;
var key = [Math.floor(b.getWest() / g) * g, Math.floor(b.getSouth() / g) * g, Math.ceil(b.getEast() / g) * g, Math.ceil(b.getNorth() / g) * g].map(function (v) { return v.toFixed(2); }).join(',');
if (key === fieldsKey) return;
fieldsKey = key; say('Loading the fields.');
fetch('/api/fields?bbox=' + key).then(function (res) { return res.json(); }).then(function (j) {
if (key !== fieldsKey) return;
fieldsLayer.clearLayers();
if (!j || !j.ok) { say('The fields could not be loaded just now.'); return; }
fieldsLayer.addData({ type: 'FeatureCollection', features: j.features });
say(j.features.length ? j.features.length + ' parcels shown' + (j.more ? ', which is all the map can load at once. Zoom in further to be sure of seeing every parcel.' : '. Tap one for its score.') : 'No scored parcels in this view.');
}).catch(function () { if (key === fieldsKey) { fieldsKey = ''; say('The fields could not be loaded just now.'); } });
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
var VIOLETS = ['#ece3f3', '#cdb5e0', '#a983c9', '#8153ad', '#5a2c86'];
var WFD = { HIGH: ['High', '#00c5ff'], GOOD: ['Good', '#00a884'], MODERATE: ['Moderate', '#e6e600'], POOR: ['Poor', '#e69800'], BAD: ['Bad', '#e60000'], GEP: ['Good', '#00a884'], MEP: ['Moderate', '#e6e600'], 'MEP (AWB)': ['Moderate', '#e6e600'], PEP: ['Poor', '#e69800'], BEP: ['Bad', '#e60000'] };
function wfd(v) { return WFD[String(v || '').trim().toUpperCase()] || ['No data', '#808080']; }
function srpBreaks() { var v = WATER.srp.map(function (x) { return x.mean; }).sort(function (a, b) { return a - b; }); return [0.2, 0.4, 0.6, 0.8].map(function (q) { return v[Math.min(v.length - 1, Math.floor(q * v.length))]; }); }
function srpColour(m, br) { var i = 0; while (i < br.length && m > br[i]) i++; return VIOLETS[i]; }
function tidyName(s) { return String(s || '').toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }
function waterPanel(m) {
var h = '';
if (!WATER) return '<p class="small">Loading the water quality data from DAERA. If this message stays, the service is not answering just now.</p>';
if (m === 'srp') {
var S = WATER.srp;
if (!S || !S.length) return '<p class="small">The river test results could not be loaded just now.</p>';
var byB = {}, up = 0, down = 0, both = 0;
S.forEach(function (x) { var b = byB[x.basin || 'Other'] = byB[x.basin || 'Other'] || { s: 0, n: 0 }; b.s += x.mean; b.n++; if (x.prev != null) { both++; if (x.mean > x.prev) up++; else if (x.mean < x.prev) down++; } });
var rows = Object.keys(byB).map(function (k) { return [k, byB[k].s / byB[k].n, byB[k].n]; }).sort(function (a, b) { return b[1] - a[1]; });
h += '<p>DAERA tests river water for dissolved phosphorus, the form algae can use straight away. Each dot is a test site, coloured by its average for 2020 to 2024. These are measurements, not model estimates.</p><div class="bars">';
rows.forEach(function (r) { h += '<div class="bar"><span>' + esc(r[0]) + '</span><span class="track"><span class="fill" style="display:block;width:' + (r[1] / rows[0][1] * 100).toFixed(0) + '%"></span></span><span class="val">' + r[1].toFixed(3) + '</span></div>'; });
h += '</div><p class="small">Average milligrams of dissolved phosphorus per litre, 2020 to 2024, across the test sites in each basin (' + S.length + ' sites in the map area).</p>' +
(both ? '<p>Of the ' + both + ' sites also tested in 2015 to 2019, ' + up + ' averaged higher in 2020 to 2024 and ' + down + ' averaged lower.</p>' : '') +
'<p class="small">DAERA river monitoring data, 1990 to 2024. It is published raw, so it can contain errors. Readings of 5 mg/l or more are left out as likely errors, and sites with fewer than six readings are not shown. Tap a dot for its figures.</p>';
} else if (m === 'sewage') {
var V = WATER.overflows;
if (!V || !V.length) return '<p class="small">The storm overflow list could not be loaded just now.</p>';
var bad = 0, spills = 0, vol = 0, mon = 0;
V.forEach(function (x) { if (/unsat/i.test(x.cls)) bad++; spills += x.spills; vol += x.vol; if (/^y/i.test(x.mon)) mon++; });
h += '<p>When heavy rain overloads the sewers, storm overflows release untreated sewage mixed with rainwater into rivers. NI Water\'s own model predicts how often each one spills in a typical year.</p>' +
'<dl class="facts">' +
'<div><dt>Storm overflows on the map</dt><dd>' + nf(V.length) + '</dd></div><div><dt>Classed unsatisfactory</dt><dd>' + nf(bad) + '</dd></div>' +
'<div><dt>Predicted spills a year</dt><dd>' + nf(spills) + '</dd></div><div><dt>Predicted volume a year</dt><dd>' + nf(vol / 1000) + ' thousand m³</dd></div>' +
'<div><dt>Fitted with a monitor</dt><dd>' + nf(mon) + '</dd></div>' + (DATA && DATA.works ? '<div><dt>Treatment works on the map</dt><dd>' + nf(DATA.works.length) + '</dd></div>' : '') +
'</dl><p class="small">Bigger dots spill more often. Red dots are classed unsatisfactory by NI Water. Grey dots are treatment works. From NI Water\'s May 2024 lists, published by DAERA. The spill figures are predictions from a model, not measurements, and not every site on the map drains to the lough.</p>';
} else {
var W = WATER.status;
if (!W) return '<p class="small">The water status map could not be loaded just now.</p>';
var cnt = {}, order = ['High', 'Good', 'Moderate', 'Poor', 'Bad', 'No data'];
W.features.forEach(function (f) { var k = wfd(f.properties.F2018_statu)[0]; cnt[k] = (cnt[k] || 0) + 1; });
var mxs = Math.max.apply(null, order.map(function (k) { return cnt[k] || 0; }).concat([1]));
h += '<p>DAERA grades every river and lake from high to bad, looking at the wildlife, the chemistry and the flow. The target is good or better. This is the 2018 grading for the rivers and lakes around the lough.</p><div class="bars">';
order.forEach(function (k) { if (cnt[k]) h += '<div class="bar"><span>' + k + '</span><span class="track"><span class="fill" style="display:block;width:' + (cnt[k] / mxs * 100).toFixed(0) + '%"></span></span><span class="val">' + cnt[k] + '</span></div>'; });
h += '</div>';
var F = WATER.failing && WATER.failing.features ? WATER.failing.features : [];
if (F.length) h += '<p>' + F.length + ' of them, outlined in black, miss the target because of phosphorus alone: ' + F.map(function (f) { return esc(f.properties.NAME); }).join(', ') + '.</p>';
h += '<p class="small">Number of water bodies in the map area at each grade, Water Framework Directive interim classification 2018. Heavily modified waters are graded on "ecological potential" and are shown in the same colours. Tap one for its name and grade.</p>';
}
return h;
}
/* ---------- likely sources, basin by basin ---------- */
var BASIN_LABEL = { 'River Blackwater': 'Blackwater', 'Braid and Main': 'Main', 'Lough Neagh': 'Lough shore streams' };
function basinLabel(n) { return BASIN_LABEL[n] || n; }
var FARM_IND = [
['Cattle per square km', function (b) { return b.cattle / b.km2; }, 0],
['Pigs per square km', function (b) { return b.pigs / b.km2; }, 0],
['Poultry per square km', function (b) { return b.poultry / b.km2; }, 0],
['High-risk share of scored farmland', function (b) { var f = b.fieldHa, t = f ? f.low + f.medium + f.high : 0; return t ? f.high / t * 100 : null; }, 0, '%'],
['Farm pollution incidents per 100 square km', function (b) { return b.incFarm / b.km2 * 100; }, 1]
];
var SEWAGE_IND = [
['Storm overflow spills, cubic metres per square km a year', function (b) { return b.spillVol / b.km2; }, 0],
['Storm overflows per 100 square km', function (b) { return b.overflows / b.km2 * 100; }, 1],
['Treatment works per 100 square km', function (b) { return b.works / b.km2 * 100; }, 1],
['Sewage and household incidents per 100 square km', function (b) { return b.incSewage / b.km2 * 100; }, 1]
];
function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
/* Rank 1 is the highest value among the basins. Basins with no value are left out. */
function rankOf(fn, b) {
var v = fn(b); if (v == null || !isFinite(v)) return null;
var r = 1; SOURCES.basins.forEach(function (o) { var w = fn(o); if (w != null && isFinite(w) && w > v) r++; });
return r;
}
function pressure(list, b) {
var s = 0, n = 0; list.forEach(function (ind) { var r = rankOf(ind[1], b); if (r != null) { s += r; n++; } });
if (!n) return null;
return { avg: s / n };
}
function pressureRank(list, b) {
var mine = pressure(list, b); if (!mine) return null;
var r = 1; SOURCES.basins.forEach(function (o) { var p = pressure(list, o); if (p && p.avg < mine.avg - 1e-9) r++; });
return r;
}
/* The top two basins count as high, the bottom two as low. */
function levelOf(rank) { var N = SOURCES.basins.length; return rank <= 2 ? 2 : rank >= N - 1 ? 0 : 1; }
function place(rank, word) { var N = SOURCES.basins.length; return rank === 1 ? word + ' of ' + N : rank === N ? 'lowest of ' + N : ordinal(rank) + ' ' + word + ' of ' + N; }
function testMean(b) { return b.tests ? b.tests.mean : null; }
function indRows(list, b) {
return list.map(function (ind) {
var v = ind[1](b), r = rankOf(ind[1], b);
return '<tr><th scope="row">' + ind[0] + '</th><td>' + (v == null || !isFinite(v) ? 'n/a' : (ind[2] ? v.toFixed(ind[2]) : nf(v)) + (ind[3] || '')) + '</td><td>' + (r == null ? '' : ordinal(r)) + '</td></tr>';
}).join('');
}
function sourcesPanel() {
if (!SOURCES) return '<p class="small">Working out the pressure on each basin from the DAERA data. This can take a few seconds the first time. If this message stays, the service is not answering just now.</p>';
var B = SOURCES.basins, N = B.length, b = B.filter(function (x) { return x.name === state.basin; })[0] || B[0];
var LEV = ['Low', 'Middle', 'High'], fp = pressure(FARM_IND, b), sp = pressure(SEWAGE_IND, b), tr = rankOf(testMean, b);
var fr = fp ? pressureRank(FARM_IND, b) : null, sr = sp ? pressureRank(SEWAGE_IND, b) : null;
var h = '<p>Every dataset on this site has been matched to the same river basins. Pick a basin to see which pressures stand out there, compared with the other ' + (N - 1) + '.</p>' +
'<div class="seg" role="group" aria-label="Basin">' + B.map(function (x, i) { return '<button type="button" id="basin_' + i + '" data-basin="' + esc(x.name) + '" aria-pressed="' + (x.name === b.name) + '">' + basinLabel(x.name) + '</button>'; }).join('') + '</div>' +
'<h3>' + basinLabel(b.name) + ' basin, ' + nf(b.km2) + ' square km</h3>';
if (b.tests) h += '<div class="readout"><span>Phosphorus measured in its rivers</span><span class="badge l' + levelOf(tr) + '">' + b.tests.mean.toFixed(3) + ' mg/l, ' + place(tr, 'highest') + '</span></div>' +
(b.tests.sitesBoth ? '<p class="small">Average of ' + b.tests.sites + ' test sites, 2020 to 2024. At the ' + b.tests.sitesBoth + ' sites also tested in 2015 to 2019 the average went from ' + b.tests.thenBoth.toFixed(3) + ' to ' + b.tests.nowBoth.toFixed(3) + ' mg/l.</p>' : '');
if (fp && sp) {
var fl = levelOf(fr), sl = levelOf(sr);
h += '<div class="readout"><span>Farming pressure</span><span class="badge l' + fl + '">' + LEV[fl] + ', ' + place(fr, 'highest') + '</span></div>' +
'<div class="readout"><span>Sewage pressure</span><span class="badge l' + sl + '">' + LEV[sl] + ', ' + place(sr, 'highest') + '</span></div>' +
'<p>' + (fl === sl ? 'Farming and sewage pressure are both ' + LEV[fl].toLowerCase() + ' here compared with the other basins.' : 'Compared with the other basins, farming pressure is ' + LEV[fl].toLowerCase() + ' here and sewage pressure is ' + LEV[sl].toLowerCase() + '.') + ' ' + (fr <= sr - 2 ? 'That points to farming as the place to look first.' : sr <= fr - 2 ? 'That points to sewage as the place to look first.' : 'Neither stands out over the other, so both are worth looking at.') + '</p>';
}
h += '<div class="tablewrap"><table class="wx src"><thead><tr><th scope="col" class="lh">Farming</th><th scope="col">Value</th><th scope="col">Rank</th></tr></thead><tbody>' + indRows(FARM_IND, b) + '</tbody>' +
'<thead><tr><th scope="col" class="lh">Sewage</th><th scope="col">Value</th><th scope="col">Rank</th></tr></thead><tbody>' + indRows(SEWAGE_IND, b) + '</tbody></table></div>' +
'<p class="small">Rank 1st means the highest of the ' + N + ' basins. Each pressure level is the average of the ranks in its table.</p>' +
'<details class="fold"><summary>What this does and does not show</summary><ul class="notes">' +
'<li>It shows where pressure is high compared with the other basins. It does not measure how much pollution each source causes, and it cannot point to a farm, a home or a works.</li>' +
'<li>Livestock numbers are published by council area, so each area\'s animals are shared between basins by land area. That is an estimate.</li>' +
'<li>The field risk map covers only some farmland, storm overflow spills are NI Water\'s predictions, and the datasets span 2007 to 2024.</li>' +
'<li>Septic tanks, industry and the phosphorus already in the lough bed are not counted. The lough shore basin\'s area leaves out the lough itself.</li>' +
'</ul></details>';
return h;
}
function landSeg() {
return '<div class="seg" role="group" aria-label="What to show on the map">' +
[['rivers', 'River loads'], ['sources', 'Likely sources'], ['basins', 'Basins'], ['cover', 'Land cover'], ['farms', 'Livestock'], ['fields', 'Fields'], ['incidents', 'Pollution'], ['srp', 'River tests'], ['sewage', 'Sewage'], ['status', 'Water status']].map(function (g) { return '<button type="button" id="land_' + g[0] + '" data-land="' + g[0] + '" aria-pressed="' + (landMode() === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div>';
}
function landPanel() {
var h = '', m = landMode();
if (m === 'srp' || m === 'sewage' || m === 'status') return waterPanel(m);
if (m === 'sources') return sourcesPanel();
if (!LAND) return '<p class="small">Loading the land data from DAERA. If this message stays, the service is not answering just now.</p>';
if (m === 'basins') {
if (!LAND.basins) return '<p class="small">The basin outlines could not be loaded just now.</p>';
h += '<p>Each river drains its own basin. This shows how much phosphorus leaves every hectare of a basin in a year, so a basin that sheds a lot for its size stands out.</p><div class="bars">';
BASIN_P.forEach(function (b, i) {
var name = ['Blackwater', 'Upper Bann', 'Six Mile Water', 'Main', 'Lough shore streams', 'Moyola', 'Ballinderry', 'Lower Bann'][i];
h += '<div class="bar"><span>' + name + '</span><span class="track"><span class="fill" style="display:block;width:' + (b.kg / 1.16 * 100).toFixed(0) + '%"></span></span><span class="val">' + b.kg.toFixed(2) + '</span></div>';
});
h += '</div><p class="small">Kilograms of phosphorus per hectare per year. AFBI modelling, 2021 reference year, provisional. The outlines are DAERA\'s Local Management Areas. The Blackwater basin carries on across the border and only the Northern Ireland part is drawn. The Lower Bann is downstream of the lough. Grey basins drain elsewhere. Tap a basin for its figures.</p>';
} else if (m === 'farms') {
if (!LAND.farms) return '<p class="small">The farm census could not be loaded just now.</p>';
var T = { farms: 0, area: 0, crops: 0, grass: 0, cattle: 0, sheep: 0, pigs: 0, poultry: 0 };
LAND.farms.features.forEach(function (f) { var p = f.properties; T.farms += p.NumberOfFarms || 0; T.area += p.TotalAreaFarmedInHa || 0; T.crops += p.TotalCrops || 0; T.grass += p.TotalGrassRGrazingHa || 0; T.cattle += p.TotalNumberofCattle || 0; T.sheep += p.TotalNumberofsheep || 0; T.pigs += p.TotalNumberOfPigs || 0; T.poultry += (p.TotalNumberOfPoultry000 || 0) * 1000; });
var gp = T.grass + T.crops > 0 ? T.grass / (T.grass + T.crops) * 100 : 0;
h += '<p>Of the land farmed around the lough, ' + gp.toFixed(0) + '% is grass and rough grazing and ' + (100 - gp).toFixed(0) + '% is crops. The map shades each area by how many animals it has for every hectare farmed, a fifth of the areas in each shade.</p>' +
'<div class="seg" role="group" aria-label="Animal to shade the map by">' + ['cattle', 'sheep', 'pigs', 'poultry'].map(function (k) { return '<button type="button" id="stock_' + k + '" data-stock="' + k + '" aria-pressed="' + (state.stock === k) + '">' + STOCK[k][0] + '</button>'; }).join('') + '</div>' +
'<dl class="facts">' +
'<div><dt>Farms</dt><dd>' + nf(T.farms) + '</dd></div><div><dt>Land farmed</dt><dd>' + nf(T.area) + ' ha</dd></div>' +
'<div><dt>Cattle</dt><dd>' + nf(T.cattle) + '</dd></div><div><dt>Sheep</dt><dd>' + nf(T.sheep) + '</dd></div>' +
'<div><dt>Pigs</dt><dd>' + nf(T.pigs) + '</dd></div><div><dt>Poultry</dt><dd>' + nf(T.poultry) + '</dd></div>' +
'</dl>' + (function () { var p = farmTop(), k = STOCK[state.stock]; return p ? '<p>The highest is ' + esc(tidyName(p.DEAName)) + ', with ' + nf((p[k[1]] || 0) * k[2]) + ' ' + k[0].toLowerCase() + ' on ' + nf(p.TotalAreaFarmedInHa) + ' hectares of farmland, which is ' + stockPerHa(p).toFixed(1) + ' per hectare.' + (p.TotalAreaFarmedInHa < 2000 ? ' It has very little farmland, so its figure per hectare is far above the rest.' : '') + '</p>' : ''; })() + '<p class="small">DAERA farm census 2019, added up over the ' + LAND.farms.features.length + ' district electoral areas that touch the map. These follow council boundaries, not river basins, so some of this land drains elsewhere. Tap an area for its own figures.</p>' + slurryHtml();
} else if (m === 'cover') {
h += '<p>This is how the land is used, mapped from satellite images by the European Copernicus programme. Around the lough it is mostly pasture, with towns, peat bog and some arable land.</p>' +
'<div class="legend">' + [['#e6e64d', 'Pasture'], ['#ffffa8', 'Arable'], ['#ffe64d', 'Mixed farmland'], ['#ff0000', 'Towns'], ['#4d4dff', 'Peat bog'], ['#00a600', 'Woodland'], ['#80f2e6', 'Water']].map(function (k) { return '<span class="key"><span class="sw" style="background:' + k[0] + '"></span>' + k[1] + '</span>'; }).join('') + '</div>' +
'<p class="small">Corine Land Cover 2018, Copernicus Land Monitoring Service. It maps blocks of 25 hectares or more, so small fields and hedges do not show. The key lists the main colours only.</p>';
} else if (m === 'incidents') {
var inc = LAND.incidents;
if (!inc) return '<p class="small">The pollution incident records could not be loaded just now.</p>';
var I = { t: 0, farm: 0, niw: 0, dom: 0, ind: 0, high: 0, recent: 0 };
inc.forEach(function (x) { I.t += x.t; I.farm += x.farm; I.niw += x.niw; I.dom += x.dom; I.ind += x.ind; I.high += x.high; I.recent += x.recent; });
var oth = Math.max(0, I.t - I.farm - I.niw - I.dom - I.ind), mx = Math.max(I.farm, I.niw, I.dom, I.ind, oth, 1);
h += '<p>DAERA confirmed ' + nf(I.t) + ' water pollution incidents in the area of the map between 2011 and 2024. Each square is one kilometre across, and darker means more incidents.</p><div class="bars">' +
[['Farms', I.farm], ['Homes', I.dom], ['Industry', I.ind], ['NI Water', I.niw], ['Other or unknown', oth]].map(function (b) { return '<div class="bar"><span>' + b[0] + '</span><span class="track"><span class="fill" style="display:block;width:' + (b[1] / mx * 100).toFixed(0) + '%"></span></span><span class="val">' + nf(b[1]) + '</span></div>'; }).join('') + '</div>' +
'<dl class="facts"><div><dt>High severity</dt><dd>' + nf(I.high) + '</dd></div><div><dt>Since 2020</dt><dd>' + nf(I.recent) + '</dd></div></dl>' +
'<p class="small">Confirmed incidents in and around watercourses, by where the pollution came from. DAERA publishes them grouped into ' + nf(inc.length) + ' one-kilometre squares so that no single property can be picked out. Tap a square for its figures.</p>';
} else {
var st = LAND.fieldStats || [], by = { 1: 0, 2: 0, 3: 0 }, tot = 0, nfields = 0;
st.forEach(function (x) { if (by[x.risk] != null) { by[x.risk] += x.ha; tot += x.ha; nfields += x.fields || 0; } });
h += '<p>DAERA\'s agricultural risk map picks out parcels of arable land and improved grassland and scores each one for its risk of losing nutrients to water. The score uses slope, rainfall, soil, soil phosphorus and distance to a river, among other things.</p>';
if (tot > 0) {
h += '<div class="split" role="img" aria-label="Share of scored farmland at low, medium and high risk">' + [1, 2, 3].map(function (k) { return '<span style="width:' + (by[k] / tot * 100).toFixed(1) + '%;background:' + RISK[k][1] + '"></span>'; }).join('') + '</div>' +
'<div class="legend">' + [1, 2, 3].map(function (k) { return '<span class="key"><span class="sw" style="background:' + RISK[k][1] + '"></span>' + RISK[k][0] + ' ' + (by[k] / tot * 100).toFixed(0) + '%, ' + nf(by[k]) + ' ha</span>'; }).join('') + '</div>';
}
h += '<h3>See the fields</h3><p class="small">Zoom in on the map and the individual parcels appear. Or jump to:</p><div class="seg" role="group" aria-label="Jump to a place">' +
GOTO.map(function (g, i) { return '<button type="button" id="goto_' + i + '" data-goto="' + i + '">' + g[0] + '</button>'; }).join('') + '<button type="button" id="goto_all" data-goto="all">Whole lough</button></div>' +
'<p class="small" id="fieldNote" role="status">Zoom in closer to load the fields.</p>' +
'<p class="small">' + (tot > 0 ? 'The risk map has ' + nf(nfields) + ' parcels covering ' + nf(tot) + ' ha in the area of the map, so it does not include every field. ' : '') + 'DAERA built it from the 2007 land cover map and 2015 water quality results, so it shows where risk sits, not how each field is farmed today. On a phone you can drag the map in this view.</p>';
}
return h;
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
'<p class="small">Under the map, <strong>View</strong> switches to a satellite image, and <strong>Shade by</strong> and <strong>Show</strong> add any of the data layers. Each step of this tour also switches on the layers that go with it.</p>';
} else if (s === 1) {
h += '<p>The coloured layer is the Geological Survey of Northern Ireland\'s 1:250,000 map. Where the surface is clay or peat, rain drains poorly and runs off the fields quickly, taking phosphorus with it.</p>' +
'<div class="seg" role="group" aria-label="Geology layer">' +
[['sup', 'Surface deposits'], ['bed', 'Bedrock'], ['off', 'Map only']].map(function (g) { return '<button type="button" id="geo_' + g[0] + '" data-geo="' + g[0] + '" aria-pressed="' + ((state.shade === 'sup' || state.shade === 'bed' ? state.shade : 'off') === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div>' +
(state.shade === 'sup' || state.shade === 'bed' ? '<details class="legendbox"><summary>What the colours mean</summary><div class="legendimg"><img alt="Key to the geology colours, from the Geological Survey of Northern Ireland" loading="lazy" src="' + GSNI + '?service=WMS&amp;version=1.3.0&amp;request=GetLegendGraphic&amp;format=image/png&amp;layer=' + (state.shade === 'sup' ? '6' : '5') + '"></div></details>' : '') +
'<ul class="list">' +
'<li><strong>Shallow water</strong><span class="sub">Warms fast, and a strong wind can stir the bed all the way up.</span></li>' +
'<li><strong>Phosphorus in the mud</strong><span class="sub">Decades of nutrients sit in the sediment. AFBI scientists have said they could keep feeding the lough for around 40 years.</span></li>' +
'<li><strong>Zebra mussels</strong><span class="sub">First found in 2005 and now everywhere in the lough. They filter the water clear, so sunlight reaches deeper and algae grow faster.</span></li>' +
'</ul>';
} else if (s === 2) {
h += landSeg();
if (landMode() !== 'rivers') { h += landPanel(); } else {
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
}
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
/* ---------- analysis tab ---------- */
function spearman(a, b) {
var n = a.length, d = 0; for (var i = 0; i < n; i++) d += (a[i] - b[i]) * (a[i] - b[i]);
return n > 2 ? 1 - 6 * d / (n * (n * n - 1)) : 0;
}
function scatterSvg(list, label) {
var B = SOURCES.basins.filter(function (b) { return b.tests && pressure(list, b); }), N = SOURCES.basins.length;
var W = 340, H = 226, L = 38, R = 12, T = 12, Bt = 28, ymax = Math.ceil(Math.max.apply(null, B.map(function (b) { return b.tests.mean; })) / 0.05) * 0.05;
var X = function (v) { return L + (v - 1) / (N - 1) * (W - L - R); }, Y = function (v) { return H - Bt - v / ymax * (H - T - Bt); };
var h = '';
for (var g = 0; g <= ymax + 1e-9; g += 0.05) h += '<line x1="' + L + '" y1="' + Y(g) + '" x2="' + (W - R) + '" y2="' + Y(g) + '" stroke="var(--line)" stroke-width="1"/><text class="ct" x="' + (L - 6) + '" y="' + (Y(g) + 3) + '" text-anchor="end">' + g.toFixed(2) + '</text>';
h += '<text class="ct" x="' + L + '" y="' + (H - 8) + '">lower ' + label + ' pressure</text><text class="ct" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">higher ' + label + ' pressure</text>';
B.forEach(function (b) {
var x = X(N + 1 - pressure(list, b).avg), y = Y(b.tests.mean), right = x < W * 0.62;
h += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"/>' +
'<text class="ct strong" x="' + (x + (right ? 8 : -8)).toFixed(1) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + basinLabel(b.name).replace(' streams', '').replace(' Water', '') + '</text>';
});
return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter chart of phosphorus measured in each basin against its ' + label + ' pressure score">' + h + '</svg>';
}
function renderAnalysis() {
var el = $('analysisBody'); if (!el) return;
if (!SOURCES) { el.innerHTML = '<p class="small">Working out the analysis from the DAERA data. This can take a few seconds the first time. If this message stays, the service is not answering just now.</p>'; return; }
var B = SOURCES.basins.slice().filter(function (b) { return b.tests; }), N = SOURCES.basins.length, LEV = ['Low', 'Middle', 'High'];
B.sort(function (a, b) { return b.tests.mean - a.tests.mean; });
var info = B.map(function (b) { return { b: b, pr: rankOf(testMean, b), fr: pressureRank(FARM_IND, b), sr: pressureRank(SEWAGE_IND, b), d: b.tests.sitesBoth ? b.tests.nowBoth - b.tests.thenBoth : null }; });
var badge = function (rank) { return '<span class="badge l' + levelOf(rank) + '">' + LEV[levelOf(rank)] + '</span> ' + ordinal(rank); };
var h = '<h2>Where is the phosphorus likely to come from?</h2>' +
'<p class="lede">Every dataset on this site, matched to the seven river basins that flow into the lough and compared side by side.</p>';
/* findings */
var top = info[0], second = info[1], low = info[info.length - 1];
var odd = info.filter(function (i) { return i.fr - i.pr >= 3; })[0];
var up = info.filter(function (i) { return i.d != null && i.d > 0.002; }), down = info.filter(function (i) { return i.d != null && i.d < -0.002; });
var rf = spearman(info.map(function (i) { return i.pr; }), info.map(function (i) { return i.fr; })), rs = spearman(info.map(function (i) { return i.pr; }), info.map(function (i) { return i.sr; }));
h += '<h3>What stands out</h3><ul class="finds">' +
'<li><strong>' + basinLabel(top.b.name) + ' and ' + basinLabel(second.b.name) + '</strong> have the most phosphorus in their rivers, at ' + top.b.tests.mean.toFixed(3) + ' and ' + second.b.tests.mean.toFixed(3) + ' mg/l. Their farming pressure ranks ' + ordinal(top.fr) + ' and ' + ordinal(second.fr) + ' of ' + N + ', and their sewage pressure ' + ordinal(top.sr) + ' and ' + ordinal(second.sr) + '.</li>' +
'<li><strong>' + basinLabel(low.b.name) + '</strong> has the least, at ' + low.b.tests.mean.toFixed(3) + ' mg/l, with farming pressure ranked ' + ordinal(low.fr) + ' and sewage pressure ' + ordinal(low.sr) + '.</li>' +
(odd ? '<li><strong>' + basinLabel(odd.b.name) + '</strong> has more phosphorus than its farming pressure would suggest: ' + ordinal(odd.pr) + ' for phosphorus but ' + ordinal(odd.fr) + ' for farming. Its sewage pressure ranks ' + ordinal(odd.sr) + ', higher than its farming pressure.</li>' : '') +
'<li><strong>Since 2015 to 2019</strong>, average phosphorus at the same test sites has risen in ' + up.length + ' basin' + (up.length === 1 ? '' : 's') + (up.length ? ' (' + up.map(function (i) { return basinLabel(i.b.name); }).join(', ') + ')' : '') + ' and fallen in ' + down.length + (down.length ? ' (' + down.map(function (i) { return basinLabel(i.b.name); }).join(', ') + ')' : '') + '.</li>' +
'<li><strong>Pressure and phosphorus move together.</strong> Ranking the basins by phosphorus and by pressure gives a rank correlation of ' + rf.toFixed(2) + ' for farming and ' + rs.toFixed(2) + ' for sewage, where 1 is a perfect match. With only seven basins that is a pattern, not proof.</li>' +
'</ul>';
/* summary table */
h += '<h3>Basin by basin</h3><div class="tablewrap"><table class="wx an"><thead><tr><th scope="col" class="lh">Basin</th><th scope="col">Phosphorus in rivers</th><th scope="col">Since 2015 to 2019</th><th scope="col">Farming pressure</th><th scope="col">Sewage pressure</th><th scope="col">Look first at</th></tr></thead><tbody>';
info.forEach(function (i) {
var ch = i.d == null ? 'n/a' : Math.abs(i.d) <= 0.002 ? 'No change' : (i.d > 0 ? 'Up ' : 'Down ') + Math.abs(i.d).toFixed(3);
h += '<tr><th scope="row">' + basinLabel(i.b.name) + '</th><td>' + i.b.tests.mean.toFixed(3) + ' mg/l</td><td>' + ch + '</td><td>' + badge(i.fr) + '</td><td>' + badge(i.sr) + '</td><td>' + (i.fr <= i.sr - 2 ? 'Farming' : i.sr <= i.fr - 2 ? 'Sewage' : 'Both') + '</td></tr>';
});
h += '</tbody></table></div><p class="small">Phosphorus is the 2020 to 2024 average of dissolved phosphorus across each basin\'s DAERA test sites. Pressure ranks run from 1st, the highest, to ' + ordinal(N) + '. The top two count as high and the bottom two as low.</p>';
/* charts */
h += '<h3>Does pressure track phosphorus?</h3><div class="charts"><div class="chart"><p class="charttitle">Phosphorus in rivers (mg/l) against farming pressure</p>' + scatterSvg(FARM_IND, 'farming') + '</div><div class="chart"><p class="charttitle">Phosphorus in rivers (mg/l) against sewage pressure</p>' + scatterSvg(SEWAGE_IND, 'sewage') + '</div></div>' +
'<p class="small">Each dot is a basin. If pressure explained phosphorus perfectly, the dots would climb from bottom left to top right.</p>';
/* full matrix */
var cols = SOURCES.basins;
h += '<h3>All the figures</h3><div class="tablewrap"><table class="wx an"><thead><tr><th scope="col" class="lh">Per basin</th>' + cols.map(function (b) { return '<th scope="col">' + basinLabel(b.name) + '</th>'; }).join('') + '</tr></thead><tbody>';
var row = function (label, fn, dec, unit) { return '<tr><th scope="row">' + label + '</th>' + cols.map(function (b) { var v = fn(b); return '<td>' + (v == null || !isFinite(v) ? 'n/a' : (dec ? v.toFixed(dec) : nf(v)) + (unit || '')) + '</td>'; }).join('') + '</tr>'; };
h += row('Area, square km', function (b) { return b.km2; }) + row('Phosphorus in rivers, mg/l', testMean, 3) + row('River test sites', function (b) { return b.tests ? b.tests.sites : null; }) +
FARM_IND.map(function (i) { return row(i[0], i[1], i[2], i[3]); }).join('') + row('Sheep per square km', function (b) { return b.sheep / b.km2; }) +
SEWAGE_IND.map(function (i) { return row(i[0], i[1], i[2], i[3]); }).join('') +
row('Storm overflows classed unsatisfactory', function (b) { return b.unsat; }) + row('All confirmed pollution incidents, 2011 to 2024', function (b) { return b.incidents; }) + row('Of those, since 2020', function (b) { return b.incRecent; }) + row('Industry incidents', function (b) { return b.incIndustry; });
h += '</tbody></table></div>';
/* whole catchment */
h += '<h3>The whole catchment</h3><p>AFBI\'s modelling for the whole catchment puts 61% of the phosphorus reaching the lough down to agriculture, 29% to wastewater, 9% to other sources and 1.3% to septic tanks. The basin comparison above is a separate check using different data, and it points the same way: the basins with the most farming and sewage pressure have the most phosphorus in their rivers.</p>' +
'<details class="fold"><summary>What this does and does not show</summary><ul class="notes">' +
'<li>It ranks pressure. It does not measure how much pollution each source causes, and it cannot point to a farm, a home or a works.</li>' +
'<li>Farming and sewage pressure tend to be high in the same basins, so this data cannot cleanly separate the two.</li>' +
'<li>Seven basins is a small number. A difference of one rank is not meaningful.</li>' +
'<li>Livestock is published by council area and shared between basins by land area, which is an estimate. The field risk map covers only some farmland. Storm overflow spills are NI Water\'s predictions. The datasets span 2007 to 2024.</li>' +
'<li>Septic tanks, industry and the phosphorus already in the lough bed are not counted. The lough shore basin\'s area leaves out the lough itself.</li>' +
'<li>The river test data is published raw and may contain errors. Readings of 5 mg/l or more and sites with fewer than six readings are left out.</li>' +
'</ul></details><p class="small">Sources: DAERA open data under the Open Government Licence v3.0 (river tests 1990 to 2024, farm census 2019, agricultural risk map, pollution incidents 2011 to 2024, NI Water storm overflows and treatment works May 2024, Local Management Areas) and AFBI modelling, 2021 reference year, provisional.</p>';
el.innerHTML = h;
}
/* ---------- key areas: the specific places the data flags ---------- */
var HOT = null, HOTFAIL = false, HOTMAP = null, HOTPIN = {}, HOTGRP = {}, HOTCL = [], hotDrawn = false;
var hotOn = { p: true, r: true, s: true, i: true, c: true, a: true };
var HOTCAT = [['p', 'Highest phosphorus'], ['r', 'Rising phosphorus'], ['s', 'Storm overflows'], ['i', 'Pollution incidents'], ['c', 'Flagged twice'], ['a', 'Confirmed algae']];
/* DAERA publishes river site names with the spaces removed. Put back the ones we can be sure of. */
function siteName(raw) {
var s = String(raw || '').toUpperCase(), m = /(RIVER|STREAM|TRIB\)?|WATER|BURN)AT(?=[A-Z])/.exec(s), river, at;
if (m) { river = s.slice(0, m.index + m[1].length); at = s.slice(m.index + m[1].length + 2); }
else { m = /RAT(?=[A-Z])/.exec(s); if (!m) return tidyName(raw); river = s.slice(0, m.index) + ' RIVER'; at = s.slice(m.index + 3); }
river = river.replace(/(RIVER|STREAM|TRIB)/g, ' $1 ').replace(/\(/g, ' (').replace(/\s+\)/g, ')').replace(/\(\s+/g, '(');
at = at.replace(/RDBR$/, ' ROAD BRIDGE').replace(/([^E])BR$/, '$1 BRIDGE').replace(/(LANEWAY|BRIDGE|STREET|ROAD)/g, ' $1 ').replace(/ OFF(?=[A-Z])/, ' OFF ');
var tidy = function (x) { return tidyName(x.replace(/\s+/g, ' ').trim()); };
return tidy(river) + ' at ' + tidy(at).replace(/ Off /, ' off ');
}
function kmBetween(a, b) { var dy = (a.lat - b.lat) * 111.2, dx = (a.lon - b.lon) * 111.2 * Math.cos(a.lat * Math.PI / 180); return Math.sqrt(dx * dx + dy * dy); }
function incWho(q) {
var parts = [['farming', q.farm], ['sewage or households', q.sewage], ['industry', q.industry]].filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
return parts.length ? parts.map(function (x) { return x[1] + ' ' + x[0]; }).join(', ') : 'no source recorded';
}
/* Turn the feed into one list of pins. A site that is both high and rising gets one pin. */
function hotItems() {
var out = [], byCode = {};
HOT.sites.forEach(function (x, k) { var it = { id: 'P' + (k + 1), cat: 'p', lat: x.lat, lon: x.lon, x: x, name: siteName(x.name), rising: false }; byCode[x.code] = it; out.push(it); });
var rk = 0;
HOT.risers.forEach(function (x) { if (byCode[x.code]) byCode[x.code].rising = true; else { rk++; out.push({ id: 'R' + rk, cat: 'r', lat: x.lat, lon: x.lon, x: x, name: siteName(x.name), rising: true }); } });
HOT.overflows.forEach(function (x, k) { out.push({ id: 'S' + (k + 1), cat: 's', lat: x.lat, lon: x.lon, x: x, name: x.name }); });
HOT.squares.forEach(function (x, k) { out.push({ id: 'I' + (k + 1), cat: 'i', lat: x.lat, lon: x.lon, x: x, name: 'Square in the ' + basinLabel(x.basin) + ' basin' }); });
return out;
}
/* Places where two different kinds of flag fall within 2 km of each other. */
function hotClusters(items) {
var seen = {}, out = [];
items.forEach(function (start) {
if (seen[start.id]) return;
var grp = [start], q = [start]; seen[start.id] = true;
while (q.length) { var cur = q.pop(); items.forEach(function (o) { if (!seen[o.id] && kmBetween(cur, o) <= 2) { seen[o.id] = true; grp.push(o); q.push(o); } }); }
var kinds = {}; grp.forEach(function (g) { kinds[g.cat === 'r' ? 'p' : g.cat] = 1; });
if (Object.keys(kinds).length >= 2) out.push(grp);
});
return out.map(function (grp, k) {
var lat = 0, lon = 0; grp.forEach(function (g) { lat += g.lat / grp.length; lon += g.lon / grp.length; });
var c = { id: String.fromCharCode(65 + k), lat: lat, lon: lon, items: grp }, rad = 0;
grp.forEach(function (g) { rad = Math.max(rad, kmBetween(c, g)); });
c.radius = rad * 1000 + 700;
var named = grp.filter(function (g) { return g.cat === 's'; })[0] || grp.filter(function (g) { return g.cat !== 'i'; })[0];
c.name = named ? 'Around ' + named.name : 'In the ' + basinLabel(grp[0].x.basin) + ' basin';
c.basin = grp[0].x.basin;
return c;
});
}
function hotPopup(it) {
var x = it.x, b = basinLabel(x.basin) + ' basin';
if (it.cat === 'p' || it.cat === 'r') return '<strong>' + it.id + ' · ' + esc(it.name) + '</strong><br>' + b + ', DAERA site ' + esc(x.code) + '<br>2020 to 2024 average: ' + x.mean.toFixed(3) + ' mg/l of dissolved phosphorus, from ' + x.n + ' tests' + (x.prev == null ? '' : '<br>2015 to 2019 average: ' + x.prev.toFixed(3) + ' mg/l' + (it.rising ? ', so it has risen' : ''));
if (it.cat === 's') return '<strong>' + it.id + ' · ' + esc(x.name) + '</strong><br>' + b + (x.into && x.into !== 'Undefined' ? ', spills into ' + esc(x.into) : '') + '<br>Predicted to spill ' + nf(x.spills) + ' times and ' + nf(x.vol) + ' cubic metres a year' + (x.cls ? '<br>NI Water class: ' + esc(x.cls) : '');
return '<strong>' + it.id + ' · 1 km square, ' + b + '</strong><br>' + x.t + ' pollution incidents recorded, 2011 to 2024<br>' + x.recent + ' of them since 2020' + (x.high ? ', ' + x.high + ' rated high severity' : '') + '<br>Recorded source: ' + incWho(x);
}
function hotIcon(it) { return L.divIcon({ html: '<span class="hp ' + it.cat + (it.rising && it.cat === 'p' ? ' up' : '') + '">' + it.id + '</span>', className: 'mk', iconSize: [32, 24], iconAnchor: [16, 12] }); }
function buildHotMap() {
if (!window.L) { $('hotMap').innerHTML = '<p class="mapfail">The map could not load. The list of places still works.</p>'; return; }
HOTMAP = L.map('hotMap', { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 8, maxZoom: 16, scrollWheelZoom: false, dragging: !L.Browser.mobile });
HOTMAP.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, zIndex: 1, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(HOTMAP);
var items = hotItems(), pts = [];
['p', 'r', 's', 'i', 'c', 'a'].forEach(function (k) { HOTGRP[k] = L.layerGroup(); });
items.forEach(function (it) {
if (it.cat === 'i') L.rectangle([[it.x.b[0], it.x.b[1]], [it.x.b[2], it.x.b[3]]], { color: '#bf3528', weight: 2, fillColor: '#bf3528', fillOpacity: 0.18, interactive: false }).addTo(HOTGRP.i);
var m = L.marker([it.lat, it.lon], { icon: hotIcon(it), title: it.id + ' ' + it.name, alt: it.id + ' ' + it.name, zIndexOffset: it.cat === 'p' ? 400 : it.cat === 's' ? 300 : 200 }).bindPopup(hotPopup(it));
m.on('click', function () { loadNear(it); });
m.addTo(HOTGRP[it.cat]); HOTPIN[it.id] = { it: it, m: m }; pts.push([it.lat, it.lon]);
});
HOTCL.forEach(function (c) {
var ring = L.circle([c.lat, c.lon], { radius: c.radius, color: '#10262e', weight: 2, dashArray: '6 5', fill: false, interactive: false }).addTo(HOTGRP.c);
L.marker([c.lat + c.radius / 111200, c.lon], { interactive: false, keyboard: false, icon: L.divIcon({ html: '<span class="hp c">' + c.id + '</span>', className: 'mk', iconSize: [32, 24], iconAnchor: [16, 12] }), zIndexOffset: 100 }).addTo(HOTGRP.c);
c.ring = ring;
});
Object.keys(HOTGRP).forEach(function (k) { if (hotOn[k]) HOTGRP[k].addTo(HOTMAP); });
HOTMAP.fitBounds(L.latLngBounds(pts).pad(0.06));
hotExtras();
}
/* Basin outlines and confirmed algae arrive from other feeds, so add them whenever they are ready. */
var hotBasinsDone = false, hotAlgaeDone = false;
function hotExtras() {
if (!HOTMAP) return;
if (!hotBasinsDone && LAND && LAND.basins && SOURCES) {
hotBasinsDone = true;
var keep = {}; SOURCES.basins.forEach(function (b) { keep[b.name] = 1; });
L.geoJSON(LAND.basins, { filter: function (f) { return keep[f.properties.NAME]; }, style: function () { return { color: '#10262e', weight: 1.5, opacity: 0.55, fill: false }; }, interactive: false }).addTo(HOTMAP);
}
if (!hotAlgaeDone && DATA && DATA.algae && DATA.algae.length) {
hotAlgaeDone = true;
DATA.algae.forEach(function (a) { L.circleMarker([a.lat, a.lon], { radius: 4.5, color: '#ffffff', weight: 1.5, fillColor: '#b0206a', fillOpacity: 0.9 }).bindTooltip(a.name + ', algae confirmed ' + fmtDate(a.date) + ' ' + a.date.slice(0, 4)).addTo(HOTGRP.a); });
}
}
/* ---------- what is recorded near a pin ---------- */
var NEAR = {}, nearFor = null;
function loadNear(it) {
nearFor = it; var key = it.id;
if (NEAR[key] || !window.fetch) { renderNear(); return; }
NEAR[key] = 'loading'; renderNear();
fetch('/api/nearby?lat=' + it.lat + '&lon=' + it.lon + '&km=3').then(function (res) { return res.json(); }).then(function (j) { NEAR[key] = j && j.ok ? j : 'fail'; renderNear(); }).catch(function () { NEAR[key] = 'fail'; renderNear(); });
}
function renderNear() {
var el = $('hotNear'), it = nearFor; if (!el) return; if (!it) { el.innerHTML = ''; return; }
var d = NEAR[it.id], head = '<h3>Within 3 km of ' + it.id + ' · ' + esc(it.name) + '</h3>';
if (d === 'loading' || !d) { el.innerHTML = head + '<p class="small" role="status">Looking up what DAERA records nearby.</p>'; return; }
if (d === 'fail') { el.innerHTML = head + '<p class="small">The nearby records could not be loaded just now.</p>'; return; }
var where = function (x) { return x.km == null ? '' : x.km.toFixed(1) + ' km ' + x.dir; }, rows = [];
if (Array.isArray(d.works)) rows.push(['Sewage treatment works', d.works.length ? d.works.map(function (w) { return '<strong>' + esc(w.name) + '</strong>, ' + where(w) + (w.into ? ', discharging to the ' + esc(w.into) : ''); }).join('<br>') : 'None recorded.']);
if (Array.isArray(d.overflows)) { var sp = d.overflows.filter(function (o) { return o.vol > 0; }); rows.push(['Storm overflows and pumping stations', d.overflows.length ? '<strong>' + d.overflows.length + '</strong> NI Water overflow ' + (d.overflows.length === 1 ? 'point' : 'points') + '. ' + (sp.length ? 'With a predicted spill: ' + sp.slice(0, 4).map(function (o) { return esc(o.name) + ' (' + nf(o.vol) + ' cubic metres a year, ' + where(o) + ')'; }).join('; ') + '.' : 'None has a predicted spill figure yet. NI Water lists ' + d.overflows.filter(function (o) { return /determined/i.test(o.cls); }).length + ' as still to be assessed.') + ' Nearest: ' + esc(d.overflows[0].name) + ', ' + where(d.overflows[0]) + '.' : 'None recorded.']); }
if (d.incidents && d.incidents.squares != null) { var i = d.incidents; rows.push(['Pollution incidents, 2011 to 2024', i.total ? '<strong>' + i.total + '</strong> in the squares around here: ' + i.farm + ' recorded as farming, ' + i.sewage + ' as sewage or households, ' + i.industry + ' as industry, and ' + (i.total - i.farm - i.sewage - i.industry) + ' other or unknown. ' + i.recent + ' since 2020' + (i.high ? ', ' + i.high + ' rated high severity' : '') + '.' : 'None recorded.']); }
if (d.farmArea) { var f = d.farmArea, ha = f.farmedHa || 1; rows.push(['Farming in the wider area', 'The ' + esc(tidyName(f.name)) + ' district electoral area (2019 farm census) has ' + nf(f.farms) + ' farms on ' + nf(f.farmedHa) + ' hectares: <strong>' + nf(f.cattle) + ' cattle, ' + nf(f.pigs) + ' pigs, ' + nf(f.poultry) + ' poultry</strong> and ' + nf(f.sheep) + ' sheep. That is ' + (f.cattle / ha).toFixed(1) + ' cattle, ' + (f.pigs / ha).toFixed(1) + ' pigs and ' + Math.round(f.poultry / ha) + ' poultry per hectare farmed. The census does not say where each farm is.']); }
if (d.poultry && d.poultry.count != null) rows.push(['Poultry houses', d.poultry.count ? '<strong>' + d.poultry.count + (d.poultry.capped ? ' or more' : '') + '</strong> mapped within 3 km, the nearest ' + where(d.poultry.nearest[0]) + '. This comes from a DAERA layer marked as a test, so treat it as a pointer only.' : 'None mapped within 3 km in DAERA\'s test layer.']);
if (Array.isArray(d.waste)) rows.push(['Licensed waste sites', d.waste.length ? '<strong>' + d.waste.length + '</strong> on DAERA\'s public register within 3 km. These are licensed and inspected, and most do not discharge to rivers.' : 'None within 3 km.']);
el.innerHTML = head + '<dl class="invfinds">' + rows.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl><p class="small"><strong>Near is not the same as upstream.</strong> Only things upstream of a test site can affect its reading, and this list does not know which way the water flows. Nothing here shows that any site has broken a rule. Private businesses with their own discharge consents are not in DAERA\'s open data, so they are missing from this list.</p>';
}
function focusHot(id) {
var mapEl = $('hotMap');
if (HOTMAP) {
var cl = HOTCL.filter(function (c) { return c.id === id; })[0], pin = HOTPIN[id];
if (cl) { if (!hotOn.c) toggleHot('c'); HOTMAP.closePopup(); HOTMAP.fitBounds(cl.ring.getBounds().pad(0.25)); }
else if (pin) { if (!hotOn[pin.it.cat]) toggleHot(pin.it.cat); HOTMAP.setView([pin.it.lat, pin.it.lon], Math.max(HOTMAP.getZoom(), 13)); pin.m.openPopup(); loadNear(pin.it); }
}
var box = mapEl.getBoundingClientRect();
if (box.top < 0 || box.bottom > window.innerHeight) mapEl.scrollIntoView({ block: 'center' });
}
function toggleHot(k) {
hotOn[k] = !hotOn[k];
if (HOTMAP && HOTGRP[k]) { if (hotOn[k]) HOTGRP[k].addTo(HOTMAP); else HOTMAP.removeLayer(HOTGRP[k]); }
hotChips();
}
function hotChips() {
$('hotChips').innerHTML = '<div class="lrow"><span class="llab">Show</span>' + HOTCAT.map(function (g) { return chip('hotcat', g[0], g[1], hotOn[g[0]]); }).join('') + '<button type="button" class="chip" id="hotAll" data-hot="all">Whole area</button></div>';
}
function hotRow(id, cat, up, title, sub, val) {
return '<li><button type="button" class="hotitem" id="hot_' + id + '" data-hot="' + id + '"><span class="hp ' + cat + (up ? ' up' : '') + '">' + id + '</span><span class="hottxt"><strong>' + title + '</strong><span class="sub">' + sub + '</span></span><span class="val">' + val + '</span></button></li>';
}
function mostCommon(list) {
var n = {}, best = null; list.forEach(function (x) { n[x.basin] = (n[x.basin] || 0) + 1; if (!best || n[x.basin] > n[best]) best = x.basin; });
return { basin: best, n: n[best] };
}
function areasHtml(items) {
var P = items.filter(function (i) { return i.cat === 'p'; }), RI = items.filter(function (i) { return i.rising; }).sort(function (a, b) { return (b.x.mean - b.x.prev) - (a.x.mean - a.x.prev); });
var S = items.filter(function (i) { return i.cat === 's'; }), I = items.filter(function (i) { return i.cat === 'i'; });
var h = '<div><h2>Where to look first</h2><p class="lede">The individual places behind the Analysis tab: the river test sites, storm overflows and one-kilometre squares that stand out most in the seven basins flowing into the lough.</p></div>' +
'<p class="notice"><strong>A flag is a reason to look, not proof.</strong> A pin shows where a measurement or a record is high. It does not show who or what caused it.</p>';
var f = [];
if (P.length) { var mp = mostCommon(P.map(function (i) { return i.x; })); f.push('<strong>' + mp.n + ' of the ' + P.length + ' river sites with the most phosphorus</strong> are in the ' + basinLabel(mp.basin) + ' basin. The highest, ' + esc(P[0].name) + ', averages ' + P[0].x.mean.toFixed(3) + ' mg/l.'); }
if (RI.length) { var mr = mostCommon(RI.map(function (i) { return i.x; })); f.push('<strong>' + mr.n + ' of the ' + RI.length + ' sites that have risen most</strong> since 2015 to 2019 are in the ' + basinLabel(mr.basin) + ' basin.'); }
if (S.length) { var un = S.filter(function (i) { return i.x.cls === 'Unsatisfactory'; }).length; f.push('<strong>' + esc(S[0].name) + '</strong> is the storm overflow predicted to spill most, at ' + nf(S[0].x.vol) + ' cubic metres a year. NI Water classes ' + un + ' of the ' + S.length + ' biggest as unsatisfactory.'); }
if (I.length) f.push('<strong>The square with most pollution incidents</strong> is in the ' + basinLabel(I[0].x.basin) + ' basin, with ' + I[0].x.t + ' since 2011. Recorded source: ' + incWho(I[0].x) + '.');
if (HOTCL.length) f.push('<strong>' + HOTCL.length + ' ' + (HOTCL.length === 1 ? 'place is' : 'places are') + ' flagged by more than one dataset</strong>, ringed on the map. These are the strongest candidates for a closer look.');
h += '<div><h3>What stands out</h3><ul class="finds">' + f.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
h += '<p class="small">Tap any row or pin to find it on the map and see what is recorded within 3 km: sewage works, storm overflows, pollution incidents and farming.</p>';
if (HOTCL.length) h += '<div><h3>Flagged by more than one dataset</h3><p class="small">Two or more different kinds of flag within 2 km of each other.</p><ol class="hotlist">' + HOTCL.map(function (c) {
return hotRow(c.id, 'c', false, esc(c.name), basinLabel(c.basin) + ' basin · ' + c.items.map(function (g) { return g.id; }).join(', '), c.items.length + ' flags');
}).join('') + '</ol></div>';
h += '<div><h3>Most phosphorus in the river</h3><p class="small">Average dissolved phosphorus, 2020 to 2024, out of ' + HOT.counts.sites + ' sites tested in these basins. An orange ring means it is also rising.</p><ol class="hotlist">' + P.map(function (i) {
return hotRow(i.id, 'p', i.rising, esc(i.name), basinLabel(i.x.basin) + ' basin · ' + i.x.n + ' tests', i.x.mean.toFixed(3) + ' mg/l');
}).join('') + '</ol></div>';
h += '<div><h3>Rising fastest</h3><p class="small">Biggest increase in the average between 2015 to 2019 and 2020 to 2024.</p><ol class="hotlist">' + RI.map(function (i) {
return hotRow(i.id, i.cat, i.cat === 'p', esc(i.name), basinLabel(i.x.basin) + ' basin · ' + i.x.prev.toFixed(3) + ' then, ' + i.x.mean.toFixed(3) + ' now', '+' + (i.x.mean - i.x.prev).toFixed(3) + ' mg/l');
}).join('') + '</ol></div>';
h += '<div><h3>Storm overflows predicted to spill most</h3><p class="small">NI Water model predictions from May 2024, out of ' + HOT.counts.overflows + ' overflows in these basins. None of these are measured.</p><ol class="hotlist">' + S.map(function (i) {
return hotRow(i.id, 's', false, esc(i.x.name), basinLabel(i.x.basin) + ' basin · ' + nf(i.x.spills) + ' spills a year' + (i.x.cls ? ' · ' + esc(i.x.cls.toLowerCase()) : ''), nf(i.x.vol) + ' m³');
}).join('') + '</ol></div>';
h += '<div><h3>Most pollution incidents</h3><p class="small">One-kilometre squares with the most incidents recorded by DAERA, 2011 to 2024.</p><ol class="hotlist">' + I.map(function (i) {
return hotRow(i.id, 'i', false, 'Square in the ' + basinLabel(i.x.basin) + ' basin', incWho(i.x) + ' · ' + i.x.recent + ' since 2020', i.x.t + ' incidents');
}).join('') + '</ol></div>';
h += '<div><details class="fold"><summary>How to read this</summary><ul class="notes">' +
'<li>A river test measures everything upstream of that point, so the cause can be some distance away.</li>' +
'<li>Storm overflow figures are computer predictions by NI Water. No overflow in this dataset is monitored.</li>' +
'<li>Incident counts depend on people reporting. A busy town will record more than a quiet valley.</li>' +
'<li>The river test data is published raw. One bad sample can lift an average, so check the readings before naming a site.</li>' +
'<li>Site names are tidied from DAERA\'s records, which have no spaces. Use the site code in each pin to look a site up.</li>' +
'<li>Only the top ten of each kind are pinned (six for rising sites). Other places may be nearly as high.</li></ul></details></div>';
return h;
}
function renderAreas() {
var el = $('areasBody'); if (!el) return;
if (!HOT) { el.innerHTML = '<p class="small">' + (HOTFAIL ? 'The list of flagged places is not available right now. Please try again in a few minutes.' : 'Finding the places the DAERA data flags. This can take a few seconds the first time.') + '</p>'; return; }
if (!hotDrawn) {
hotDrawn = true;
var items = hotItems(); HOTCL = hotClusters(items);
el.innerHTML = areasHtml(items);
hotChips();
$('hotCap').innerHTML = '<span class="key"><span class="hp p">P</span>most phosphorus</span><span class="key"><span class="hp r">R</span>rising</span><span class="key"><span class="hp s">S</span>storm overflow</span><span class="key"><span class="hp i">I</span>incident square</span><span class="key"><span class="sw dot" style="background:#b0206a"></span>confirmed algae</span><span class="key">dashed ring: flagged twice</span><span class="key">grey line: basin edge</span>';
buildHotMap();
} else if (HOTMAP) { HOTMAP.invalidateSize(); hotExtras(); }
}
function loadHot() {
if (!window.fetch) { HOTFAIL = true; return; }
fetch('/api/hotspots').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok || !j.sites) { HOTFAIL = true; } else HOT = j;
showView();
}).catch(function () { HOTFAIL = true; showView(); });
}
/* ---------- satellite analysis: the algae index through time, in nine areas ---------- */
var SAT = { zones: null, days: {}, done: 0, total: 0, failed: 0, started: false }, satOff = {}, satMetric = 'm';
var SATCOL = { 2023: '#b05fc4', 2024: '#3b8fd9', 2025: '#e07b39', 2026: '#2f9e6b', 2027: '#c44569' };
var NDCI_STOPS = [[-0.15, [20, 48, 115]], [0, [41, 128, 184]], [0.1, [115, 194, 115]], [0.2, [245, 227, 66]], [0.35, [237, 128, 31]], [0.5, [189, 26, 31]]];
function rampColour(v) {
var s = NDCI_STOPS, c = s[s.length - 1][1];
if (v <= s[0][0]) c = s[0][1]; else for (var i = 1; i < s.length; i++) if (v <= s[i][0]) { var a = s[i - 1], b = s[i], k = (v - a[0]) / (b[0] - a[0]); c = [0, 1, 2].map(function (q) { return a[1][q] + (b[1][q] - a[1][q]) * k; }); break; }
var lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
return { bg: 'rgb(' + c.map(Math.round).join(',') + ')', fg: lum > 0.6 ? '#10262e' : '#ffffff' };
}
/* The share of water above 0.1 runs from 0 to 1, so stretch it over the same colours. */
function satColour(v) { return rampColour(satMetric === 'm' ? v : -0.15 + v * 0.65); }
function satFmt(v) { return v == null ? '' : satMetric === 'm' ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) : Math.round(v * 100) + '%'; }
function loadSat() {
if (SAT.started || !window.fetch) return; SAT.started = true;
var jobs = [], yr = new Date().getUTCFullYear();
for (var y = yr; y >= 2023; y--) { jobs.push([y, 2]); jobs.push([y, 1]); }
SAT.total = jobs.length;
var next = function () {
var job = jobs.shift(); if (!job) return;
fetch('/api/satstats?year=' + job[0] + '&half=' + job[1]).then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok) SAT.failed++; else { if (j.zones) SAT.zones = j.zones; j.days.forEach(function (d) { SAT.days[d.date] = d.z; }); }
}).catch(function () { SAT.failed++; }).then(function () { SAT.done++; if (location.hash === '#satellite') renderSat(); if (location.hash === '#investigate' && (SAT.done === SAT.total || !INV.date)) renderInv(); if (location.hash === '#forecast') renderFc(); next(); });
};
next(); next();
}
/* Keep an area for a day only if at least 30% of its water was clear, and a whole-lough figure only if 40% was. */
function satModel() {
var dates = Object.keys(SAT.days).sort(), zmax = [0, 0, 0, 0, 0, 0, 0, 0, 0];
dates.forEach(function (d) { SAT.days[d].forEach(function (z, k) { if (z && z[2] > zmax[k]) zmax[k] = z[2]; }); });
var all = zmax.reduce(function (a, b) { return a + b; }, 0);
return dates.map(function (d) {
var n = 0, m = 0, hh = 0, z = SAT.days[d].map(function (x, k) { if (!x || x[2] < 0.3 * zmax[k]) return null; n += x[2]; m += x[0] * x[2]; hh += x[1] * x[2]; return { m: x[0], h: x[1] }; });
return { date: d, year: +d.slice(0, 4), month: +d.slice(5, 7), z: z, lough: n >= 0.4 * all ? { m: m / n, h: hh / n } : null };
});
}
function doy(date) { return (Date.parse(date + 'T00:00:00Z') - Date.UTC(+date.slice(0, 4), 0, 1)) / 86400000; }
function avg(list) { return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null; }
function satChart(rows, years) {
var W = 560, H = 300, L = 46, Rr = 12, T = 12, B = 34, key = satMetric;
var pts = rows.filter(function (r) { return r.lough && years.indexOf(r.year) >= 0; });
var lo = key === 'm' ? Math.min(-0.1, Math.min.apply(null, pts.map(function (p) { return p.lough.m; }))) : 0, hi = key === 'm' ? Math.max(0.3, Math.max.apply(null, pts.map(function (p) { return p.lough.m; }))) : 1;
if (key === 'm') { lo = Math.floor(lo * 10) / 10; hi = Math.ceil(hi * 10) / 10; }
var X = function (d) { return L + (W - L - Rr) * d / 365; }, Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Algae index through the year, one line for each year"><g font-family="var(--body)" font-size="13" fill="var(--muted)">';
var step = key === 'm' ? 0.1 : 0.25;
for (var v = lo; v <= hi + 1e-9; v += step) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (key === 'm' ? v.toFixed(1) : Math.round(v * 100) + '%') + '</text>';
var starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
starts.forEach(function (d, k) { s += '<text x="' + X(d + 15).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + MONN[k].charAt(0) + '</text>' + (k ? '<line x1="' + X(d).toFixed(1) + '" x2="' + X(d).toFixed(1) + '" y1="' + (H - B) + '" y2="' + (H - B + 5) + '" stroke="var(--line)"/>' : ''); });
if (key === 'm') s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(0.1).toFixed(1) + '" y2="' + Y(0.1).toFixed(1) + '" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>';
s += '</g>';
years.slice().sort().forEach(function (y) {
var p = pts.filter(function (q) { return q.year === y; }), col = SATCOL[y] || '#888888';
if (!p.length) return;
s += '<polyline fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" opacity="0.75" points="' + p.map(function (q) { return X(doy(q.date)).toFixed(1) + ',' + Y(q.lough[key]).toFixed(1); }).join(' ') + '"/>';
p.forEach(function (q) { s += '<circle cx="' + X(doy(q.date)).toFixed(1) + '" cy="' + Y(q.lough[key]).toFixed(1) + '" r="3.2" fill="' + col + '" stroke="var(--surface)" stroke-width="1"><title>' + fmtDate(q.date) + ' ' + y + ': ' + satFmt(q.lough[key]) + '</title></circle>'; });
});
return s + '</svg>';
}
function satHtml() {
var rows = satModel(), allYears = [], N = SAT.zones.length;
rows.forEach(function (r) { if (allYears.indexOf(r.year) < 0) allYears.push(r.year); });
allYears.sort();
var years = allYears.filter(function (y) { return !satOff[y]; });
if (!years.length) { satOff = {}; years = allYears.slice(); }
var use = rows.filter(function (r) { return years.indexOf(r.year) >= 0; }), lough = use.filter(function (r) { return r.lough; });
var season = function (r) { return r.month >= 6 && r.month <= 10; }, key = satMetric;
var h = '<h2>What the satellite shows</h2><p class="lede">Every clear Sentinel-2 pass over the lough since 2023, turned into an algae index for nine areas so the patterns by season, year and place can be compared.</p>' +
'<p class="notice"><strong>An index, not a measurement.</strong> It is worked out from the colour of the water and has not been checked against water samples. Use it to compare days and places, not to say how much algae there was.</p>';
if (SAT.done < SAT.total) h += '<p class="small" role="status">Loaded ' + SAT.done + ' of ' + SAT.total + ' half-years. The figures below will fill in.</p>';
if (SAT.failed) h += '<p class="small">' + SAT.failed + ' of the ' + SAT.total + ' half-years could not be loaded, so some dates are missing.</p>';
/* findings */
var f = [], seasonL = lough.filter(season);
f.push('<strong>' + lough.length + ' usable days</strong> out of ' + use.length + ' satellite passes. The rest had too much cloud over the water.');
if (lough.length) {
var peak = lough.slice().sort(function (a, b) { return b.lough.m - a.lough.m; })[0];
f.push('<strong>The highest day was ' + fmtDate(peak.date) + ' ' + peak.year + '</strong>, with an average index of ' + peak.lough.m.toFixed(2) + ' and ' + Math.round(peak.lough.h * 100) + '% of the clear water above 0.1.');
var byYear = years.map(function (y) { var p = seasonL.filter(function (r) { return r.year === y; }); return { y: y, n: p.length, mean: avg(p.map(function (r) { return r.lough.m; })), high: p.filter(function (r) { return r.lough.h >= 0.5; }).length }; }).filter(function (x) { return x.n; });
if (byYear.length > 1) { var top = byYear.slice().sort(function (a, b) { return b.mean - a.mean; })[0]; f.push('<strong>' + top.y + ' had the highest June to October average</strong> (' + top.mean.toFixed(2) + ' over ' + top.n + ' usable days). Days when more than half the water was above 0.1: ' + byYear.map(function (x) { return x.y + ': ' + x.high + ' of ' + x.n; }).join(', ') + '.'); }
var byMonth = []; for (var mo = 1; mo <= 12; mo++) { var pm = lough.filter(function (r) { return r.month === mo; }); if (pm.length >= 2) byMonth.push({ mo: mo, mean: avg(pm.map(function (r) { return r.lough.m; })), n: pm.length }); }
if (byMonth.length) { var tm = byMonth.slice().sort(function (a, b) { return b.mean - a.mean; })[0]; f.push('<strong>' + MONFULL[tm.mo - 1] + ' is the highest month on average</strong> (' + tm.mean.toFixed(2) + ' over ' + tm.n + ' usable days).'); }
}
var zs = SAT.zones.map(function (z, k) { var p = use.filter(function (r) { return season(r) && r.z[k]; }); return { z: z, k: k, n: p.length, m: avg(p.map(function (r) { return r.z[k].m; })), h: avg(p.map(function (r) { return r.z[k].h; })) }; });
var zr = zs.filter(function (x) { return x.n >= 3; }).sort(function (a, b) { return b.m - a.m; });
if (zr.length > 1) f.push('<strong>' + zr[0].z.name + '</strong> has the highest June to October average (' + zr[0].m.toFixed(2) + ') and <strong>' + zr[zr.length - 1].z.name + '</strong> the lowest (' + zr[zr.length - 1].m.toFixed(2) + ').');
var highDays = use.filter(function (r) { return r.lough && r.lough.h >= 0.5; }), lead = {};
highDays.forEach(function (r) { var best = -1; r.z.forEach(function (z, k) { if (z && (best < 0 || z.m > r.z[best].m)) best = k; }); if (best >= 0) lead[best] = (lead[best] || 0) + 1; });
var lk = Object.keys(lead).sort(function (a, b) { return lead[b] - lead[a]; })[0];
if (lk != null && highDays.length >= 3) f.push('On the ' + highDays.length + ' days when more than half the water was above 0.1, <strong>' + SAT.zones[lk].name + '</strong> was the highest area most often (' + lead[lk] + ' times).');
h += '<h3>What stands out</h3><ul class="finds">' + f.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
/* controls */
h += '<div class="layers"><div class="lrow"><span class="llab">Years</span>' + allYears.map(function (y) { return chip('saty', y, y, years.indexOf(y) >= 0); }).join('') + '</div>' +
'<div class="lrow"><span class="llab">Measure</span>' + chip('satm', 'm', 'Average index', key === 'm') + chip('satm', 'h', 'Share of water above 0.1', key === 'h') + '</div></div>';
/* chart */
h += '<h3>Through the year</h3><p class="small">The whole lough, one dot for each usable day. ' + (key === 'm' ? 'Above the dashed line at 0.1 the water shows yellow to red on the map.' : 'The share of clear water above 0.1 on the index.') + '</p>' +
'<div class="chart satchart">' + satChart(rows, years) + '<div class="legend">' + years.map(function (y) { return '<span class="key"><span class="sw dot" style="background:' + (SATCOL[y] || '#888888') + '"></span>' + y + '</span>'; }).join('') + '</div></div>';
/* grid of areas */
h += '<h3>Where it is highest</h3><p class="small">June to October average for each area, laid out as on a map with north at the top. Each area is a box, so it includes some open water as well as the named shore.</p><div class="satgrid">' + zs.map(function (x) {
var v = x.n ? x[key] : null, col = v == null ? null : satColour(v);
return '<div class="satcell"' + (col ? ' style="background:' + col.bg + ';color:' + col.fg + '"' : '') + '><span class="satname">' + x.z.name + '</span><span class="satval">' + (v == null ? 'No clear days' : satFmt(v)) + '</span><span class="satn">' + (x.n ? x.n + ' days' : '') + '</span></div>';
}).join('') + '</div>';
/* heat map by month */
var cell = function (list) { if (list.length < 1) return '<td></td>'; var v = avg(list), col = satColour(v); return '<td><span class="cell" style="background:' + col.bg + ';color:' + col.fg + '" title="' + list.length + ' days">' + satFmt(v) + '</span></td>'; };
h += '<h3>Area by month</h3><p class="small">Average for each area in each month, across the years chosen. Blank means no clear day. Winter figures are less reliable because the sun is low.</p><div class="tablewrap"><table class="sat"><thead><tr><th class="lh" scope="col">Area</th>' + MONN.map(function (m) { return '<th scope="col">' + m + '</th>'; }).join('') + '</tr></thead><tbody>' +
SAT.zones.map(function (z, k) { var t = '<tr><th scope="row">' + z.name + '</th>'; for (var mo = 1; mo <= 12; mo++) t += cell(use.filter(function (r) { return r.month === mo && r.z[k]; }).map(function (r) { return r.z[k][key]; })); return t + '</tr>'; }).join('') +
(function () { var t = '<tr class="tot"><th scope="row">Whole lough</th>'; for (var mo = 1; mo <= 12; mo++) t += cell(lough.filter(function (r) { return r.month === mo; }).map(function (r) { return r.lough[key]; })); return t + '</tr>'; })() + '</tbody></table></div>';
/* top days */
var topDays = lough.slice().sort(function (a, b) { return b.lough[key] - a.lough[key]; }).slice(0, 12);
h += '<h3>The highest days</h3><p class="small">Open any of these on the main map to see the picture behind the number.</p><div class="tablewrap"><table class="sat days"><thead><tr><th class="lh" scope="col">Day</th><th scope="col">Average index</th><th scope="col">Water above 0.1</th><th class="lh" scope="col">Highest area</th><th scope="col"></th></tr></thead><tbody>' + topDays.map(function (r) {
var best = -1; r.z.forEach(function (z, k) { if (z && (best < 0 || z.m > r.z[best].m)) best = k; });
return '<tr><th scope="row">' + fmtDate(r.date) + ' ' + r.year + '</th><td>' + r.lough.m.toFixed(2) + '</td><td>' + Math.round(r.lough.h * 100) + '%</td><td class="lh">' + (best < 0 ? '' : SAT.zones[best].name) + '</td><td><button type="button" class="chip" data-invgo="' + r.date + '">Investigate</button> <button type="button" class="chip" data-satgo="' + r.date + '">See on map</button></td></tr>';
}).join('') + '</tbody></table></div>';
h += '<details class="fold"><summary>How to read this</summary><ul class="notes">' +
'<li>The index is the Normalised Difference Chlorophyll Index. It compares two shades of red light that algae pigment reflects differently. Higher means greener, more pigmented water.</li>' +
'<li>The 0.1 line is a working threshold chosen for this page, not an official one.</li>' +
'<li>The satellite passes every two to three days and cloud hides most passes, so short blooms can be missed entirely.</li>' +
'<li>Thick floating scum, haze, thin cloud and sunlight glinting off the water can all push the index up or down. A single odd day is not a pattern.</li>' +
'<li>Mud stirred up by wind can also raise the index in shallow bays.</li>' +
'<li>Each area is measured at about 115 m detail, so narrow bays and harbours are not resolved.</li></ul></details>';
return h;
}
var MONFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function renderSat() {
var el = $('satBody'); if (!el) return;
loadSat();
if (!SAT.zones || !Object.keys(SAT.days).length) { el.innerHTML = '<p class="small" role="status">' + (SAT.total && SAT.done === SAT.total ? 'The satellite figures are not available right now. Please try again in a few minutes.' : 'Measuring the algae index from every clear satellite pass since 2023. The first time this can take up to a minute.') + '</p>'; return; }
el.innerHTML = satHtml();
}
function satGo(date) {
state.base = 's2'; state.s2algae = true; state.s2year = date.slice(0, 4); state.s2date = date;
location.hash = '#explore'; render();
if ($('map')) $('map').scrollIntoView({ block: 'center' });
}
/* ---------- investigate a day: what led up to it ---------- */
var INV = { date: null, data: {} }, INV_BEFORE = 70, INV_AFTER = 7;
var BUOYCOL = { "Rea's Wood": '#b05fc4', 'Toome': '#3b8fd9', 'Washing Bay': '#e07b39' };
var BUOYWHERE = { "Rea's Wood": 'Antrim Bay, in the north-east', 'Toome': 'the north-west, by the outflow', 'Washing Bay': 'the south-west' };
var ZBEAR = [315, 0, 45, 270, null, 90, 225, 180, 135];
function compass(d) { return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(d / 45) % 8]; }
function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function longDate(d) { return fmtDate(d) + ' ' + d.slice(0, 4); }
function shortDate(d) { return +d.slice(8, 10) + ' ' + MONN[+d.slice(5, 7) - 1]; }
function vecDir(days) { var x = 0, y = 0, s = 0; days.forEach(function (d) { x += d.w * Math.sin(d.dir * Math.PI / 180); y += d.w * Math.cos(d.dir * Math.PI / 180); s += d.w; }); return { dir: (Math.atan2(x, y) * 180 / Math.PI + 360) % 360, steady: s ? Math.sqrt(x * x + y * y) / s : 0 }; }
function loadEvent(date) {
if (INV.data[date] || !window.fetch) return;
INV.data[date] = 'loading';
fetch('/api/event?date=' + date + '&before=' + INV_BEFORE + '&after=' + INV_AFTER + '&v=2').then(function (res) { return res.json(); }).then(function (j) {
INV.data[date] = j && j.ok ? j : 'fail'; if (location.hash === '#investigate') renderInv();
}).catch(function () { INV.data[date] = 'fail'; if (location.hash === '#investigate') renderInv(); });
}
function invGo(date) { INV.date = date; location.hash = '#investigate'; renderInv(); window.scrollTo(0, 0); }
/* Pull the feeds into one day-by-day list. */
function invModel(date) {
var ev = INV.data[date], W = ev.weather && ev.weather.days ? ev.weather.days : [], at = -1;
W.forEach(function (d, i) { if (d.date === date) at = i; });
var rain = ev.rain && ev.rain.basins ? ev.rain : null, buoys = (ev.buoys || []).filter(function (b) { return b && b.metrics; }).map(function (b) {
var m = {}; Object.keys(b.metrics).forEach(function (k) { var o = m[k] = {}; b.metrics[k].forEach(function (x) { o[x[0]] = [x[1], x[2]]; }); });
return { name: b.name, pc: m.BGA_PC_Fluorescence || {}, temp: m.Temp || {}, o2: m.Dissolved_O2_Saturation || {}, turb: m.Turbidity || {} };
});
var sat = satModel().filter(function (r) { return r.date >= ev.from && r.date <= addDays(date, INV_AFTER); });
return { ev: ev, W: W, at: at, rain: rain, buoys: buoys, sat: sat };
}
function invFindings(date, M) {
var f = [], W = M.W, at = M.at, before = at >= 0 ? W.slice(0, at) : W, lough = M.sat.filter(function (r) { return r.lough; });
var onDay = lough.filter(function (r) { return r.date === date; })[0], near = onDay || lough.filter(function (r) { return Math.abs(Date.parse(r.date) - Date.parse(date)) <= 3 * 86400000; }).sort(function (a, b) { return Math.abs(Date.parse(a.date) - Date.parse(date)) - Math.abs(Date.parse(b.date) - Date.parse(date)); })[0];
/* the satellite on the day */
var top = null;
if (near) {
var zs = near.z.map(function (z, k) { return z ? { k: k, m: z.m } : null; }).filter(Boolean).sort(function (a, b) { return b.m - a.m; }); top = zs;
f.push(['The satellite', (onDay ? 'On the day' : 'There was no clear pass on the day. The nearest, on ' + longDate(near.date) + ',') + ' the whole lough averaged <strong>' + near.lough.m.toFixed(2) + '</strong> on the algae index, with ' + Math.round(near.lough.h * 100) + '% of the clear water above 0.1. ' + (zs.length > 1 ? 'Highest: ' + SAT.zones[zs[0].k].name + ' (' + zs[0].m.toFixed(2) + '). Lowest: ' + SAT.zones[zs[zs.length - 1].k].name + ' (' + zs[zs.length - 1].m.toFixed(2) + ').' : '')]);
var prev = lough.filter(function (r) { return r.date < near.date; }).slice(-1)[0];
if (prev) { var gap = Math.round((Date.parse(near.date) - Date.parse(prev.date)) / 86400000), rise = near.lough.m - prev.lough.m;
if (rise >= 0.08 && gap <= 6) f.push(['A sudden jump', 'The index rose from ' + prev.lough.m.toFixed(2) + ' to ' + near.lough.m.toFixed(2) + ' in ' + gap + (gap === 1 ? ' day' : ' days') + '. Algae do not multiply that fast, so this points to algae already in the water <strong>rising to the surface</strong>, not new growth.']);
else if (gap > 10) f.push(['A gap before it', 'The previous usable pass was ' + gap + ' days earlier (' + longDate(prev.date) + ', index ' + prev.lough.m.toFixed(2) + '). Cloud hid what happened in between, so lean on the buoys for that stretch.']);
else f.push(['The pass before', longDate(prev.date) + ' averaged ' + prev.lough.m.toFixed(2) + ', a change of ' + (rise >= 0 ? '+' : '−') + Math.abs(rise).toFixed(2) + ' in ' + gap + (gap === 1 ? ' day' : ' days') + '.']); }
} else f.push(['The satellite', 'No usable satellite pass within three days of this date, so there is no picture of where the algae was.']);
if (at < 0) { f.push(['Weather', 'Weather records for this date are not available yet. The archive runs about six days behind.']); return f; }
/* calm */
var d0 = W[at], d1 = at > 0 ? W[at - 1] : null, calm = d0.calmHours + (d1 ? d1.calmHours : 0);
if (d1 && calm >= 24 && (d0.w + d1.w) / 2 < 7) f.push(['Calm water', 'The wind was very light: ' + d1.w + ' mph the day before and ' + d0.w + ' mph on the day, with <strong>' + calm + ' of 48 hours below 6 mph</strong>. Blue-green algae float, so calm lets them gather at the surface where the satellite sees them.']);
else if (d0.w >= 12) f.push(['A windy day', 'The wind averaged ' + d0.w + ' mph on the day, enough to mix algae down through the water. A high reading in wind like this suggests a lot of algae in the water.']);
else f.push(['Wind on the day', 'The wind averaged ' + d0.w + ' mph, from the ' + compass(d0.dir) + ', with ' + d0.calmHours + ' calm hours.']);
/* wind direction against where the algae was */
var side = function (dir) { var to = (dir + 180) % 360, down = [], up = []; if (top) top.forEach(function (z) { var b = ZBEAR[z.k]; if (b == null) return; if (angDiff(b, to) <= 60) down.push(z.m); else if (angDiff(b, to) >= 120) up.push(z.m); }); return down.length && up.length ? avg(down) - avg(up) : null; };
if (top && top.length >= 5) {
var dayDiff = side(d0.dir), prior = before.slice(-21), pv = prior.length >= 7 ? vecDir(prior) : null, pDiff = pv && pv.steady >= 0.25 ? side(pv.dir) : null;
var txt = 'On the day the wind came from the ' + compass(d0.dir) + ', which pushes surface water towards the ' + compass((d0.dir + 180) % 360) + ' shore. ';
txt += dayDiff == null ? '' : dayDiff >= 0.03 ? 'The algae index was higher on that side (by ' + dayDiff.toFixed(2) + '), so <strong>the day\'s wind fits the pattern</strong>. ' : dayDiff <= -0.03 ? 'But the index was higher on the opposite side (by ' + Math.abs(dayDiff).toFixed(2) + '), so <strong>the day\'s wind does not explain where the algae was</strong>. ' : 'The two sides of the lough were about the same, so the day\'s wind made little difference. ';
if (pv) txt += pv.steady < 0.25 ? 'Over the three weeks before, the wind had no steady direction.' : 'Over the three weeks before, the wind came mostly from the ' + compass(pv.dir) + ', pushing towards the ' + compass((pv.dir + 180) % 360) + ' shore. ' + (pDiff == null ? '' : pDiff >= 0.03 ? '<strong>That matches where the algae was highest</strong>, which suggests it had been gathering there for weeks.' : pDiff <= -0.03 ? 'That is the opposite side from where the algae was highest.' : 'The algae was spread evenly, so that made little difference.');
f.push(['Wind direction', txt]);
}
/* warm, calm, sunny spells */
var good = before.map(function (d) { return d.tmax >= 19 && d.w < 9 && d.sun >= 9; }), spells = [], run = null;
good.forEach(function (g, i) { if (g) { if (!run) run = { a: i, b: i }; else run.b = i; } if ((!g || i === good.length - 1) && run) { if (run.b - run.a >= 1) spells.push(run); run = null; } });
var nGood = good.filter(Boolean).length;
f.push(['Growing weather', nGood ? '<strong>' + nGood + ' of the ' + before.length + ' days before</strong> were warm, sunny and light-winded, the conditions algae grow fastest in.' + (spells.length ? ' Spells of two days or more: ' + spells.map(function (s) { return shortDate(before[s.a].date) + ' to ' + shortDate(before[s.b].date); }).join(', ') + '.' : '') : 'None of the ' + before.length + ' days before were warm, sunny and light-winded together.']);
/* water temperature */
var wt = before.map(function (d) { var v = M.buoys.map(function (b) { return b.temp[d.date] ? b.temp[d.date][0] : null; }).filter(function (x) { return x != null; }); return v.length ? { date: d.date, t: avg(v) } : null; }).filter(Boolean);
if (wt.length) { var hot = wt.slice().sort(function (a, b) { return b.t - a.t; })[0], above = wt.filter(function (x) { return x.t >= 18; }).length; f.push(['Water temperature', 'The buoys measured the water at 18°C or more on <strong>' + above + ' of ' + wt.length + ' days</strong>, peaking at ' + hot.t.toFixed(1) + '°C on ' + shortDate(hot.date) + '. Blue-green algae grow fastest in water above about 18°C.']); }
/* dry spell and rain */
var dry = 0, bestDry = null, runD = null;
before.forEach(function (d, i) { if (d.rain < 1) { if (!runD) runD = { a: i, b: i }; else runD.b = i; } if ((d.rain >= 1 || i === before.length - 1) && runD) { if (!bestDry || runD.b - runD.a > bestDry.b - bestDry.a) bestDry = runD; runD = null; } });
if (bestDry && bestDry.b - bestDry.a >= 6) f.push(['A dry spell', 'No real rain for ' + (bestDry.b - bestDry.a + 1) + ' days, from ' + shortDate(before[bestDry.a].date) + ' to ' + shortDate(before[bestDry.b].date) + '. Less river water means slower flushing and clearer water for algae to grow in.']);
if (M.rain) { var ri = M.rain.dates.indexOf(date), tot = function (n) { return M.rain.basins.map(function (b) { var s = 0; for (var i = Math.max(0, ri - n); i < ri; i++) s += b.mm[i] || 0; return { name: b.name, mm: s }; }).sort(function (a, b) { return b.mm - a.mm; }); };
if (ri > 0) { var t14 = tot(14), wet = t14.filter(function (x) { return x.mm >= 25; });
f.push(['Rain and the rivers', wet.length ? 'In the 14 days before, the wettest basins were ' + t14.slice(0, 3).map(function (x) { return '<strong>' + x.name + '</strong> (' + Math.round(x.mm) + ' mm)'; }).join(', ') + '. The driest was ' + t14[t14.length - 1].name + ' (' + Math.round(t14[t14.length - 1].mm) + ' mm). Heavy rain washes phosphorus off fields and sets off storm overflows, so those rivers are the ones most likely to have carried a fresh load in.' : 'Little rain fell in the 14 days before (the wettest basin, ' + t14[0].name + ', had ' + Math.round(t14[0].mm) + ' mm), so a fresh wash of nutrients from the rivers is unlikely to be the trigger.']); } }
/* buoys */
var bs = M.buoys.map(function (b) { var days = before.map(function (d) { return b.pc[d.date] ? { date: d.date, v: b.pc[d.date][0] } : null; }).filter(Boolean); if (!days.length) return null; var pk = days.slice().sort(function (x, y) { return y.v - x.v; })[0]; return { name: b.name, n: days.length, peak: pk, high: days.filter(function (x) { return x.v >= 3; }).length, day: b.pc[date] ? b.pc[date][0] : null }; }).filter(Boolean).sort(function (a, b) { return b.high - a.high || b.peak.v - a.peak.v; });
if (bs.length) { f.push(['The buoys', bs.map(function (b) { return '<strong>' + b.name + '</strong> (' + BUOYWHERE[b.name] + ') read 3 or more on ' + b.high + ' of ' + b.n + ' days, peaking at ' + b.peak.v.toFixed(1) + ' on ' + shortDate(b.peak.date) + (b.day != null ? ', and ' + b.day.toFixed(1) + ' on the day' : ''); }).join('. ') + '. The buoy with the most high days shows where algae had been building longest.']);
if (near && near.lough.m >= 0.15 && bs.every(function (b) { return b.day != null && b.day < b.peak.v / 2; })) f.push(['Buoys low, satellite high', 'The buoys read lower on the day than at their peaks, while the satellite read high. That fits algae floating at the surface above the sensors. The depth of the sensors has not been confirmed.']);
var o2 = []; M.buoys.forEach(function (b) { before.forEach(function (d) { if (b.o2[d.date] && b.o2[d.date][0] >= 130 && o2.indexOf(d.date) < 0) o2.push(d.date); }); });
if (o2.length) f.push(['Oxygen', 'At least one buoy averaged over 130% oxygen on ' + o2.length + ' days (' + o2.sort().slice(0, 8).map(shortDate).join(', ') + (o2.length > 8 ? ' and more' : '') + '). Oxygen that high means algae were growing fast on those days.']); }
else f.push(['The buoys', 'No buoy readings are available for this period.']);
return f;
}
function invChart(M, date, title, lo, hi, draw, unit, last) {
var W = 560, H = last ? 136 : 118, L = 40, Rr = 8, T = 8, B = last ? 28 : 10, n = M.W.length;
var X = function (i) { return L + (W - L - Rr) * (i + 0.5) / n; }, Y = function (v) { return T + (H - T - B) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)); }, bw = (W - L - Rr) / n;
var s = '<div class="invchart"><div class="charttitle">' + title + '</div><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + title.replace(/<[^>]+>/g, '') + '"><g font-family="var(--body)" font-size="12" fill="var(--muted)">';
[lo, (lo + hi) / 2, hi].forEach(function (v) { s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 5) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (Math.abs(hi - lo) < 2 ? v.toFixed(1) : Math.round(v)) + '</text>'; });
M.W.forEach(function (d, i) { var back = M.at - i; if (back % 14 === 0 || (M.at < 0 && i % 14 === 0)) { s += '<line x1="' + X(i).toFixed(1) + '" x2="' + X(i).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--line)" stroke-dasharray="2 3"/>'; if (last) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDate(d.date) + '</text>'; } });
s += '</g>';
if (M.at >= 0) s += '<rect x="' + (X(M.at) - bw / 2).toFixed(1) + '" y="' + T + '" width="' + Math.max(2, bw).toFixed(1) + '" height="' + (H - T - B) + '" fill="var(--high)" opacity="0.22"/>';
s += draw(X, Y, bw, function (date) { for (var i = 0; i < n; i++) if (M.W[i].date === date) return i; return -1; });
return s + '</svg>' + (unit ? '<div class="legend">' + unit + '</div>' : '') + '</div>';
}
function line(pts, col, w) { var segs = [], cur = []; pts.forEach(function (p) { if (p) cur.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur); return segs.map(function (sg) { return sg.length > 1 ? '<polyline fill="none" stroke="' + col + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round" points="' + sg.join(' ') + '"/>' : '<circle cx="' + sg[0].split(',')[0] + '" cy="' + sg[0].split(',')[1] + '" r="2" fill="' + col + '"/>'; }).join(''); }
function invHtml(date) {
var M = invModel(date), W = M.W, key = function (col, txt, dot) { return '<span class="key"><span class="sw' + (dot ? ' dot' : '') + '" style="background:' + col + '"></span>' + txt + '</span>'; };
var h = '<h3>What the data suggests for ' + longDate(date) + '</h3><dl class="invfinds">' + invFindings(date, M).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
if (!W.length) return h;
h += '<h3>The ' + INV_BEFORE + ' days before, on one timeline</h3><p class="small">Every chart shares the same dates. The red band is the day you chose. Dotted lines are two weeks apart.</p><div class="chart invstack">';
var lough = M.sat.filter(function (r) { return r.lough; }), sHi = Math.max(0.3, Math.ceil(Math.max.apply(null, lough.map(function (r) { return Math.max.apply(null, r.z.filter(Boolean).map(function (z) { return z.m; })); }).concat([0.3])) * 10) / 10);
h += invChart(M, date, 'Satellite algae index', -0.1, sHi, function (X, Y, bw, ix) { var s = '<line x1="40" x2="552" y1="' + Y(0.1).toFixed(1) + '" y2="' + Y(0.1).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="5 4"/>'; lough.forEach(function (r) { var i = ix(r.date); if (i < 0) return; var zz = r.z.filter(Boolean).map(function (z) { return z.m; }); s += '<line x1="' + X(i).toFixed(1) + '" x2="' + X(i).toFixed(1) + '" y1="' + Y(Math.min.apply(null, zz)).toFixed(1) + '" y2="' + Y(Math.max.apply(null, zz)).toFixed(1) + '" stroke="var(--muted)" stroke-width="2"/><circle cx="' + X(i).toFixed(1) + '" cy="' + Y(r.lough.m).toFixed(1) + '" r="4.5" fill="' + rampColour(r.lough.m).bg + '" stroke="var(--ink)" stroke-width="1"><title>' + longDate(r.date) + ': ' + r.lough.m.toFixed(2) + '</title></circle>'; }); return s; }, '<span class="key">Dot: whole lough on each usable pass. Bar: lowest to highest area. Dashed line: 0.1. Gaps are cloud.</span>');
var pcMax = 5; M.buoys.forEach(function (b) { W.forEach(function (d) { if (b.pc[d.date] && b.pc[d.date][0] > pcMax) pcMax = b.pc[d.date][0]; }); }); pcMax = Math.ceil(pcMax / 5) * 5;
if (M.buoys.length) h += invChart(M, date, 'Buoy algae pigment, daily average', 0, pcMax, function (X, Y) { return M.buoys.map(function (b) { return line(W.map(function (d, i) { return b.pc[d.date] ? [X(i), Y(b.pc[d.date][0])] : null; }), BUOYCOL[b.name] || '#888888'); }).join(''); }, M.buoys.map(function (b) { return key(BUOYCOL[b.name] || '#888888', b.name, true); }).join('') + '<span class="key">Relative units from the sensor, not a concentration.</span>');
var water = W.map(function (d) { var v = M.buoys.map(function (b) { return b.temp[d.date] ? b.temp[d.date][0] : null; }).filter(function (x) { return x != null; }); return v.length ? avg(v) : null; });
h += invChart(M, date, 'Temperature, °C', 10, 28, function (X, Y) { return '<line x1="40" x2="552" y1="' + Y(18).toFixed(1) + '" y2="' + Y(18).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="5 4"/>' + line(W.map(function (d, i) { return [X(i), Y(d.tmax)]; }), '#c44569') + line(water.map(function (v, i) { return v == null ? null : [X(i), Y(v)]; }), '#3b8fd9', 2.5); }, key('#c44569', 'Warmest air of the day', true) + key('#3b8fd9', 'Water at the buoys', true) + '<span class="key">Dashed line: 18°C.</span>');
h += invChart(M, date, 'Wind, mph, with arrows showing where it blew towards', 0, 24, function (X, Y, bw) { return W.map(function (d, i) { var calm = d.w < 6; return '<rect x="' + (X(i) - bw * 0.4).toFixed(1) + '" y="' + Y(d.w).toFixed(1) + '" width="' + (bw * 0.8).toFixed(1) + '" height="' + (Y(0) - Y(d.w)).toFixed(1) + '" fill="' + (calm ? '#2f9e6b' : 'var(--muted)') + '" opacity="' + (calm ? 1 : 0.55) + '"><title>' + shortDate(d.date) + ': ' + d.w + ' mph from the ' + compass(d.dir) + '</title></rect><path transform="translate(' + X(i).toFixed(1) + ',' + (Y(24) + 7) + ') rotate(' + ((d.dir + 180) % 360) + ')" d="M0,-5 L2.6,3 L0,1.4 L-2.6,3 Z" fill="var(--ink)"/>'; }).join(''); }, key('#2f9e6b', 'Calm day, under 6 mph') + '<span class="key">An arrow pointing right means the wind pushed water east.</span>');
h += invChart(M, date, 'Rain over the lough, mm a day', 0, Math.max(20, Math.ceil(Math.max.apply(null, W.map(function (d) { return d.rain; })) / 10) * 10), function (X, Y, bw) { return W.map(function (d, i) { return d.rain > 0 ? '<rect x="' + (X(i) - bw * 0.4).toFixed(1) + '" y="' + Y(d.rain).toFixed(1) + '" width="' + (bw * 0.8).toFixed(1) + '" height="' + (Y(0) - Y(d.rain)).toFixed(1) + '" fill="#3b8fd9"><title>' + shortDate(d.date) + ': ' + d.rain + ' mm</title></rect>' : ''; }).join(''); }, '', true);
h += '</div>';
/* week by week */
if (M.at >= 0) {
var weeks = []; for (var wk = 0; wk < 10; wk++) { var b = M.at - wk * 7, a = b - 6; if (a < 0) break; weeks.unshift(W.slice(a, b + 1)); }
h += '<h3>Week by week</h3><p class="small">Each row is seven days, ending with the week of the day you chose.</p><div class="tablewrap"><table class="sat inv"><thead><tr><th class="lh" scope="col">Week</th><th scope="col">Warmest air</th><th scope="col">Water</th><th scope="col">Wind</th><th scope="col">Calm days</th><th scope="col">Sun a day</th><th scope="col">Rain</th><th class="lh" scope="col">Wettest basin</th><th class="lh" scope="col">Highest buoy</th><th scope="col">Satellite</th></tr></thead><tbody>' + weeks.map(function (wkd) {
var ds = wkd.map(function (d) { return d.date; }), v = vecDir(wkd), wv = []; wkd.forEach(function (d, k) { var i = M.at - (weeks.length - 1 - weeks.indexOf(wkd)) * 7 - 6 + k; if (water[i] != null) wv.push(water[i]); });
var wb = null; if (M.rain) M.rain.basins.forEach(function (bb) { var s = 0; ds.forEach(function (d) { var i = M.rain.dates.indexOf(d); if (i >= 0) s += bb.mm[i] || 0; }); if (!wb || s > wb.mm) wb = { name: bb.name, mm: s }; });
var hb = null; M.buoys.forEach(function (bb) { ds.forEach(function (d) { if (bb.pc[d] && (!hb || bb.pc[d][0] > hb.v)) hb = { name: bb.name, v: bb.pc[d][0] }; }); });
var sv = lough.filter(function (r) { return ds.indexOf(r.date) >= 0; }).sort(function (x, y) { return y.lough.m - x.lough.m; })[0], col = sv ? rampColour(sv.lough.m) : null;
return '<tr><th scope="row">' + shortDate(ds[0]) + ' to ' + shortDate(ds[6]) + '</th><td>' + Math.max.apply(null, wkd.map(function (d) { return d.tmax; })).toFixed(0) + '°C</td><td>' + (wv.length ? avg(wv).toFixed(1) + '°C' : '') + '</td><td>' + avg(wkd.map(function (d) { return d.w; })).toFixed(0) + ' mph ' + (v.steady >= 0.3 ? 'from ' + compass(v.dir) : 'mixed') + '</td><td>' + wkd.filter(function (d) { return d.w < 6; }).length + '</td><td>' + avg(wkd.map(function (d) { return d.sun; })).toFixed(0) + ' h</td><td>' + wkd.reduce(function (s, d) { return s + d.rain; }, 0).toFixed(0) + ' mm</td><td class="lh">' + (wb && wb.mm >= 1 ? wb.name + ' ' + wb.mm.toFixed(0) + ' mm' : 'Dry') + '</td><td class="lh">' + (hb ? hb.name + ' ' + hb.v.toFixed(1) : '') + '</td><td>' + (sv ? '<span class="cell" style="background:' + col.bg + ';color:' + col.fg + '">' + sv.lough.m.toFixed(2) + '</span>' : 'Cloud') + '</td></tr>';
}).join('') + '</tbody></table></div>';
}
/* basin rain */
if (M.rain && M.rain.dates.indexOf(date) > 0) { var ri = M.rain.dates.indexOf(date), sum = function (bb, n) { var s = 0; for (var i = Math.max(0, ri - n); i < ri; i++) s += bb.mm[i] || 0; return s; };
h += '<h3>Rain over each river basin</h3><p class="small">Total rain before the day. More rain means more river water, more run-off from fields and more storm overflow spills. We do not hold river flows or 2026 river phosphorus tests, so this is the nearest stand-in.</p><div class="tablewrap"><table class="sat inv"><thead><tr><th class="lh" scope="col">Basin</th><th scope="col">Last 7 days</th><th scope="col">Last 14 days</th><th scope="col">Last 30 days</th></tr></thead><tbody>' + M.rain.basins.slice().sort(function (x, y) { return sum(y, 14) - sum(x, 14); }).map(function (bb) { return '<tr><th scope="row">' + bb.name + '</th><td>' + sum(bb, 7).toFixed(0) + ' mm</td><td>' + sum(bb, 14).toFixed(0) + ' mm</td><td>' + sum(bb, 30).toFixed(0) + ' mm</td></tr>'; }).join('') + '</tbody></table></div>'; }
h += '<p><button type="button" class="chip" data-satgo="' + date + '">See the satellite picture for this day on the map</button></p>';
h += '<details class="fold"><summary>What this cannot tell you</summary><ul class="notes">' +
'<li>These are clues that fit together, not proof of a cause. Use them to decide where to look and what to sample.</li>' +
'<li>There are no river flow figures and no river phosphorus tests after 2024, so a river\'s part can only be judged from rainfall and the nearest buoy.</li>' +
'<li>Wind that carries river water along a shore also pushes algae there from the rest of the lough. The data cannot separate the two.</li>' +
'<li>Phosphorus released from the lough bed in warm, calm weather is not measured by anything here.</li>' +
'<li>Weather is from a weather model for the centre of the lough, not a weather station. Basin rain is taken at one point per basin.</li>' +
'<li>The buoys sit at three fixed spots and their readings are provisional. The satellite index is not checked against water samples.</li></ul></details>';
return h;
}
function renderInv() {
var el = $('invBody'); if (!el) return;
loadSat();
var rows = SAT.zones ? satModel().filter(function (r) { return r.lough; }) : [];
if (!INV.date && rows.length && SAT.done === SAT.total) INV.date = rows.slice().sort(function (a, b) { return b.lough.m - a.lough.m; })[0].date;
var maxDay = addDays(new Date().toISOString().slice(0, 10), -6);
var h = '<h2>What led up to a day?</h2><p class="lede">Pick any date. This pulls together the weather, the rain over each river basin, the buoy readings and the satellite passes for the ' + INV_BEFORE + ' days before, and sets out what they suggest.</p>' +
'<div class="layers"><div class="lrow"><span class="llab">Date</span><input type="date" id="invDate" aria-label="Date to investigate" min="2023-03-15" max="' + maxDay + '" value="' + (INV.date || '') + '"></div>' +
'<div class="lrow"><span class="llab">Or a satellite day</span>' + (rows.length ? '<select id="invPick" aria-label="Choose a day the satellite saw"><option value="">Choose a day</option>' + rows.slice().reverse().map(function (r) { return '<option value="' + r.date + '"' + (r.date === INV.date ? ' selected' : '') + '>' + longDate(r.date) + ' · index ' + r.lough.m.toFixed(2) + '</option>'; }).join('') + '</select>' : '<span class="small">Loading the satellite days.</span>') + '</div></div>';
if (!INV.date) h += '<p class="small" role="status">' + (SAT.done < SAT.total || !SAT.total ? 'Loading the satellite record to find the highest day.' : 'Choose a date above.') + '</p>';
else { loadEvent(INV.date); var ev = INV.data[INV.date];
if (ev === 'loading' || !ev) h += '<p class="small" role="status">Gathering the weather, rain and buoy readings for ' + longDate(INV.date) + '. This takes a few seconds.</p>';
else if (ev === 'fail') h += '<p class="small">The records for this date could not be loaded. Please try again in a few minutes.</p>';
else if (!SAT.zones) h += '<p class="small" role="status">Loading the satellite record.</p>';
else h += invHtml(INV.date); }
el.innerHTML = h;
}
/* ---------- forecast: hindcast check and outlook for next season ---------- */
var FC = null, FCWX = null, FCSTATE = '';
function loadFc() {
if (FCSTATE || !window.fetch) return; FCSTATE = 'loading';
fetch('/api/outlook?v=3').then(function (res) { return res.json(); }).then(function (j) { if (j && j.ok) { FCWX = j; FCSTATE = 'ok'; } else FCSTATE = 'fail'; if (location.hash === '#forecast') renderFc(); }).catch(function () { FCSTATE = 'fail'; if (location.hash === '#forecast') renderFc(); });
}
/* The score. Algae build up on warm, bright, light-wind days and are knocked back by wind; calm brings them to the surface. */
function fcRun(days, p) {
var tw = 6, b = 0.02, out = [], prevW = 10, cl = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
days.forEach(function (d) {
tw += 0.15 * ((d.t + p.off) - tw);
var fT = cl((tw - p.t0) / (22 - p.t0), 0, 1.2), fL = cl(d.s / 12, 0.2, 1), fM = d.w <= 7 ? 1 : Math.max(0.2, 1 - (d.w - 7) / 12);
b = cl(b + b * p.r * fT * fL * fM * (1 - b) - b * (p.loss + (d.w > 15 ? 0.04 : 0)), 0.02, 1);
var w2 = (d.w + prevW) / 2, surf = w2 <= 5 ? 1 : Math.max(0.25, 1 - (w2 - 5) / 10); prevW = d.w;
out.push({ date: d.date, tw: tw, b: b, score: b * surf });
});
return out;
}
function fcRanks(a) { var idx = a.map(function (v, i) { return [v, i]; }).sort(function (x, y) { return x[0] - y[0]; }), r = [], i = 0; while (i < idx.length) { var k = i; while (k + 1 < idx.length && idx[k + 1][0] === idx[i][0]) k++; for (var q = i; q <= k; q++) r[idx[q][1]] = (i + k) / 2 + 1; i = k + 1; } return r; }
function fcRho(a, b) { if (a.length < 5) return null; var x = fcRanks(a), y = fcRanks(b), mx = avg(x), my = avg(y), s = 0, sx = 0, sy = 0; for (var i = 0; i < x.length; i++) { s += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) * (x[i] - mx); sy += (y[i] - my) * (y[i] - my); } return sx && sy ? s / Math.sqrt(sx * sy) : null; }
/* Tune the score on every year but the latest, test it on the latest, and summarise each season. */
function fcBuild() {
var years = Object.keys(FCWX.years).map(Number).sort(), wx = {}, inSea = function (date) { var m = +date.slice(5, 7); return m >= 6 && m <= 10; };
years.forEach(function (y) { wx[y] = FCWX.years[y].map(function (d) { return { date: y + '-' + d[0], t: d[1], tmax: d[2], w: d[3], r: d[4], s: d[5] }; }); });
var passes = satModel().filter(function (r) { return r.lough; }).map(function (r) { return { date: r.date, m: r.lough.m, h: r.lough.h }; });
var of = function (list) { return passes.filter(function (s) { return list.indexOf(+s.date.slice(0, 4)) >= 0; }); };
var pairs = function (by, ps, sea) { var a = [], b = []; ps.forEach(function (s) { if (sea && !inSea(s.date)) return; if (by[s.date] != null) { a.push(by[s.date]); b.push(s.m); } }); return [a, b]; };
var evaluate = function (by, ps, thr) { var all = pairs(by, ps, false), sea = pairs(by, ps, true), hits = 0, high = 0, fa = 0, low = 0; ps.forEach(function (s) { if (!inSea(s.date) || by[s.date] == null) return; var al = by[s.date] >= thr; if (s.h >= 0.5) { high++; if (al) hits++; } else { low++; if (al) fa++; } }); return { passes: all[0].length, seasonPasses: sea[0].length, rho: fcRho(all[0], all[1]), rhoSeason: fcRho(sea[0], sea[1]), highDays: high, caught: hits, lowDays: low, falseAlarms: fa }; };
var testYear = years[years.length - 1], trainYears = years.slice(0, -1), grid = [];
[0, 2].forEach(function (off) { [0.15, 0.25, 0.35].forEach(function (r) { [0.02, 0.04].forEach(function (loss) { [12, 14].forEach(function (t0) { grid.push({ off: off, r: r, loss: loss, t0: t0 }); }); }); }); });
var scoreFor = function (p, list) { var by = {}; list.forEach(function (y) { fcRun(wx[y], p).forEach(function (d) { by[d.date] = d.score; }); }); return by; };
var best = null; grid.forEach(function (p) { var pr = pairs(scoreFor(p, trainYears), of(trainYears), true), rho = fcRho(pr[0], pr[1]); if (rho != null && (!best || rho > best.rho)) best = { p: p, rho: rho }; });
if (!best) return null;
var P = best.p, by = scoreFor(P, years), tr = of(trainYears).filter(function (s) { return inSea(s.date) && by[s.date] != null; }), cands = tr.map(function (s) { return by[s.date]; }).sort(function (a, b) { return a - b; }), thr = cands[Math.floor(cands.length / 2)] || 0.1, bestJ = -9;
cands.forEach(function (c) { var hi = 0, hit = 0, lo = 0, fa = 0; tr.forEach(function (s) { if (s.h >= 0.5) { hi++; if (by[s.date] >= c) hit++; } else { lo++; if (by[s.date] >= c) fa++; } }); if (!hi || !lo) return; var J = hit / hi - fa / lo; if (J > bestJ) { bestJ = J; thr = c; } });
var monthMean = {}; for (var mo = 1; mo <= 12; mo++) { var v = of(trainYears).filter(function (s) { return +s.date.slice(5, 7) === mo; }).map(function (s) { return s.m; }); monthMean[mo] = v.length ? avg(v) : 0; }
var clim = {}; passes.forEach(function (s) { clim[s.date] = monthMean[+s.date.slice(5, 7)]; });
var skill = { train: evaluate(by, of(trainYears), thr), test: evaluate(by, of([testYear]), thr), calendarOnly: { test: evaluate(clim, of([testYear]), 1e9).rhoSeason } };
skill.train.years = trainYears; skill.test.years = [testYear];
var nowState = null, perYear = years.map(function (y) {
var days = wx[y], series = fcRun(days, P), summer = days.filter(function (d) { return inSea(d.date); }), ps = of([y]), sea = ps.filter(function (s) { return inSea(s.date); }), above = ps.filter(function (s) { return s.m >= 0.1; }), pk = ps.slice().sort(function (a, b) { return b.m - a.m; })[0];
if (y === testYear && series.length) { var ls = series[series.length - 1]; nowState = { date: ls.date, score: ls.score, water: ls.tw }; }
var weekly = []; for (var i = 0; i + 6 < series.length; i += 7) weekly.push([series[i].date.slice(5), avg(series.slice(i, i + 7).map(function (d) { return d.score; }))]);
return { year: y, complete: days.length && days[days.length - 1].date >= y + '-10-31',
summer: summer.length ? { meanTemp: avg(summer.map(function (d) { return d.t; })), warmCalmDays: summer.filter(function (d) { return d.tmax >= 19 && d.w < 9 && d.s >= 9; }).length, calmDays: summer.filter(function (d) { return d.w < 6; }).length, rain: Math.round(summer.reduce(function (s, d) { return s + d.r; }, 0)) } : null,
satellite: { seasonUsable: sea.length, highDays: sea.filter(function (s) { return s.h >= 0.5; }).length, first: above.length ? above[0].date : null, last: above.length ? above[above.length - 1].date : null, peak: pk ? { date: pk.date, m: pk.m } : null, seasonMean: sea.length ? avg(sea.map(function (s) { return s.m; })) : null },
weekly: weekly, passes: ps.map(function (s) { return [s.date.slice(5), s.m, s.h]; }) };
});
return { alarmLevel: thr, params: P, now: nowState, skill: skill, years: perYear };
}
function dm(date) { return date ? shortDate(date.length === 5 ? '2000-' + date : date) : 'none'; }
function strength(r) { return r == null ? 'could not be worked out' : r >= 0.7 ? 'strong' : r >= 0.5 ? 'moderate' : r >= 0.3 ? 'weak' : r > 0.1 ? 'very weak' : 'no better than chance'; }
function fcYearChart(y, alarm) {
var W = 560, H = 150, L = 34, Rr = 40, T = 10, B = 24, start = Date.UTC(y.year, 2, 1), end = Date.UTC(y.year, 10, 15), span = end - start;
var X = function (md) { return L + (W - L - Rr) * (Date.parse(y.year + '-' + md + 'T00:00:00Z') - start) / span; }, top = FC.top, Ys = function (v) { return T + (H - T - B) * (1 - Math.min(top, v) / top); }, Yi = function (v) { return T + (H - T - B) * (1 - (Math.max(-0.1, Math.min(0.5, v)) + 0.1) / 0.6); };
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + y.year + ': weather score and satellite index"><g font-family="var(--body)" font-size="12" fill="var(--muted)">';
['03', '04', '05', '06', '07', '08', '09', '10', '11'].forEach(function (m) { var x = X(m + '-01'); s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--line)"/><text x="' + (x + 4).toFixed(1) + '" y="' + (H - 8) + '">' + MONN[+m - 1] + '</text>'; });
s += '<text x="' + (L - 4) + '" y="' + (Ys(0) + 4) + '" text-anchor="end">0</text><text x="' + (W - Rr + 4) + '" y="' + (Yi(0.1) + 4).toFixed(1) + '">0.1</text><text x="' + (W - Rr + 4) + '" y="' + (Yi(0.4) + 4).toFixed(1) + '">0.4</text></g>';
var pts = y.weekly.filter(function (w) { return w[0] >= '03-01' && w[0] <= '11-15'; });
if (pts.length > 1) s += '<polygon fill="var(--accent)" opacity="0.25" points="' + X(pts[0][0]).toFixed(1) + ',' + Ys(0) + ' ' + pts.map(function (w) { return X(w[0]).toFixed(1) + ',' + Ys(w[1]).toFixed(1); }).join(' ') + ' ' + X(pts[pts.length - 1][0]).toFixed(1) + ',' + Ys(0) + '"/><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="' + pts.map(function (w) { return X(w[0]).toFixed(1) + ',' + Ys(w[1]).toFixed(1); }).join(' ') + '"/>';
s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Ys(alarm).toFixed(1) + '" y2="' + Ys(alarm).toFixed(1) + '" stroke="var(--accent)" stroke-dasharray="5 4"/>';
(y.passes || []).forEach(function (p) { if (p[0] < '03-01' || p[0] > '11-15') return; s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Yi(p[1]).toFixed(1) + '" r="' + (p[2] >= 0.5 ? 5 : 3.5) + '" fill="' + rampColour(p[1]).bg + '" stroke="var(--ink)" stroke-width="1"><title>' + dm(p[0]) + ' ' + y.year + ': satellite ' + p[1].toFixed(2) + '</title></circle>'; });
return s + '</svg>';
}
function fcHtml() {
FC.top = Math.max(FC.alarmLevel * 1.5, 1.15 * Math.max.apply(null, FC.years.map(function (y) { return Math.max.apply(null, y.weekly.map(function (w) { return w[1]; }).concat([0])); }))) || 0.5;
var Y = FC.years, sk = FC.skill, next = FC.years[FC.years.length - 1].year + 1, done = Y.filter(function (y) { return y.summer && y.satellite.seasonUsable; });
if (!done.length) return '<p class="small">Not enough satellite data loaded to work out an outlook.</p>';
var h = '<h2>Outlook for ' + next + '</h2><p class="lede">What four seasons of satellite and weather records can and cannot say about next year, with a test of how far to trust it.</p>' +
'<p class="notice"><strong>A range, not a prediction.</strong> How bad a season gets depends mostly on the summer\'s weather, which nobody can forecast this far ahead. This page shows the likely window and what different summers have produced before.</p>';
/* outlook */
var firsts = done.map(function (y) { return y.satellite.first; }).filter(Boolean).map(function (d) { return d.slice(5); }).sort(), lasts = done.map(function (y) { return y.satellite.last; }).filter(Boolean).map(function (d) { return d.slice(5); }).sort(), peaks = done.map(function (y) { return y.satellite.peak ? y.satellite.peak.date.slice(5) : null; }).filter(Boolean).sort();
var shares = done.map(function (y) { return y.satellite.highDays / y.satellite.seasonUsable; }).sort(function (a, b) { return a - b; });
h += '<h3>What to expect</h3><dl class="invfinds">' +
'<div><dt>Will there be blooms?</dt><dd><strong>Very likely.</strong> The satellite index went above 0.1 in every one of the ' + done.length + ' years on record. The phosphorus already in the lough does not clear in a year.</dd></div>' +
'<div><dt>When</dt><dd>First signs between <strong>' + dm(firsts[0]) + ' and ' + dm(firsts[firsts.length - 1]) + '</strong>. Peaks have fallen between <strong>' + dm(peaks[0]) + ' and ' + dm(peaks[peaks.length - 1]) + '</strong>. The last high readings came between ' + dm(lasts[0]) + ' and ' + dm(lasts[lasts.length - 1]) + '.</dd></div>' +
'<div><dt>How severe</dt><dd>In past seasons, between <strong>' + Math.round(shares[0] * 100) + '% and ' + Math.round(shares[shares.length - 1] * 100) + '%</strong> of the clear June to October satellite days showed more than half the water above 0.1. Where ' + next + ' lands in that range depends on the summer.</dd></div>' +
'<div><dt>What decides it</dt><dd>Runs of warm, sunny, light-wind days build the algae up. Calm days bring it to the surface. Wind mixes it away. Heavy rain washes fresh phosphorus in from the rivers.</dd></div></dl>';
/* scenarios */
var sc = done.slice().sort(function (a, b) { return a.summer.warmCalmDays - b.summer.warmCalmDays; });
h += '<h3>If ' + next + ' has a summer like...</h3><p class="small">Each past summer is one possible ' + next + '. They are ordered from the fewest warm, calm, sunny days to the most.</p><div class="tablewrap"><table class="sat inv"><thead><tr><th class="lh" scope="col">A summer like</th><th scope="col">Average air</th><th scope="col">Warm, calm, sunny days</th><th scope="col">Calm days</th><th scope="col">Rain</th><th scope="col">Satellite: high days</th><th scope="col">Satellite: season average</th><th scope="col">Peak</th></tr></thead><tbody>' + sc.map(function (y, i) {
var col = rampColour(y.satellite.seasonMean == null ? 0 : y.satellite.seasonMean);
return '<tr><th scope="row">' + y.year + (y.complete ? '' : ' (so far)') + (i === 0 ? ' · fewest' : i === sc.length - 1 ? ' · most' : '') + '</th><td>' + y.summer.meanTemp.toFixed(1) + '°C</td><td>' + y.summer.warmCalmDays + '</td><td>' + y.summer.calmDays + '</td><td>' + y.summer.rain + ' mm</td><td>' + y.satellite.highDays + ' of ' + y.satellite.seasonUsable + '</td><td><span class="cell" style="background:' + col.bg + ';color:' + col.fg + '">' + (y.satellite.seasonMean == null ? '' : y.satellite.seasonMean.toFixed(2)) + '</span></td><td>' + (y.satellite.peak ? dm(y.satellite.peak.date) + ' (' + y.satellite.peak.m.toFixed(2) + ')' : '') + '</td></tr>';
}).join('') + '</tbody></table></div><p class="small">June to October figures. Cloud hides many days, so a year with few clear days can look milder or worse than it was.</p>';
/* hindcast */
var te = sk.test, tr = sk.train, cal = sk.calendarOnly.test, beats = te.rhoSeason != null && cal != null && te.rhoSeason > cal + 0.1;
h += '<h3>How far can a weather-based forecast be trusted?</h3><p>To find out, a simple score was built from temperature, sunshine and wind alone. It was tuned on ' + tr.years[0] + ' to ' + tr.years[tr.years.length - 1] + ', then run on <strong>' + te.years[0] + ', a year it had never seen</strong>, and compared with what the satellite recorded.</p><dl class="invfinds">' +
'<div><dt>Ranking the days in ' + te.years[0] + '</dt><dd>Across ' + te.seasonPasses + ' clear June to October days, the match between the score and the satellite was <strong>' + strength(te.rhoSeason) + '</strong> (' + (te.rhoSeason == null ? 'n/a' : te.rhoSeason.toFixed(2)) + ', where 0 is chance and 1 is perfect).</dd></div>' +
'<div><dt>Against the calendar</dt><dd>Simply knowing the month scores ' + (cal == null ? 'n/a' : cal.toFixed(2)) + ' on the same days. ' + (beats ? 'The weather score <strong>adds real information</strong> beyond the time of year.' : 'So the weather score is <strong>not yet clearly better than the calendar</strong>.') + '</dd></div>' +
'<div><dt>Catching the high days</dt><dd>In ' + te.years[0] + ' it flagged <strong>' + te.caught + ' of the ' + te.highDays + ' high days</strong> the satellite saw, and raised a false alarm on ' + te.falseAlarms + ' of the ' + te.lowDays + ' other days. In the years it was tuned on: ' + tr.caught + ' of ' + tr.highDays + ' caught, ' + tr.falseAlarms + ' false alarms in ' + tr.lowDays + '.</dd></div>' +
'<div><dt>What that means</dt><dd>' + (beats && te.highDays && te.caught / te.highDays >= 0.6 ? 'Good enough to use as an early warning a few days ahead, when paired with the live weather forecast. Not good enough to promise how a whole season will go.' : 'Treat the score as a rough guide only. It needs more years, the buoy readings and river data before it can be relied on.') + '</dd></div></dl>';
h += '<h3>The score against the satellite, year by year</h3><p class="small">Shaded line: the weather score each week, with its alarm level dashed (left scale). Dots: the satellite algae index on each clear day (right scale). Larger dots are days when more than half the water was above 0.1.</p><div class="charts">' + Y.map(function (y) { return '<div class="chart"><div class="charttitle">' + y.year + (te.years[0] === y.year ? ' · not used for tuning' : '') + '</div>' + fcYearChart(y, FC.alarmLevel) + '</div>'; }).join('') + '</div>';
/* tracker */
var n = FC.now;
h += '<h3>Early warning for ' + next + '</h3><p>The same score keeps running on each new day of weather, so this section becomes a live tracker once spring arrives.</p><dl class="invfinds">' +
(n ? '<div><dt>Where it stands</dt><dd>On ' + longDate(n.date) + ' the score was <strong>' + n.score.toFixed(2) + '</strong> against an alarm level of ' + FC.alarmLevel.toFixed(2) + ', with the water estimated at ' + n.water.toFixed(1) + '°C. ' + (n.water < 12 ? 'The water is too cold for blooms, as expected at this time of year.' : n.score >= FC.alarmLevel ? 'That is above the alarm level.' : 'That is below the alarm level.') + '</dd></div>' : '') +
'<div><dt>Watch for, in order</dt><dd><ol class="fcsteps"><li>Water passing <strong>18°C</strong>. Check the buoys on the Map tab.</li><li>A run of <strong>three or more</strong> warm, sunny days with wind under 9 mph.</li><li>The score crossing its alarm level.</li><li>Heavy rain over the river basins, followed by <strong>two calm days</strong>. That is the pattern before 24 August 2026.</li><li>The five-day outlook on the Map tab turning amber or red for a shore.</li></ol></dd></div></dl>';
h += '<details class="fold"><summary>What this cannot do</summary><ul class="notes">' +
'<li>Four seasons is a very short record. One unusual year would change these ranges.</li>' +
'<li>The score uses weather only. It knows nothing about river phosphorus, river flow, phosphorus stored in the lough bed, or zebra mussels.</li>' +
'<li>It is tested against the satellite index, which is itself not checked against water samples. Cloud hides most days.</li>' +
'<li>The score was tuned to rank days in order, not to give amounts. Its number has no unit.</li>' +
'<li>Weather records come from a weather model for the centre of the lough and run about six days behind.</li>' +
'<li>Do not use this to decide whether water is safe. Follow DAERA and council notices.</li></ul></details>';
return h;
}
function renderFc() {
var el = $('fcBody'); if (!el) return; loadFc(); loadSat();
var ready = FCWX && SAT.zones && SAT.total && SAT.done === SAT.total;
if (ready) { FC = fcBuild(); }
if (ready && FC && FC.years.some(function (y) { return y.satellite.seasonUsable; })) el.innerHTML = (SAT.failed ? '<p class="notice"><strong>Some satellite data is missing.</strong> ' + SAT.failed + ' of the ' + SAT.total + ' half-years could not be loaded, so the figures below are incomplete. Refresh the page in a few minutes.</p>' : '') + fcHtml();
else el.innerHTML = '<p class="small" role="status">' + (FCSTATE === 'fail' || (ready && !FC) || (SAT.total && SAT.done === SAT.total && !SAT.zones) ? 'The outlook could not be worked out right now, because the weather or satellite records did not load. Please try again in a few minutes.' : 'Running the score over every year since 2023 and checking it against the satellite. This can take up to a minute the first time. Loaded ' + SAT.done + ' of ' + (SAT.total || 8) + ' satellite half-years.') + '</p>';
}
/* ---------- rivers: one river's catchment in detail ---------- */
var RIV = { list: null, listState: '', id: null, data: {} }, RIVMAP = null, rivLayer = null;
function loadRivers() {
if (RIV.listState || !window.fetch) return; RIV.listState = 'loading';
fetch('/api/river?list=1').then(function (res) { return res.json(); }).then(function (j) { if (j && j.ok) { RIV.list = j.rivers; RIV.listState = 'ok'; if (!RIV.id) { var first = j.rivers.filter(function (x) { return x.max != null; })[0] || j.rivers[0]; if (first) RIV.id = first.id; } } else RIV.listState = 'fail'; if (location.hash === '#rivers') renderRiv(); }).catch(function () { RIV.listState = 'fail'; if (location.hash === '#rivers') renderRiv(); });
}
function loadRiver(id) {
if (RIV.data[id] || !window.fetch) return; RIV.data[id] = 'loading';
fetch('/api/river?id=' + id).then(function (res) { return res.json(); }).then(function (j) { RIV.data[id] = j && j.ok ? j : 'fail'; if (location.hash === '#rivers' && RIV.id === id) renderRiv(); }).catch(function () { RIV.data[id] = 'fail'; if (location.hash === '#rivers' && RIV.id === id) renderRiv(); });
}
function rivGo(id) { RIV.id = id; location.hash = '#rivers'; renderRiv(); window.scrollTo(0, 0); }
function rivMapDraw(d) {
if (!window.L) { $('rivMap').innerHTML = '<p class="mapfail">The map could not load. The figures below still work.</p>'; return; }
if (!RIVMAP) { RIVMAP = L.map('rivMap', { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 8, maxZoom: 17, scrollWheelZoom: false, dragging: !L.Browser.mobile }); RIVMAP.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(RIVMAP); }
RIVMAP.invalidateSize();
if (rivLayer && rivLayer.rivId === d.id) return;
if (rivLayer) RIVMAP.removeLayer(rivLayer);
rivLayer = L.layerGroup(); rivLayer.rivId = d.id;
var outline = L.polygon(d.rings.map(function (ring) { return ring.map(function (p) { return [p[1], p[0]]; }); }), { color: '#10262e', weight: 2.5, fillColor: '#0d6a62', fillOpacity: 0.08, interactive: false }).addTo(rivLayer);
(d.overflows || []).forEach(function (o) { if (o.lat) L.marker([o.lat, o.lon], { icon: L.divIcon({ html: '<span class="hp s rv">O</span>', className: 'mk', iconSize: [22, 20], iconAnchor: [11, 10] }), title: o.name, zIndexOffset: 100 }).bindPopup('<strong>' + esc(o.name) + '</strong><br>NI Water storm overflow or pumping station' + (o.vol ? '<br>Predicted to spill ' + nf(o.vol) + ' cubic metres a year' : '<br>No spill prediction yet') + (o.cls ? '<br>NI Water class: ' + esc(o.cls) : '')).addTo(rivLayer); });
(d.works || []).concat(d.worksNearby || []).forEach(function (w) { if (w.lat) L.marker([w.lat, w.lon], { icon: L.divIcon({ html: '<span class="hp i rv">W</span>', className: 'mk', iconSize: [22, 20], iconAnchor: [11, 10] }), title: w.name, zIndexOffset: 200 }).bindPopup('<strong>' + esc(w.name) + '</strong><br>NI Water sewage treatment works' + (w.into ? '<br>Discharges to: ' + esc(w.into) : '')).addTo(rivLayer); });
(d.sites || []).forEach(function (s, k) { if (s.lat) L.marker([s.lat, s.lon], { icon: L.divIcon({ html: '<span class="hp p rv">T' + (k + 1) + '</span>', className: 'mk', iconSize: [26, 20], iconAnchor: [13, 10] }), title: siteName(s.name), zIndexOffset: 300 }).bindPopup('<strong>T' + (k + 1) + ' · ' + esc(siteName(s.name)) + '</strong><br>Test site ' + esc(s.code) + '<br>2020 to 2024 average: ' + s.mean.toFixed(3) + ' mg/l of dissolved phosphorus').addTo(rivLayer); });
rivLayer.addTo(RIVMAP); RIVMAP.fitBounds(outline.getBounds().pad(0.08));
}
function rivBars(vals, labels, colour, title, mark) {
var W = 300, H = 130, L = 34, B = 20, T = 8, top = Math.max.apply(null, vals.filter(function (v) { return v != null; }).concat([0.05])) * 1.15, bw = (W - L - 6) / vals.length;
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + title + '"><g font-family="var(--body)" font-size="11" fill="var(--muted)"><line x1="' + L + '" x2="' + (W - 6) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--line)"/><text x="' + (L - 4) + '" y="' + (T + 8) + '" text-anchor="end">' + top.toFixed(top < 1 ? 2 : 1) + '</text><text x="' + (L - 4) + '" y="' + (H - B) + '" text-anchor="end">0</text>';
vals.forEach(function (v, i) { var x = L + i * bw; if (v != null) { var hh = (H - B - T) * v / top; s += '<rect x="' + (x + bw * 0.15).toFixed(1) + '" y="' + (H - B - hh).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="' + (mark && mark(i) ? colour[1] : colour[0]) + '"><title>' + labels[i] + ': ' + v.toFixed(3) + ' mg/l</title></rect>'; } if (vals.length <= 12 || i % 2 === 0) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (vals.length <= 12 ? labels[i].charAt(0) : labels[i].slice(2)) + '</text>'; });
return s + '</g></svg>';
}
function rivPattern(s) { if (s.summer == null || s.winter == null || !s.winter) return null; var ratio = s.summer / s.winter; return { ratio: ratio, kind: ratio >= 1.4 ? 'summer' : ratio <= 0.75 ? 'winter' : 'even' }; }
function rivHtml(d) {
var S = d.sites || [], top = S[0], pat = top ? rivPattern(top) : null, h = '';
var meta = (RIV.list || []).filter(function (x) { return x.id === d.id; })[0];
h += '<dl class="facts"><div><dt>Catchment area</dt><dd>' + d.km2.toFixed(1) + ' km²</dd></div><div><dt>Overall status, 2018</dt><dd>' + wfd(d.status)[0] + '</dd></div><div><dt>Phosphorus test sites</dt><dd>' + S.length + '</dd></div><div><dt>Main basin</dt><dd>' + (meta ? basinLabel(meta.basin) : '') + '</dd></div></dl>';
/* the tests */
h += '<h3>What the river tests show</h3>';
if (!S.length) h += '<p>DAERA has no phosphorus test site with enough recent readings inside this river\'s catchment, so there is no measured figure here. The sections below still show what could be affecting it.</p>';
S.forEach(function (s, k) {
var p = rivPattern(s), ch = s.prev == null ? '' : s.mean - s.prev > 0.005 ? ', up from ' + s.prev.toFixed(3) + ' in 2015 to 2019' : s.prev - s.mean > 0.005 ? ', down from ' + s.prev.toFixed(3) + ' in 2015 to 2019' : ', about the same as 2015 to 2019';
var am = d.other && d.other.ammonia && d.other.ammonia.by[s.code], bod = d.other && d.other.bod && d.other.bod.by[s.code];
h += '<div class="rivsite"><p><strong>T' + (k + 1) + ' · ' + esc(siteName(s.name)) + '</strong> (site ' + esc(s.code) + ')</p><p>Dissolved phosphorus averaged <strong>' + s.mean.toFixed(3) + ' mg/l</strong> over 2020 to 2024 from ' + s.n + ' tests' + ch + '. The highest single reading was ' + s.max.toFixed(2) + ' mg/l.' + (am ? ' Ammonia averaged ' + am.mean.toFixed(3) + ' mg/l' + (bod ? ' and oxygen demand ' + bod.mean.toFixed(1) + ' mg/l' : '') + '.' : '') + '</p>' +
'<div class="charts"><div class="chart"><div class="charttitle">Average by year, mg/l</div>' + rivBars(s.years, ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'], ['#5a2c86', '#5a2c86'], 'Phosphorus by year') + '</div><div class="chart"><div class="charttitle">Average by month, 2015 to 2024, mg/l</div>' + rivBars(s.months, MONN, ['#8a6fb0', '#c97f00'], 'Phosphorus by month', function (i) { return i >= 3 && i <= 8; }) + '<div class="legend"><span class="key"><span class="sw" style="background:#c97f00"></span>April to September</span><span class="key"><span class="sw" style="background:#8a6fb0"></span>October to March</span></div></div></div>' +
(p ? '<p class="small">Summer half-year ' + s.summer.toFixed(3) + ' mg/l, winter half-year ' + s.winter.toFixed(3) + ' mg/l: ' + (p.kind === 'summer' ? '<strong>' + p.ratio.toFixed(1) + ' times higher in summer</strong>.' : p.kind === 'winter' ? '<strong>' + (1 / p.ratio).toFixed(1) + ' times higher in winter</strong>.' : 'much the same all year.') + '</p>' : '') + '</div>';
});
/* reading the pattern */
var W = d.works || [], O = d.overflows || [], I = d.incidents, F = d.fieldRisk, rows = [];
if (pat) rows.push(['The seasonal pattern', pat.kind === 'summer' ? 'Phosphorus here is <strong>much higher in summer than winter</strong>. That is the usual mark of a <strong>steady source that runs all year</strong>, such as a sewage works, septic tanks or a yard drain. In summer the river is low, so the same amount is far less diluted. Run-off from fields usually does the opposite and peaks in wet weather.' : pat.kind === 'winter' ? 'Phosphorus here is <strong>higher in the wet half of the year</strong>. That is the usual mark of <strong>run-off from land</strong>: rain carrying soil, slurry and fertiliser off fields and yards, and storm overflows spilling. A steady pipe discharge usually shows the opposite.' : 'Phosphorus here is <strong>much the same in summer and winter</strong>, which suggests a mix of steady sources and wet-weather run-off, with neither clearly in charge.']);
rows.push(['Sewage works', W.length ? W.map(function (w) { return '<strong>' + esc(w.name) + '</strong>'; }).join(' and ') + (W.length === 1 ? ' discharges' : ' discharge') + ' treated sewage into this river, according to NI Water\'s records.' + ((d.worksNearby || []).length ? ' ' + d.worksNearby.length + ' other works sit inside the catchment but discharge to a different river.' : '') : 'NI Water records no treatment works discharging to this river.' + ((d.worksNearby || []).length ? ' ' + d.worksNearby.map(function (w) { return esc(w.name); }).join(', ') + ' sits inside the catchment but is recorded as discharging elsewhere.' : '')]);
var spill = O.filter(function (o) { return o.vol > 0; }), tbd = O.filter(function (o) { return /determined/i.test(o.cls); }), uns = O.filter(function (o) { return /unsat/i.test(o.cls); });
rows.push(['Storm overflows', O.length ? '<strong>' + O.length + '</strong> NI Water overflows and pumping stations in the catchment. ' + (spill.length ? 'Predicted spills total ' + nf(spill.reduce(function (s, o) { return s + o.vol; }, 0)) + ' cubic metres a year, the largest at ' + esc(spill[0].name) + '. ' : '') + (uns.length ? uns.length + ' classed unsatisfactory. ' : '') + (tbd.length ? '<strong>' + tbd.length + ' still to be assessed</strong>, so nobody yet knows how much they spill.' : '') : 'None recorded in the catchment.']);
if (I) rows.push(['Pollution incidents, 2011 to 2024', I.total ? '<strong>' + I.total + '</strong> recorded in the squares touching the catchment: ' + I.farm + ' farming, ' + I.sewage + ' sewage or households, ' + I.industry + ' industry, ' + Math.max(0, I.total - I.farm - I.sewage - I.industry) + ' other or unknown. ' + I.years.slice(-5).reduce(function (a, b) { return a + b; }, 0) + ' of them since 2020. Squares on the edge are counted whole, so this slightly overstates it.' : 'None recorded.']);
if (F) { var tot = F.low + F.medium + F.high; rows.push(['Farmland run-off risk', tot ? 'DAERA has scored ' + nf(tot) + ' hectares here for run-off risk: <strong>' + nf(F.high) + ' ha high</strong>, ' + nf(F.medium) + ' ha medium, ' + nf(F.low) + ' ha low.' + (d.fieldUse && d.fieldUse.length ? ' Mostly ' + d.fieldUse.slice(0, 2).map(function (u) { return String(u.use).toLowerCase() + ' (' + nf(u.ha) + ' ha)'; }).join(' and ') + '.' : '') + ' Only part of the farmland is scored.' : 'No fields in this catchment have a DAERA run-off risk score.']); }
if (d.farmArea) { var fa = d.farmArea, ha = fa.farmedHa || 1, est = d.km2 * 100 * 0.75; rows.push(['Livestock', 'The wider ' + esc(tidyName(fa.name)) + ' electoral area averages ' + (fa.cattle / ha).toFixed(1) + ' cattle, ' + (fa.pigs / ha).toFixed(1) + ' pigs and ' + Math.round(fa.poultry / ha) + ' poultry per farmed hectare (2019 census). If this catchment is typical of it, that would be very roughly <strong>' + nf(Math.round(fa.cattle / ha * est / 100) * 100) + ' cattle</strong> and ' + nf(Math.round(fa.farms / ha * est)) + ' farms. The census does not say where farms are, so this is an estimate.' + (d.poultryHouses != null ? ' DAERA\'s test layer maps ' + d.poultryHouses + ' poultry ' + (d.poultryHouses === 1 ? 'house' : 'houses') + ' inside the catchment.' : '')]); }
h += '<h3>What could be feeding it</h3><dl class="invfinds">' + rows.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
/* what could be done */
var act = [];
if (W.length && (!pat || pat.kind !== 'winter')) act.push(['Ask about phosphorus removal at ' + W.map(function (w) { return esc(w.name); }).join(' and '), 'Find out from NI Water whether the works has a phosphorus limit in its consent, what it achieves, and whether an upgrade is planned. Small works often have no phosphorus removal at all.', 'NI Water, with NIEA as regulator']);
if (S.length && W.length) act.push(['Test above and below the works', 'One extra sampling point upstream of the discharge would show in a few months how much of the phosphorus the works adds. This is the cheapest way to settle the question.', 'NIEA, or a rivers trust or citizen science group']);
if (tbd.length) act.push(['Get the ' + tbd.length + ' unassessed overflows measured', 'Ask NI Water when these will be assessed and whether spill monitors can be fitted, so their part is known instead of guessed.', 'NI Water']);
if (uns.length) act.push(['Fix the overflows already classed unsatisfactory', uns.slice(0, 3).map(function (o) { return esc(o.name); }).join(', ') + (uns.length > 3 ? ' and others' : '') + '. These are already known to spill too often.', 'NI Water']);
if (F && F.high >= 5) act.push(['Target the ' + nf(F.high) + ' hectares of high-risk fields', 'Buffer strips, fenced watercourses, soil testing and careful slurry timing on these fields give the most benefit for the least land. Support is available through DAERA schemes and the Soil Nutrient Health Scheme.', 'Farmers, with CAFRE and DAERA advisers']);
if (I && I.farm >= 5) act.push(['Look at what the ' + I.farm + ' farm incidents had in common', 'Repeated incidents usually trace to a few fixable things: slurry storage that is too small, yard drains, or silage effluent. A pattern would show where advice or grant aid would help most.', 'NIEA and CAFRE advisers']);
if (I && I.sewage >= 5) act.push(['Check for misconnections and failing septic tanks', I.sewage + ' incidents were recorded as sewage or household. Outside the sewered area, septic tanks near streams are a common steady source.', 'NI Water, councils and householders']);
if (pat && pat.kind === 'summer' && !W.length) act.push(['Look for a steady source', 'The summer peak points to something discharging all year, but no treatment works is recorded here. Septic tanks, yard drains and private discharges are the places to look.', 'NIEA catchment officers']);
if (!act.length) act.push(['Start with better measurement', 'There is not enough here to point at a cause. A season of extra sampling would show whether this river needs attention.', 'NIEA or a local group']);
h += '<h3>What could be looked at or fixed</h3><p class="small">Suggested from the patterns above, as questions to ask and things to check. The aim is to find causes that can be put right, not to blame anyone.</p><ol class="rivacts">' + act.map(function (a) { return '<li><strong>' + a[0] + '.</strong> ' + a[1] + ' <span class="who">Who could act: ' + a[2] + '.</span></li>'; }).join('') + '</ol>';
h += '<details class="fold"><summary>What this page cannot tell you</summary><ul class="notes">' +
'<li>The catchment is the land DAERA assigns to this river water body. It does not include rivers upstream that flow into it, and it does not know which parts lie upstream of each test site.</li>' +
'<li>How much phosphorus each source adds is not measured anywhere in this data. The seasonal pattern is a well-used pointer, not proof.</li>' +
'<li>Private discharge consents, septic tanks and individual farm locations are not in DAERA\'s open data.</li>' +
'<li>River tests are published raw and stop at 2024. The farm census is from 2019.</li>' +
'<li>Nothing here shows that anyone has broken a rule.</li></ul></details>';
return h;
}
function renderRiv() {
var head = $('rivHead'), el = $('rivBody'); if (!el) return; loadRivers();
var h = '<h2>River by river</h2><p class="lede">Choose a river to see its own catchment: what the tests show, what could be feeding it, and what could be checked or fixed.</p><p class="notice"><strong>This is about causes, not blame.</strong> The aim is to find what can be put right and who is able to do it.</p>';
if (!RIV.list) { head.innerHTML = h + '<p class="small" role="status">' + (RIV.listState === 'fail' ? 'The list of rivers could not be loaded. Please try again in a few minutes.' : 'Loading the rivers in the Lough Neagh catchment.') + '</p>'; el.innerHTML = ''; $('rivMap').parentNode.hidden = true; return; }
var tested = RIV.list.filter(function (x) { return x.max != null; }), rest = RIV.list.filter(function (x) { return x.max == null; });
h += '<div class="layers"><div class="lrow"><span class="llab">River</span><select id="rivPick" aria-label="Choose a river"><optgroup label="With phosphorus tests, highest first">' + tested.map(function (x) { return '<option value="' + x.id + '"' + (x.id === RIV.id ? ' selected' : '') + '>' + esc(x.name) + ' · ' + x.max.toFixed(3) + ' mg/l · ' + basinLabel(x.basin) + '</option>'; }).join('') + '</optgroup><optgroup label="No recent phosphorus tests">' + rest.map(function (x) { return '<option value="' + x.id + '"' + (x.id === RIV.id ? ' selected' : '') + '>' + esc(x.name) + ' · ' + basinLabel(x.basin) + '</option>'; }).join('') + '</optgroup></select></div></div>' +
'<p class="small">' + RIV.list.length + ' river water bodies drain to the lough. ' + tested.length + ' have a test site with recent readings.</p>';
var d = RIV.id ? RIV.data[RIV.id] : null; if (RIV.id) loadRiver(RIV.id);
var cur = RIV.list.filter(function (x) { return x.id === RIV.id; })[0];
h += '<h3 class="rivname">' + (cur ? esc(cur.name) : '') + '</h3>';
head.innerHTML = h;
if (!d || d === 'loading') { el.innerHTML = '<p class="small" role="status">Gathering everything recorded for this river. This takes a few seconds.</p>'; $('rivMap').parentNode.hidden = true; return; }
if (d === 'fail') { el.innerHTML = '<p class="small">The records for this river could not be loaded. Please try again in a few minutes.</p>'; $('rivMap').parentNode.hidden = true; return; }
$('rivMap').parentNode.hidden = false; rivMapDraw(d);
$('rivCap').innerHTML = '<span class="key"><span class="hp p">T</span>test site</span><span class="key"><span class="hp i">W</span>sewage works</span><span class="key"><span class="hp s">O</span>storm overflow or pumping station</span><span class="key">outline: this river\'s catchment</span>';
el.innerHTML = rivHtml(d);
}
function showView() {
var v = location.hash === '#analysis' ? 'Analysis' : location.hash === '#areas' ? 'Areas' : location.hash === '#satellite' ? 'Satellite' : location.hash === '#investigate' ? 'Investigate' : location.hash === '#forecast' ? 'Forecast' : location.hash === '#rivers' ? 'Rivers' : 'Map';
['Map', 'Analysis', 'Areas', 'Rivers', 'Satellite', 'Investigate', 'Forecast'].forEach(function (n) {
$('view' + n).hidden = n !== v;
if (n === v) $('tab' + n).setAttribute('aria-current', 'page'); else $('tab' + n).removeAttribute('aria-current');
});
if (v === 'Analysis') renderAnalysis(); else if (v === 'Areas') renderAreas(); else if (v === 'Satellite') renderSat(); else if (v === 'Investigate') renderInv(); else if (v === 'Forecast') renderFc(); else if (v === 'Rivers') renderRiv(); else if (MAP) MAP.invalidateSize();
}
/* ---------- Sentinel-2 pictures for a chosen day ---------- */
var S2BOX = [[54.42, -6.78], [54.82, -6.06]], S2DAYS = {}, S2IMG = {}, S2STATE = { 'true': '', algae: '' };
var S2RAMP = ['#143073', '#2980b8', '#73c273', '#f5e342', '#ed801f', '#bd1a1f'];
function s2Days() { return S2DAYS[state.s2year]; }
function s2Wanted() { return state.base === 's2' || state.s2algae; }
function s2Day() { var d = s2Days(); if (!Array.isArray(d) || !d.length) return null; return d.filter(function (x) { return x.date === state.s2date; })[0] || null; }
function loadS2Days() {
var key = state.s2year; if (S2DAYS[key] || !window.fetch) return;
S2DAYS[key] = 'loading';
fetch('/api/sat?list=1' + (key ? '&year=' + key : '')).then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok || !j.days) { S2DAYS[key] = 'fail'; render(); return; }
S2DAYS[key] = j.days;
if (key === state.s2year && !state.s2date) { var clear = j.days.filter(function (x) { return x.cloud <= 20; })[0] || j.days[0]; state.s2date = clear ? clear.date : null; }
render();
}).catch(function () { S2DAYS[key] = 'fail'; render(); });
}
function s2Show(mode, want) {
var url = '/api/sat?date=' + state.s2date + '&mode=' + mode, img = S2IMG[mode];
if (!want || !state.s2date || !MAP) { if (img) showLayer(img, false); return; }
if (!img) {
img = S2IMG[mode] = L.imageOverlay(url, S2BOX, { pane: mode === 'algae' ? 's2a' : 's2', opacity: mode === 'algae' ? 0.85 : 1, interactive: false, attribution: 'Contains modified Copernicus Sentinel data, processed with Sentinel Hub' });
img.s2url = url; S2STATE[mode] = 'loading';
img.on('load', function () { S2STATE[mode] = 'ok'; $('mapcap').innerHTML = captionHtml(state.step); });
img.on('error', function () { S2STATE[mode] = 'fail'; $('mapcap').innerHTML = captionHtml(state.step); });
} else if (img.s2url !== url) { img.s2url = url; S2STATE[mode] = 'loading'; img.setUrl(url); }
showLayer(img, true);
}
function updateS2() {
if (s2Wanted() && !s2Days()) loadS2Days();
s2Show('true', state.base === 's2'); s2Show('algae', state.s2algae);
}
function s2Row() {
if (!s2Wanted()) return '';
var d = s2Days(), yr = new Date().getUTCFullYear(), years = [['', 'Last 12 months']];
for (var y = yr; y >= 2023; y--) years.push([String(y), String(y)]);
var h = '<div class="lrow"><span class="llab">Satellite day</span><select id="s2year" aria-label="Period">' + years.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === state.s2year ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
if (!d || d === 'loading') h += '<span class="small">Finding clear days.</span>';
else if (d === 'fail') h += '<span class="small">The satellite service is not answering right now.</span>';
else if (!d.length) h += '<span class="small">No clear days in this period.</span>';
else h += '<select id="s2date" aria-label="Day of the satellite picture">' + (state.s2date && !s2Day() ? '<option value="' + state.s2date + '" selected>' + fmtDate(state.s2date) + ' ' + state.s2date.slice(0, 4) + '</option>' : '') + d.map(function (x) { return '<option value="' + x.date + '"' + (x.date === state.s2date ? ' selected' : '') + '>' + fmtDate(x.date) + ' ' + x.date.slice(0, 4) + ' · ' + x.cloud + '% cloud</option>'; }).join('') + '</select>';
return h + '</div>';
}
function s2Caption(c) {
var day = s2Day(), when = state.s2date ? fmtDate(state.s2date) + ' ' + state.s2date.slice(0, 4) : '';
var note = function (m) { return S2STATE[m] === 'loading' ? ' Loading the picture, which can take ten seconds.' : S2STATE[m] === 'fail' ? ' The picture for this day could not be loaded.' : ''; };
if (state.base === 's2' && state.s2date) c.push('<span>Sentinel-2 photo taken ' + when + (day ? ', about ' + day.cloud + '% cloud across the wider area' : '') + '. Each dot is about 23 m.' + note('true') + '</span>');
if (state.s2algae && state.s2date) c.push('<span class="key">Algae index, ' + when + ': less ' + S2RAMP.map(function (x) { return '<span class="sw" style="background:' + x + '"></span>'; }).join('') + ' more</span><span class="key"><span class="sw" style="background:#dbdbdb;border:1px solid #9aa3a8"></span>Cloud</span><span>An index from the colour of the water, not a measurement, and not yet checked against water samples. Thick surface scum can be missed.' + note('algae') + '</span>');
}
/* ---------- layer controls and map caption ---------- */
function chip(attr, val, label, pressed, disabled) {
return '<button type="button" class="chip" id="chip_' + attr + '_' + val + '" data-' + attr + '="' + val + '" aria-pressed="' + !!pressed + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
}
function layersHtml() {
var O = state.on, missing = { basins: !LAYERS.basins, farms: !LAYERS.farms, algae: !LAYERS.algae, buoys: !LAYERS.buoys, works: !LAYERS.works, fields: !fieldsLayer, incidents: !LAYERS.incidents, status: !LAYERS.status, sources: !LAYERS.sources, srp: !LAYERS.srp, overflows: !LAYERS.overflows };
return '<div class="lrow"><span class="llab">View</span>' +
[['map', 'Map'], ['aerial', 'Sharp aerial'], ['s2', 'Satellite by date'], ['sat', 'Satellite 2024'], ['daily', 'Daily photo']].map(function (g) { return chip('base', g[0], g[1], state.base === g[0]); }).join('') +
(state.base === 'daily' ? '<input type="date" id="satDate" aria-label="Date of the daily photo" min="2000-03-01" max="' + YESTERDAY + '" value="' + state.satDate + '">' : '') + '</div>' + s2Row() +
'<div class="lrow"><span class="llab">Shade by</span>' +
[['none', 'Nothing'], ['sources', 'Likely sources'], ['cover', 'Land cover'], ['farms', 'Livestock'], ['basins', 'Basins'], ['status', 'Water status'], ['sup', 'Surface geology'], ['bed', 'Bedrock']].map(function (g) { return chip('shade', g[0], g[1], state.shade === g[0], missing[g[0]]); }).join('') + '</div>' +
'<div class="lrow"><span class="llab">Show</span>' +
[['zones', 'Bloom risk'], ['s2algae', 'Algae from space'], ['algae', 'Confirmed algae'], ['buoys', 'Buoys'], ['rivers', 'River loads'], ['srp', 'River phosphorus tests'], ['works', 'Treatment works'], ['overflows', 'Storm overflows'], ['incidents', 'Pollution incidents'], ['fields', 'Field risk'], ['stake', 'Places at stake']].map(function (g) { return g[0] === 's2algae' ? chip('s2', 'algae', g[1], state.s2algae) : chip('on', g[0], g[1], O[g[0]], missing[g[0]]); }).join('') + '</div>';
}
function captionHtml(s) {
var O = state.on, sh = state.shade, c = [];
var sw = function (col, dot) { return '<span class="sw' + (dot ? ' dot' : '') + '" style="background:' + col + '"></span>'; };
if (state.base === 'aerial') c.push('<span>Sharp aerial photos from Esri. Taken on different dates over several years, so they show the land, not today\'s water.</span>');
s2Caption(c);
if (state.base === 'sat') c.push('<span>Satellite: Sentinel-2 cloudless 2024, a cloud-free blend of a year of images. It is not today.</span>');
if (state.base === 'daily') c.push('<span>Daily photo for ' + fmtDate(state.satDate) + ' ' + state.satDate.slice(0, 4) + ', NASA Terra. Coarse, and cloud often hides the lough.</span>');
if (sh === 'sup' || sh === 'bed') c.push('<span>' + (sh === 'sup' ? 'Surface geology' : 'Bedrock') + ', 1:250,000. Contains Geological Survey of Northern Ireland materials © Crown Copyright.</span>');
if (sh === 'basins') c.push('<span class="key">Phosphorus per hectare a year: 0.8 kg ' + OCHRE.map(function (x) { return sw(x); }).join('') + ' 1.2 kg</span><span class="key">' + sw('#9aa3a8') + 'Drains elsewhere</span>');
if (sh === 'sources') c.push('<span class="key">Phosphorus measured in each basin\'s rivers: lowest ' + VIOLETS.map(function (x) { return sw(x); }).join('') + ' highest</span><span>Tap a basin to see its pressures.</span>');
if (sh === 'status') c.push('<span class="key">Water status 2018: ' + ['HIGH', 'GOOD', 'MODERATE', 'POOR', 'BAD'].map(function (k) { return sw(WFD[k][1]) + WFD[k][0]; }).join(' ') + '</span><span>Dashed outline: fails on phosphorus alone</span>');
if (O.srp && WATER && WATER.srp && WATER.srp.length) { var sb = srpBreaks(); c.push('<span class="key">Dissolved phosphorus in rivers, 2020 to 2024: under ' + sb[0].toFixed(2) + ' ' + VIOLETS.map(function (x) { return sw(x, true); }).join('') + ' over ' + sb[3].toFixed(2) + ' mg/l</span>'); }
if (O.overflows) c.push('<span class="key">' + sw('#bf3528', true) + 'Storm overflow, unsatisfactory</span><span class="key">' + sw('#4f6b7a', true) + 'Other storm overflow</span>');
if (sh === 'cover') c.push('<span>Land cover: Corine 2018, Copernicus. Yellow-green is pasture, pale yellow arable, red towns, blue-violet peat bog, green woodland.</span>');
if (O.incidents) c.push('<span class="key">Pollution incidents per square km, 2011 to 2024: 1 ' + REDS.map(function (x) { return sw(x); }).join('') + ' 16 or more</span>');
if (sh === 'farms' && LAND && LAND.farms) c.push('<span class="key">' + STOCK[state.stock][0] + ' per hectare farmed, 2019: fewest ' + BLUES.map(function (x) { return sw(x); }).join('') + ' most</span><span>Middle area: ' + farmBreaks()[1].toFixed(1) + ' to ' + farmBreaks()[2].toFixed(1) + ' per hectare</span>');
if (O.fields) c.push('<span class="key">Field risk: ' + [1, 2, 3].map(function (k) { return sw(RISK[k][1]) + RISK[k][0]; }).join(' ') + '</span>');
if (O.zones) c.push('<span class="key">Bloom risk ' + (s === 5 ? 'on day ' + (state.day + 1) : s === 6 ? 'at worst in 5 days' : 'today') + ': ' + sw('var(--low)') + 'L ' + sw('var(--med)') + 'M ' + sw('var(--high)') + 'H</span>');
if (O.algae) c.push('<span class="key">' + sw('#b0206a', true) + 'Confirmed algae, last 12 months</span>');
if (O.buoys) c.push('<span class="key">' + sw('#174a63') + 'B buoy</span>');
if (O.rivers) c.push('<span class="key">' + sw('#174a63', true) + 'Phosphorus by river, bigger dot is more</span>');
if (O.works) c.push('<span class="key">' + sw('#5b6770', true) + 'Treatment works</span>');
if (O.stake) c.push('<span class="key">' + sw('var(--high)') + 'Water intake</span><span class="key">' + sw('var(--med)') + 'Fishing</span><span class="key">' + sw('var(--accent)') + 'Recreation</span>');
if (!c.length) c.push('<span>Base map: OpenStreetMap. Pinch or use the buttons to zoom. Marker positions are approximate.</span>');
return c.join('');
}
/* ---------- render ---------- */
function render() {
var r = run(), s = state.step;
['A', 'B', 'C', 'L'].forEach(function (k) { $('scn' + k).setAttribute('aria-pressed', String(k === state.scn)); });
Array.prototype.forEach.call($('steps').children, function (b, i) {
if (i === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
});
var O = state.on, sh = state.shade;
showLayer(SATS.aerial, state.base === 'aerial'); updateS2();
showLayer(SATS.sat, state.base === 'sat'); showLayer(SATS.daily, state.base === 'daily');
showLayer(GEO.sup, sh === 'sup'); showLayer(GEO.bed, sh === 'bed');
showLayer(LAYERS.basins, sh === 'basins'); showLayer(LAYERS.farms, sh === 'farms'); showLayer(GEO.cover, sh === 'cover');
if (sh === 'farms' && LAYERS.farms) LAYERS.farms.setStyle(farmStyle);
showLayer(LAYERS.incidents, !!O.incidents);
if (LAYERS.sources) { LAYERS.sources.setStyle(sourceStyle); showLayer(LAYERS.sources, sh === 'sources'); }
if (MAP && LAYERS.sources && (sh === 'sources') !== wasSources) { wasSources = sh === 'sources'; MAP.closePopup(); MAP.fitBounds(wasSources ? LAYERS.sources.getBounds() : BOUNDS); }
showLayer(LAYERS.status, sh === 'status'); showLayer(LAYERS.failing, sh === 'status');
showLayer(LAYERS.srp, !!O.srp); showLayer(LAYERS.overflows, !!O.overflows);
updateFields();
showLayer(LAYERS.rivers, !!O.rivers); showLayer(LAYERS.works, !!O.works); showLayer(LAYERS.stake, !!O.stake);
showLayer(LAYERS.algae, !!O.algae); showLayer(LAYERS.buoys, !!O.buoys);
showLayer(LAYERS.zones, !!O.zones); showLayer(LAYERS.wind, !!O.zones && (s === 4 || s === 5));
if (O.zones) {
if (s === 5) { paintZones(r.outlook[state.day].zones.map(function (c) { return c.lv; })); setWind(r.outlook[state.day].wind); }
else if (s === 6) paintZones(ZONES.map(function (z, zi) { var m = 0; r.outlook.forEach(function (o) { m = Math.max(m, o.zones[zi].lv); }); return m; }));
else { paintZones(r.today.map(level)); setWind(r.todayW || r.wx[29]); }
}
$('layers').innerHTML = layersHtml();
$('mapcap').innerHTML = captionHtml(s);
$('panel').innerHTML = '<div><p class="stepno">Step ' + (s + 1) + ' of ' + STEPS.length + '</p><h2>' + (s === 4 && r.live ? 'The lough today' : STEPS[s]) + '</h2></div>' + sceneHtml(r) +
'<div class="nav"><button type="button" id="prevBtn" ' + (s === 0 ? 'disabled' : '') + '>Back</button><button type="button" class="next" id="nextBtn" ' + (s === STEPS.length - 1 ? 'disabled' : '') + '>' + (s === STEPS.length - 1 ? 'End' : 'Next: ' + STEPS[s + 1]) + '</button></div>';
}
function loadData() {
if (!window.fetch) return;
fetch('/api/lough').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok) return;
DATA = j; buildData(); render(); hotExtras();
}).catch(function () {});
}
function loadLand() {
if (!window.fetch) return;
fetch('/api/land').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok) return;
LAND = j; buildLand(); buildSources(); render(); hotExtras();
}).catch(function () {});
}
function loadWater() {
if (!window.fetch) return;
fetch('/api/water').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok) return;
WATER = j; buildWater(); render();
}).catch(function () {});
}
function loadSources() {
if (!window.fetch) return;
fetch('/api/sources').then(function (res) { return res.json(); }).then(function (j) {
if (!j || !j.ok || !j.basins || !j.basins.length) return;
/* The lough shore basin's outline includes the lough itself, so take the 383 square km of water off its area. */
j.basins.forEach(function (x) { if (x.name === 'Lough Neagh' && x.km2 > 600) x.km2 -= 383; });
SOURCES = j; if (!j.basins.some(function (x) { return x.name === state.basin; })) state.basin = j.basins[0].name;
buildSources(); render(); showView(); hotExtras();
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
preset();
document.addEventListener('click', function (e) {
var t = e.target.closest ? e.target.closest('button') : null;
if (!t) return;
if (t.dataset.invgo) { invGo(t.dataset.invgo); return; }
if (t.dataset.satgo) { satGo(t.dataset.satgo); return; }
if (t.dataset.saty) { satOff[t.dataset.saty] = !satOff[t.dataset.saty]; renderSat(); if ($(t.id)) $(t.id).focus({ preventScroll: true }); return; }
if (t.dataset.satm) { satMetric = t.dataset.satm; renderSat(); if ($(t.id)) $(t.id).focus({ preventScroll: true }); return; }
if (t.dataset.hotcat) { toggleHot(t.dataset.hotcat); if ($(t.id)) $(t.id).focus({ preventScroll: true }); return; }
if (t.dataset.hot) { if (t.dataset.hot === 'all') { if (HOTMAP) { HOTMAP.closePopup(); var pp = Object.keys(HOTPIN).map(function (k) { return [HOTPIN[k].it.lat, HOTPIN[k].it.lon]; }); HOTMAP.fitBounds(L.latLngBounds(pp).pad(0.06)); } } else focusHot(t.dataset.hot); return; }
if (t.dataset.scn) { state.scn = t.dataset.scn; state.day = 0; if (state.step < 4) state.step = 4; preset(); }
else if (t.dataset.geo) state.shade = t.dataset.geo === 'off' ? 'none' : t.dataset.geo;
else if (t.dataset.base) state.base = t.dataset.base;
else if (t.dataset.s2) state.s2algae = !state.s2algae;
else if (t.dataset.shade) state.shade = t.dataset.shade;
else if (t.dataset.on) state.on[t.dataset.on] = !state.on[t.dataset.on];
else if (t.dataset.land) setLand(t.dataset.land);
else if (t.dataset.stock) state.stock = t.dataset.stock;
else if (t.dataset.basin) state.basin = t.dataset.basin;
else if (t.dataset.goto) { if (MAP) { if (t.dataset.goto === 'all') MAP.fitBounds(BOUNDS); else MAP.setView([GOTO[+t.dataset.goto][1], GOTO[+t.dataset.goto][2]], 13.5); } return; }
else if (t.dataset.step != null) { state.step = +t.dataset.step; preset(); }
else if (t.dataset.day != null) state.day = +t.dataset.day;
else if (t.id === 'prevBtn') { state.step = Math.max(0, state.step - 1); preset(); }
else if (t.id === 'nextBtn') { state.step = Math.min(STEPS.length - 1, state.step + 1); preset(); }
else return;
var id = t.id; render();
if (id && $(id) && !$(id).disabled) $(id).focus({ preventScroll: true });
});
document.addEventListener('change', function (e) {
if (e.target && e.target.id === 'rivPick' && /^[A-Za-z0-9]{8,30}$/.test(e.target.value)) { RIV.id = e.target.value; renderRiv(); if ($('rivPick')) $('rivPick').focus({ preventScroll: true }); return; }
if (e.target && (e.target.id === 'invDate' || e.target.id === 'invPick') && /^20\d\d-\d\d-\d\d$/.test(e.target.value)) { INV.date = e.target.value; renderInv(); return; }
if (e.target && e.target.id === 's2year' && /^(20\d\d)?$/.test(e.target.value)) { state.s2year = e.target.value; state.s2date = null; var known = s2Days(); if (Array.isArray(known) && known.length) state.s2date = (known.filter(function (x) { return x.cloud <= 20; })[0] || known[0]).date; render(); if ($('s2year')) $('s2year').focus({ preventScroll: true }); return; }
if (e.target && e.target.id === 's2date' && /^20\d\d-\d\d-\d\d$/.test(e.target.value)) { state.s2date = e.target.value; render(); if ($('s2date')) $('s2date').focus({ preventScroll: true }); return; }
if (e.target && e.target.id === 'satDate' && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value <= YESTERDAY) {
state.satDate = e.target.value;
if (SATS.daily) { SATS.daily.options.date = state.satDate; SATS.daily.redraw(); }
render();
if ($('satDate')) $('satDate').focus({ preventScroll: true });
}
});
render();
window.addEventListener('hashchange', showView);
showView();
loadLive();
loadData();
loadLand();
loadWater();
loadSources();
loadHot();
}
start();
})();
