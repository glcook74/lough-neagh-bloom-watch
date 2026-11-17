/* Open DAERA data for Lough Neagh: monitoring buoys, confirmed blue-green algae reports
   and NI Water treatment works. All are published under the Open Government Licence. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var BUOYS = [
  ['Reas_Wood_AquaTROLL_Metrics_View_', "Rea's Wood"],
  ['Toome_AquaTROLL_Metrics_View', 'Toome'],
  ['Washing_Bay_AquaTROLL_Metrics_View', 'Washing Bay']
];
var NEAR = '-6.75,54.44,-6.10,54.80';   /* box around the lough: west, south, east, north */
var BOX = '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&outSR=4326&f=json';

async function getJson(url) {
  var r = await fetch(url);
  if (!r.ok) throw new Error('status ' + r.status);
  var j = await r.json();
  if (j.error) throw new Error(j.error.message || 'service error');
  return j;
}
function r4(v) { return Math.round(v * 10000) / 10000; }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

async function buoy(svc, name) {
  var base = ORG + '/' + svc + '/FeatureServer';
  var where = encodeURIComponent("Metric_Type = 'BGA_PC_Fluorescence' OR Metric_Type LIKE '%emp%'");
  var got = await Promise.all([
    getJson(base + '/0/query?where=1%3D1&outFields=Location&returnGeometry=true&outSR=4326&f=json'),
    getJson(base + '/1/query?where=' + where + '&outFields=Metric_Value,Metric_Type,Date&orderByFields=Date%20DESC&resultRecordCount=2000&f=json')
  ]);
  var g = got[0].features && got[0].features[0] && got[0].features[0].geometry;
  var rows = (got[1].features || []).map(function (f) { return f.attributes; });
  var byDay = {}, latest = { temp: null, pc: null, at: null };
  rows.forEach(function (a) {
    var v = a.Metric_Value, kind = a.Metric_Type === 'BGA_PC_Fluorescence' ? 'pc' : 'temp';
    if (typeof v !== 'number' || !isFinite(v) || !a.Date) return;
    if (kind === 'temp' && (v < -2 || v > 40)) return;
    if (latest[kind] == null) { latest[kind] = v; if (!latest.at || a.Date > latest.at) latest.at = a.Date; }
    var d = new Date(a.Date).toISOString().slice(0, 10);
    (byDay[d] = byDay[d] || { temp: [], pc: [] })[kind].push(v);
  });
  var days = Object.keys(byDay).sort().slice(-14).map(function (d) {
    var t = mean(byDay[d].temp), p = mean(byDay[d].pc);
    return { date: d, temp: t == null ? null : +t.toFixed(1), pc: p == null ? null : +p.toFixed(2) };
  });
  if (!latest.at) return null;
  return {
    name: name, lat: g ? r4(g.y) : null, lon: g ? r4(g.x) : null,
    at: new Date(latest.at).toISOString(),
    temp: latest.temp == null ? null : +latest.temp.toFixed(1),
    pc: latest.pc == null ? null : +latest.pc.toFixed(2),
    days: days
  };
}

async function confirmedAlgae() {
  var j = await getJson(ORG + '/BGA_Confirmed_Locations_PublicView/FeatureServer/0/query?where=1%3D1&geometry=' + NEAR + BOX +
    '&outFields=SiteName,DateLatestConfirmedReport&orderByFields=DateLatestConfirmedReport%20DESC&resultRecordCount=500');
  return (j.features || []).filter(function (f) { return f.geometry && f.attributes.DateLatestConfirmedReport; }).map(function (f) {
    return { name: f.attributes.SiteName, date: new Date(f.attributes.DateLatestConfirmedReport).toISOString().slice(0, 10), lat: r4(f.geometry.y), lon: r4(f.geometry.x) };
  });
}

async function treatmentWorks() {
  var j = await getJson(ORG + '/NIW_Waste_water_Treatment_Works_Asssets_May_2024/FeatureServer/30/query?where=1%3D1&geometry=-6.80,54.42,-6.05,54.82' + BOX +
    '&outFields=Name,Receiving_Waterbody_Name&resultRecordCount=500');
  return (j.features || []).filter(function (f) { return f.geometry; }).map(function (f) {
    return { name: f.attributes.Name, into: f.attributes.Receiving_Waterbody_Name, lat: r4(f.geometry.y), lon: r4(f.geometry.x) };
  });
}

module.exports = async function (req, res) {
  var quiet = function (p) { return p.catch(function (e) { console.warn('Lough data source failed:', String(e)); return null; }); };
  var parts = await Promise.all([
    Promise.all(BUOYS.map(function (b) { return quiet(buoy(b[0], b[1])); })),
    quiet(confirmedAlgae()),
    quiet(treatmentWorks())
  ]);
  var buoys = parts[0].filter(Boolean);
  var ok = buoys.length > 0 || !!parts[1] || !!parts[2];
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=10800, stale-while-revalidate=21600' : 'public, s-maxage=120');
  res.status(ok ? 200 : 502).json({
    ok: ok,
    source: 'DAERA open data (ArcGIS), Open Government Licence v3.0. Buoy readings are provisional and not validated.',
    fetchedAt: new Date().toISOString(),
    buoys: buoys, algae: parts[1], works: parts[2]
  });
};
