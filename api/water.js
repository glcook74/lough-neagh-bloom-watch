/* Measured water quality around Lough Neagh: river phosphorus tests, NI Water storm overflows
   and DAERA's water body status. DAERA open data, Open Government Licence. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var NEAR = '&geometry=-6.75,54.44,-6.10,54.80&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects';
var SRP = ORG + '/River_Water_Quality_Monitoring_1990_to_2024_Soluble_Reactive_Phosphorus_SRP/FeatureServer/0/query';

async function getJson(url) {
  var r = await fetch(url);
  if (!r.ok) throw new Error('status ' + r.status);
  var j = await r.json();
  if (j.error) throw new Error(j.error.message || 'service error');
  return j;
}
function r4(v) { return Math.round(v * 10000) / 10000; }

/* The date column is date-only. Find which way of writing a date the service accepts. */
var DATE_STYLES = [
  function (d) { return "DATE '" + d + "'"; },
  function (d) { return "'" + d + "'"; },
  function (d) { return "TIMESTAMP '" + d + " 00:00:00'"; }
];
async function dateStyle() {
  for (var i = 0; i < DATE_STYLES.length; i++) {
    try {
      await getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + DATE_STYLES[i]('2024-06-01')) + '&returnCountOnly=true&f=json');
      return DATE_STYLES[i];
    } catch (e) { /* try the next style */ }
  }
  throw new Error('no date style accepted');
}

async function riverPhosphorus() {
  var D = await dateStyle();
  var avg = encodeURIComponent(JSON.stringify([
    { statisticType: 'avg', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'mean' },
    { statisticType: 'count', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'n' }
  ]));
  /* Readings of 5 mg/l or more are left out: DAERA warns the raw data holds errors far above real values. */
  var sane = ' AND P_SOL__mg_l_ >= 0 AND P_SOL__mg_l_ < 5';
  var got = await Promise.all([
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2020-01-01') + sane) + NEAR + '&groupByFieldsForStatistics=StationCode,Location,PrimaryBasin&outStatistics=' + avg + '&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2015-01-01') + ' AND Date < ' + D('2020-01-01') + sane) + NEAR + '&groupByFieldsForStatistics=StationCode&outStatistics=' + avg + '&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2023-01-01')) + NEAR + '&outFields=StationCode&returnGeometry=true&outSR=4326&geometryPrecision=4&resultRecordCount=2000&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2020-01-01') + ' AND Date < ' + D('2023-01-01')) + NEAR + '&outFields=StationCode&returnGeometry=true&outSR=4326&geometryPrecision=4&resultRecordCount=2000&f=json')
  ]);
  var where = {}, before = {};
  [got[3], got[2]].forEach(function (g) { (g.features || []).forEach(function (f) { if (f.geometry) where[f.attributes.StationCode] = f.geometry; }); });
  (got[1].features || []).forEach(function (f) { before[f.attributes.StationCode] = f.attributes.mean; });
  return (got[0].features || []).map(function (f) {
    var a = f.attributes, g = where[a.StationCode];
    if (!g || a.mean == null || a.n < 6) return null;
    return {
      code: a.StationCode, name: a.Location, basin: a.PrimaryBasin, lat: r4(g.y), lon: r4(g.x),
      mean: +a.mean.toFixed(3), n: a.n, prev: before[a.StationCode] == null ? null : +before[a.StationCode].toFixed(3)
    };
  }).filter(Boolean);
}

async function overflows() {
  var f = 'Name,Predicted_Spill_Frequency___Yea,Predicted_Spill_Volume___Year__,Storm_Overflow_Classification,Receiving_Waterbody_Name,Monitored';
  var j = await getJson(ORG + '/NIW_Predicted_Overflow_Assets_Data_May24/FeatureServer/32/query?where=1%3D1' + NEAR + '&outFields=' + f + '&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=json');
  return (j.features || []).filter(function (x) { return x.geometry; }).map(function (x) {
    var a = x.attributes;
    return { name: a.Name, spills: a.Predicted_Spill_Frequency___Yea || 0, vol: a.Predicted_Spill_Volume___Year__ || 0, cls: a.Storm_Overflow_Classification || '', into: a.Receiving_Waterbody_Name || '', mon: a.Monitored || '', lat: r4(x.geometry.y), lon: r4(x.geometry.x) };
  });
}
var SHAPE = '&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.0015&f=geojson';
function status() {
  return getJson(ORG + '/Surface_Water_Body_2018_Status/FeatureServer/0/query?where=1%3D1' + NEAR + '&outFields=namespace,spZoneType,F2018_statu' + SHAPE);
}
function failing() {
  return getJson(ORG + '/Areas_Failing_for_Phosphorus_Only/FeatureServer/0/query?where=1%3D1' + NEAR + '&outFields=NAME,SW_STATUS,Failing_el' + SHAPE);
}

module.exports = async function (req, res) {
  var quiet = function (p) { return p.catch(function (e) { console.warn('Water data source failed:', String(e)); return null; }); };
  var parts = await Promise.all([quiet(riverPhosphorus()), quiet(overflows()), quiet(status()), quiet(failing())]);
  var ok = parts.some(Boolean);
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=120');
  if (req.query && req.query.summary) {
    res.status(200).json({
      ok: ok,
      srp: parts[0] && { sites: parts[0].length, first: parts[0][0], basins: Array.from(new Set(parts[0].map(function (x) { return x.basin; }))) },
      overflows: parts[1] && { n: parts[1].length, classes: Array.from(new Set(parts[1].map(function (x) { return x.cls; }))), monitored: Array.from(new Set(parts[1].map(function (x) { return x.mon; }))), first: parts[1][0] },
      status: parts[2] && { n: parts[2].features.length, values: Array.from(new Set(parts[2].features.map(function (f) { return f.properties.F2018_statu; }))), types: Array.from(new Set(parts[2].features.map(function (f) { return f.properties.spZoneType; }))) },
      failing: parts[3] && parts[3].features.map(function (f) { return f.properties; }),
      bytes: JSON.stringify(parts).length
    });
    return;
  }
  res.status(ok ? 200 : 502).json({
    ok: ok, source: 'DAERA open data (ArcGIS), Open Government Licence v3.0',
    srp: parts[0], overflows: parts[1], status: parts[2], failing: parts[3]
  });
};
