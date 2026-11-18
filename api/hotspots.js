/* The specific places the data flags: river test sites with the most phosphorus, sites where it is
   rising, the storm overflows predicted to spill most, and the squares with most pollution incidents.
   Limited to the seven river basins that flow into Lough Neagh. DAERA open data. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var INFLOW = ['Ballinderry', 'Braid and Main', 'Lough Neagh', 'Moyola', 'Six Mile Water', 'Upper Bann', 'River Blackwater'];
var TEST_BASIN = { 'Main': 'Braid and Main', 'Six Mile Water': 'Six Mile Water', 'Blackwater': 'River Blackwater', 'Ballinderry': 'Ballinderry', 'Moyola': 'Moyola', 'Upper Bann': 'Upper Bann', 'Lough Neagh & Peripherals': 'Lough Neagh', 'Crumlin': 'Lough Neagh', 'Glenavy': 'Lough Neagh' };
var SRP = ORG + '/River_Water_Quality_Monitoring_1990_to_2024_Soluble_Reactive_Phosphorus_SRP/FeatureServer/0/query';
function r4(v) { return Math.round(v * 10000) / 10000; }

async function getJson(url, body) {
  var r = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body } : undefined);
  if (!r.ok) throw new Error('status ' + r.status);
  var j = await r.json();
  if (j.error) throw new Error(j.error.message || 'service error');
  return j;
}
async function paged(url, pages) {
  var out = [];
  for (var i = 0; i < pages; i++) {
    var j = await getJson(url + '&orderByFields=OBJECTID&resultRecordCount=2000&resultOffset=' + (i * 2000));
    out = out.concat(j.features || []);
    if (!j.exceededTransferLimit) break;
  }
  return out;
}
/* Shapes: rings of [lon, lat]. Even-odd test, so holes and several parts are handled. */
function shape(f) {
  var rings = f.geometry.rings, x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  rings.forEach(function (r) { r.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
  return { a: f.attributes, rings: rings, box: [x0, y0, x1, y1] };
}
function inside(s, x, y) {
  if (x < s.box[0] || x > s.box[2] || y < s.box[1] || y > s.box[3]) return false;
  var hit = false;
  for (var k = 0; k < s.rings.length; k++) {
    var r = s.rings[k];
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) hit = !hit;
    }
  }
  return hit;
}
function which(shapes, x, y) { for (var i = 0; i < shapes.length; i++) if (inside(shapes[i], x, y)) return i; return -1; }

var DATE_STYLES = [function (d) { return "DATE '" + d + "'"; }, function (d) { return "'" + d + "'"; }, function (d) { return "TIMESTAMP '" + d + " 00:00:00'"; }];
async function dateStyle() {
  for (var i = 0; i < DATE_STYLES.length; i++) {
    try { await getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + DATE_STYLES[i]('2024-06-01')) + '&returnCountOnly=true&f=json'); return DATE_STYLES[i]; } catch (e) { /* next */ }
  }
  throw new Error('no date style accepted');
}
async function riverSites() {
  var D = await dateStyle();
  var avg = encodeURIComponent(JSON.stringify([{ statisticType: 'avg', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'mean' }, { statisticType: 'count', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'n' }]));
  var sane = ' AND P_SOL__mg_l_ >= 0 AND P_SOL__mg_l_ < 5';
  var inBasins = ' AND PrimaryBasin IN (' + Object.keys(TEST_BASIN).map(function (k) { return "'" + k + "'"; }).join(',') + ')';
  var got = await Promise.all([
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2020-01-01') + sane + inBasins) + '&groupByFieldsForStatistics=PrimaryBasin,StationCode,Location&outStatistics=' + avg + '&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2015-01-01') + ' AND Date < ' + D('2020-01-01') + sane + inBasins) + '&groupByFieldsForStatistics=StationCode&outStatistics=' + avg + '&f=json'),
    paged(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2023-01-01') + inBasins) + '&outFields=StationCode&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 6)
  ]);
  var where = {}, before = {};
  got[2].forEach(function (f) { if (f.geometry) where[f.attributes.StationCode] = f.geometry; });
  (got[1].features || []).forEach(function (f) { if (f.attributes.n >= 6) before[f.attributes.StationCode] = f.attributes.mean; });
  return (got[0].features || []).map(function (f) {
    var a = f.attributes, g = where[a.StationCode];
    if (!g || a.mean == null || a.n < 6) return null;
    return { code: a.StationCode, name: a.Location, basin: TEST_BASIN[a.PrimaryBasin], lat: r4(g.y), lon: r4(g.x), mean: +a.mean.toFixed(3), n: a.n, prev: before[a.StationCode] == null ? null : +before[a.StationCode].toFixed(3) };
  }).filter(Boolean);
}

module.exports = async function (req, res) {
  try {
    var names = INFLOW.map(function (n) { return "'" + n + "'"; }).join(',');
    var got = await Promise.all([
      getJson(ORG + '/LocalManagementAreas/FeatureServer/0/query?where=' + encodeURIComponent('NAME IN (' + names + ')') + '&outFields=NAME&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.002&f=json'),
      paged(ORG + '/NIW_Predicted_Overflow_Assets_Data_May24/FeatureServer/32/query?where=1%3D1&outFields=Name,Predicted_Spill_Frequency___Yea,Predicted_Spill_Volume___Year__,Storm_Overflow_Classification,Receiving_Waterbody_Name&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 3),
      paged(ORG + '/Pollution_Incidents_2011_to_2024/FeatureServer/0/query?where=totals%3E%3D5&outFields=totals,farm,niw_ltd,domestic,industry,high,y2020,y2021,y2022,y2023,y2024&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 3),
      riverSites().catch(function (e) { console.warn('River sites failed:', String(e)); return null; })
    ]);
    var basins = (got[0].features || []).map(shape);
    if (!basins.length) throw new Error('no basins');
    var basinOf = function (x, y) { var b = which(basins, x, y); return b < 0 ? null : basins[b].a.NAME; };

    var overflows = got[1].map(function (f) {
      if (!f.geometry) return null; var bn = basinOf(f.geometry.x, f.geometry.y); if (!bn) return null; var a = f.attributes;
      return { name: a.Name, basin: bn, lat: r4(f.geometry.y), lon: r4(f.geometry.x), spills: a.Predicted_Spill_Frequency___Yea || 0, vol: a.Predicted_Spill_Volume___Year__ || 0, cls: a.Storm_Overflow_Classification || '', into: a.Receiving_Waterbody_Name || '' };
    }).filter(Boolean);
    var squares = got[2].map(function (f) {
      var r = f.geometry && f.geometry.rings && f.geometry.rings[0]; if (!r) return null;
      var xs = r.map(function (p) { return p[0]; }), ys = r.map(function (p) { return p[1]; });
      var b = [Math.min.apply(null, ys), Math.min.apply(null, xs), Math.max.apply(null, ys), Math.max.apply(null, xs)];
      var bn = basinOf((b[1] + b[3]) / 2, (b[0] + b[2]) / 2); if (!bn) return null; var a = f.attributes;
      return { b: b, basin: bn, lat: r4((b[0] + b[2]) / 2), lon: r4((b[1] + b[3]) / 2), t: a.totals || 0, farm: a.farm || 0, sewage: (a.niw_ltd || 0) + (a.domestic || 0), industry: a.industry || 0, high: a.high || 0,
        recent: (a.y2020 || 0) + (a.y2021 || 0) + (a.y2022 || 0) + (a.y2023 || 0) + (a.y2024 || 0) };
    }).filter(Boolean);
    var sites = got[3] || [];
    var risers = sites.filter(function (s) { return s.prev != null && s.mean - s.prev > 0.005; }).sort(function (p, q) { return (q.mean - q.prev) - (p.mean - p.prev); });
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
      ok: true, source: 'DAERA open data (ArcGIS), Open Government Licence v3.0',
      counts: { sites: sites.length, overflows: overflows.length, squares: squares.length, sitesWithHistory: sites.filter(function (s) { return s.prev != null; }).length },
      sites: sites.slice().sort(function (p, q) { return q.mean - p.mean; }).slice(0, 10),
      risers: risers.slice(0, 6),
      overflows: overflows.sort(function (p, q) { return q.vol - p.vol; }).slice(0, 10),
      squares: squares.sort(function (p, q) { return q.t - p.t; }).slice(0, 10)
    });
  } catch (e) {
    console.warn('Hotspots failed:', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
