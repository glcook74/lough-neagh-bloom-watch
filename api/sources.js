/* Pressure profile for each river basin that flows into Lough Neagh.
   Every dataset is matched to the same basin outlines (DAERA Local Management Areas). */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var INFLOW = ['Ballinderry', 'Braid and Main', 'Lough Neagh', 'Moyola', 'Six Mile Water', 'Upper Bann', 'River Blackwater'];
/* The river test data names its basins differently from the basin outlines. */
var TEST_BASIN = { 'Main': 'Braid and Main', 'Six Mile Water': 'Six Mile Water', 'Blackwater': 'River Blackwater', 'Ballinderry': 'Ballinderry', 'Moyola': 'Moyola', 'Upper Bann': 'Upper Bann', 'Lough Neagh & Peripherals': 'Lough Neagh', 'Crumlin': 'Lough Neagh', 'Glenavy': 'Lough Neagh' };
var SRP = ORG + '/River_Water_Quality_Monitoring_1990_to_2024_Soluble_Reactive_Phosphorus_SRP/FeatureServer/0/query';

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
async function riverTests() {
  var D = await dateStyle();
  var avg = encodeURIComponent(JSON.stringify([{ statisticType: 'avg', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'mean' }, { statisticType: 'count', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'n' }]));
  var sane = ' AND P_SOL__mg_l_ >= 0 AND P_SOL__mg_l_ < 5';
  var got = await Promise.all([
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2020-01-01') + sane) + '&groupByFieldsForStatistics=PrimaryBasin,StationCode&outStatistics=' + avg + '&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2015-01-01') + ' AND Date < ' + D('2020-01-01') + sane) + '&groupByFieldsForStatistics=PrimaryBasin,StationCode&outStatistics=' + avg + '&f=json')
  ]);
  var before = {}, out = {};
  (got[1].features || []).forEach(function (f) { if (f.attributes.n >= 6) before[f.attributes.StationCode] = f.attributes.mean; });
  (got[0].features || []).forEach(function (f) {
    var a = f.attributes, b = TEST_BASIN[a.PrimaryBasin];
    if (!b || a.n < 6 || a.mean == null) return;
    var o = out[b] = out[b] || { sum: 0, n: 0, nowBoth: 0, thenBoth: 0, both: 0 };
    o.sum += a.mean; o.n++;
    if (before[a.StationCode] != null) { o.nowBoth += a.mean; o.thenBoth += before[a.StationCode]; o.both++; }
  });
  return out;
}

module.exports = async function (req, res) {
  try {
    var names = INFLOW.map(function (n) { return "'" + n + "'"; }).join(',');
    var got = await Promise.all([
      getJson(ORG + '/LocalManagementAreas/FeatureServer/0/query?where=' + encodeURIComponent('NAME IN (' + names + ')') + '&outFields=NAME,Shape__Area&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.002&f=json'),
      getJson(ORG + '/FarmCensusDistrictElectoralArea2019/FeatureServer/0/query?where=1%3D1&outFields=DEAName,TotalAreaFarmedInHa,TotalNumberofCattle,TotalNumberofsheep,TotalNumberOfPigs,TotalNumberOfPoultry000&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.003&f=json'),
      paged(ORG + '/NIW_Predicted_Overflow_Assets_Data_May24/FeatureServer/32/query?where=1%3D1&outFields=Predicted_Spill_Frequency___Yea,Predicted_Spill_Volume___Year__,Storm_Overflow_Classification&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 3),
      paged(ORG + '/NIW_Waste_water_Treatment_Works_Asssets_May_2024/FeatureServer/30/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 2),
      paged(ORG + '/Pollution_Incidents_2011_to_2024/FeatureServer/0/query?where=totals%3E0&outFields=totals,farm,niw_ltd,domestic,industry,y2020,y2021,y2022,y2023,y2024&returnGeometry=true&outSR=4326&geometryPrecision=3&f=json', 4),
      riverTests().catch(function (e) { console.warn('River tests failed:', String(e)); return {}; })
    ]);
    var basins = (got[0].features || []).map(shape), deas = (got[1].features || []).map(shape);
    if (!basins.length) throw new Error('no basins');
    var out = basins.map(function (b) {
      return { name: b.a.NAME, km2: Math.round(b.a.Shape__Area / 1e6), cattle: 0, sheep: 0, pigs: 0, poultry: 0, farmedHa: 0,
        overflows: 0, spills: 0, spillVol: 0, unsat: 0, works: 0, incidents: 0, incFarm: 0, incSewage: 0, incIndustry: 0, incRecent: 0,
        fieldHa: { low: 0, medium: 0, high: 0 }, tests: null };
    });

    /* Livestock: share each council area's animals between basins by how much of the area lies in each. */
    var seen = deas.map(function () { return 0; }), share = deas.map(function () { return basins.map(function () { return 0; }); });
    for (var x = -7.6; x <= -5.8; x += 0.02) for (var y = 54.05; y <= 55.15; y += 0.012) {
      var d = which(deas, x, y); if (d < 0) continue;
      seen[d]++;
      var b = which(basins, x, y); if (b >= 0) share[d][b]++;
    }
    deas.forEach(function (dd, d) {
      if (!seen[d]) return;
      basins.forEach(function (bb, b) {
        var k = share[d][b] / seen[d]; if (!k) return;
        out[b].cattle += (dd.a.TotalNumberofCattle || 0) * k; out[b].sheep += (dd.a.TotalNumberofsheep || 0) * k;
        out[b].pigs += (dd.a.TotalNumberOfPigs || 0) * k; out[b].poultry += (dd.a.TotalNumberOfPoultry000 || 0) * 1000 * k;
        out[b].farmedHa += (dd.a.TotalAreaFarmedInHa || 0) * k;
      });
    });
    got[2].forEach(function (f) {
      if (!f.geometry) return; var b = which(basins, f.geometry.x, f.geometry.y); if (b < 0) return;
      out[b].overflows++; out[b].spills += f.attributes.Predicted_Spill_Frequency___Yea || 0; out[b].spillVol += f.attributes.Predicted_Spill_Volume___Year__ || 0;
      if (/unsat/i.test(f.attributes.Storm_Overflow_Classification || '')) out[b].unsat++;
    });
    got[3].forEach(function (f) { if (!f.geometry) return; var b = which(basins, f.geometry.x, f.geometry.y); if (b >= 0) out[b].works++; });
    got[4].forEach(function (f) {
      var r = f.geometry && f.geometry.rings && f.geometry.rings[0]; if (!r) return;
      var cx = 0, cy = 0; r.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= r.length; cy /= r.length;
      var b = which(basins, cx, cy); if (b < 0) return;
      var a = f.attributes;
      out[b].incidents += a.totals || 0; out[b].incFarm += a.farm || 0; out[b].incSewage += (a.niw_ltd || 0) + (a.domestic || 0); out[b].incIndustry += a.industry || 0;
      out[b].incRecent += (a.y2020 || 0) + (a.y2021 || 0) + (a.y2022 || 0) + (a.y2023 || 0) + (a.y2024 || 0);
    });
    /* Field risk: ask the service to total the scored parcels inside each basin outline. */
    var stats = JSON.stringify([{ statisticType: 'sum', onStatisticField: 'shape_star', outStatisticFieldName: 'area' }]);
    await Promise.all(basins.map(function (bb, b) {
      var body = 'where=' + encodeURIComponent('1=1') + '&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&groupByFieldsForStatistics=ruleid&f=json' +
        '&outStatistics=' + encodeURIComponent(stats) + '&geometry=' + encodeURIComponent(JSON.stringify({ rings: bb.rings, spatialReference: { wkid: 4326 } }));
      return getJson(ORG + '/Agricultural_Critical_Risk_Areas/FeatureServer/0/query', body).then(function (j) {
        (j.features || []).forEach(function (f) { var k = { 1: 'low', 2: 'medium', 3: 'high' }[f.attributes.ruleid]; if (k) out[b].fieldHa[k] = Math.round((f.attributes.area || 0) / 10000); });
      }).catch(function (e) { console.warn('Field risk failed for', bb.a.NAME, String(e)); out[b].fieldHa = null; });
    }));
    out.forEach(function (o) {
      ['cattle', 'sheep', 'pigs', 'poultry', 'farmedHa'].forEach(function (k) { o[k] = Math.round(o[k]); });
      var t = got[5][o.name];
      if (t && t.n) o.tests = { sites: t.n, mean: +(t.sum / t.n).toFixed(3), sitesBoth: t.both, nowBoth: t.both ? +(t.nowBoth / t.both).toFixed(3) : null, thenBoth: t.both ? +(t.thenBoth / t.both).toFixed(3) : null };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ ok: true, source: 'DAERA open data (ArcGIS), Open Government Licence v3.0', councilAreas: deas.length, basins: out });
  } catch (e) {
    console.warn('Sources failed:', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
