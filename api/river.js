/* One river at a time. ?list=1 gives every river water body in the Lough Neagh catchment with its
   phosphorus test results. ?id=<water body id> gives everything DAERA's open data holds for that river's
   own catchment: tests through the years and seasons, sewage works, storm overflows, pollution incidents,
   field risk scores, poultry houses and local farm census figures. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var INFLOW = ['Ballinderry', 'Braid and Main', 'Lough Neagh', 'Moyola', 'Six Mile Water', 'Upper Bann', 'River Blackwater'];
var SRP = ORG + '/River_Water_Quality_Monitoring_1990_to_2024_Soluble_Reactive_Phosphorus_SRP/FeatureServer/0/query';
var WB = ORG + '/Surface_Water_Body_2018_Status/FeatureServer/0/query';
function r4(v) { return Math.round(v * 10000) / 10000; }
function r3(v) { return v == null ? null : Math.round(v * 1000) / 1000; }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
function poly(rings) { return 'geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&geometry=' + encodeURIComponent(JSON.stringify({ rings: rings, spatialReference: { wkid: 4326 } })); }

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

async function list(res) {
  var D = await dateStyle(), names = INFLOW.map(function (n) { return "'" + n + "'"; }).join(',');
  var avg = encodeURIComponent(JSON.stringify([{ statisticType: 'avg', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'mean' }, { statisticType: 'count', onStatisticField: 'P_SOL__mg_l_', outStatisticFieldName: 'n' }]));
  var got = await Promise.all([
    getJson(ORG + '/LocalManagementAreas/FeatureServer/0/query?where=' + encodeURIComponent('NAME IN (' + names + ')') + '&outFields=NAME&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.002&f=json'),
    getJson(WB + '?where=' + encodeURIComponent("spZoneType = 'riverWaterBody'") + '&geometry=-7.4,54.1,-5.8,55.0&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=localId,namespace,F2018_statu,Shape__Area&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.001&resultRecordCount=1000&f=json'),
    getJson(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2020-01-01') + ' AND P_SOL__mg_l_ >= 0 AND P_SOL__mg_l_ < 5') + '&groupByFieldsForStatistics=StationCode&outStatistics=' + avg + '&f=json'),
    paged(SRP + '?where=' + encodeURIComponent('Date >= ' + D('2023-01-01')) + '&geometry=-7.4,54.1,-5.8,55.0&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=StationCode&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 8)
  ]);
  var basins = (got[0].features || []).map(shape), bodies = (got[1].features || []).filter(function (f) { return f.geometry && f.geometry.rings; }).map(shape);
  var means = {}; (got[2].features || []).forEach(function (f) { if (f.attributes.n >= 6 && f.attributes.mean != null) means[f.attributes.StationCode] = f.attributes.mean; });
  var seen = {}, per = bodies.map(function () { return []; });
  got[3].forEach(function (f) { var c = f.attributes.StationCode; if (seen[c] || !f.geometry || means[c] == null) return; seen[c] = 1; var k = which(bodies, f.geometry.x, f.geometry.y); if (k >= 0) per[k].push(means[c]); });
  var out = [];
  bodies.forEach(function (b, k) {
    var cx = (b.box[0] + b.box[2]) / 2, cy = (b.box[1] + b.box[3]) / 2, r0 = b.rings[0], px = 0, py = 0; r0.forEach(function (p) { px += p[0] / r0.length; py += p[1] / r0.length; });
    var bn = which(basins, px, py); if (bn < 0) bn = which(basins, cx, cy); if (bn < 0) return;
    out.push({ id: b.a.localId, name: b.a.namespace, basin: basins[bn].a.NAME, status: b.a.F2018_statu, km2: Math.round((b.a.Shape__Area || 0) / 1e5) / 10, sites: per[k].length, max: per[k].length ? r3(Math.max.apply(null, per[k])) : null });
  });
  out.sort(function (a, b) { return (b.max == null ? -1 : b.max) - (a.max == null ? -1 : a.max) || a.name.localeCompare(b.name); });
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({ ok: true, rivers: out });
}
/* Average of another test (ammonia, oxygen demand) at the same sites since 2020. The value field differs by dataset, so find it. */
async function otherTest(service, codes, D) {
  var base = ORG + '/' + service + '/FeatureServer/0', info = await getJson(base + '?f=json');
  var fld = (info.fields || []).filter(function (f) { return f.type === 'esriFieldTypeDouble'; })[0]; if (!fld) throw new Error('no value field');
  var st = encodeURIComponent(JSON.stringify([{ statisticType: 'avg', onStatisticField: fld.name, outStatisticFieldName: 'mean' }, { statisticType: 'count', onStatisticField: fld.name, outStatisticFieldName: 'n' }]));
  var j = await getJson(base + '/query?where=' + encodeURIComponent('StationCode IN (' + codes.map(function (c) { return "'" + c + "'"; }).join(',') + ') AND Date >= ' + D('2020-01-01') + ' AND ' + fld.name + ' >= 0') + '&groupByFieldsForStatistics=StationCode&outStatistics=' + st + '&f=json');
  var out = { label: fld.alias || fld.name, by: {} }; (j.features || []).forEach(function (f) { if (f.attributes.n >= 4) out.by[f.attributes.StationCode] = { mean: r3(f.attributes.mean), n: f.attributes.n }; });
  return out;
}
async function detail(id, res) {
  var bj = await getJson(WB + '?where=' + encodeURIComponent("localId = '" + id + "'") + '&outFields=localId,namespace,F2018_statu,Shape__Area&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.0004&f=json');
  var f0 = (bj.features || [])[0]; if (!f0 || !f0.geometry) { res.status(404).json({ ok: false, error: 'not_found' }); return; }
  var body = shape(f0), P = poly(body.rings), D = await dateStyle(), safe = function (p) { return p.catch(function (e) { console.warn('River part failed:', String(e && e.message)); return null; }); };
  var cx = 0, cy = 0, r0 = body.rings[0]; r0.forEach(function (p) { cx += p[0] / r0.length; cy += p[1] / r0.length; });
  var sum = function (fields) { return encodeURIComponent(JSON.stringify(fields.map(function (k) { return { statisticType: 'sum', onStatisticField: k, outStatisticFieldName: k }; }))); };
  var incF = ['totals', 'farm', 'niw_ltd', 'domestic', 'industry', 'high']; for (var y = 2011; y <= 2024; y++) incF.push('y' + y);
  var area = encodeURIComponent(JSON.stringify([{ statisticType: 'sum', onStatisticField: 'shape_star', outStatisticFieldName: 'area' }, { statisticType: 'count', onStatisticField: 'ruleid', outStatisticFieldName: 'n' }]));
  var got = await Promise.all([
    safe(getJson(SRP, 'where=' + encodeURIComponent('Date >= ' + D('2018-01-01')) + '&' + P + '&outFields=StationCode,Location&returnDistinctValues=true&returnGeometry=false&f=json')),
    safe(getJson(ORG + '/NIW_Waste_water_Treatment_Works_Asssets_May_2024/FeatureServer/30/query?where=' + encodeURIComponent("Receiving_Waterbody_ID = '" + id + "'") + '&outFields=Name,Receiving_Waterbody_Name&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json')),
    safe(getJson(ORG + '/NIW_Predicted_Overflow_Assets_Data_May24/FeatureServer/32/query', 'where=1%3D1&' + P + '&outFields=Name,Predicted_Spill_Frequency___Yea,Predicted_Spill_Volume___Year__,Storm_Overflow_Classification,Receiving_Waterbody_Name&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json')),
    safe(getJson(ORG + '/Pollution_Incidents_2011_to_2024/FeatureServer/0/query', 'where=1%3D1&' + P + '&outStatistics=' + sum(incF) + '&f=json')),
    safe(getJson(ORG + '/Agricultural_Critical_Risk_Areas/FeatureServer/0/query', 'where=1%3D1&' + P + '&groupByFieldsForStatistics=ruleid&outStatistics=' + area + '&f=json')),
    safe(getJson(ORG + '/Agricultural_Critical_Risk_Areas/FeatureServer/0/query', 'where=1%3D1&' + P + '&groupByFieldsForStatistics=bh&outStatistics=' + area + '&f=json')),
    safe(getJson(ORG + '/Poultry_Buildings_Declan_Test/FeatureServer/0/query', 'where=1%3D1&' + P + '&returnCountOnly=true&f=json')),
    safe(getJson(ORG + '/FarmCensusDistrictElectoralArea2019/FeatureServer/0/query?where=1%3D1&geometry=' + cx + ',' + cy + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json')),
    safe(getJson(ORG + '/NIW_Waste_water_Treatment_Works_Asssets_May_2024/FeatureServer/30/query', 'where=1%3D1&' + P + '&outFields=Name,Receiving_Waterbody_Name,Receiving_Waterbody_ID&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json'))
  ]);
  /* test sites: every reading since 2010, then worked up by year and by month */
  var stations = {}; ((got[0] && got[0].features) || []).forEach(function (f) { stations[f.attributes.StationCode] = f.attributes.Location; });
  var codes = Object.keys(stations), sites = [], extra = {};
  if (codes.length) {
    var inList = 'StationCode IN (' + codes.map(function (c) { return "'" + c + "'"; }).join(',') + ')';
    var rows = await safe(paged(SRP + '?where=' + encodeURIComponent(inList + ' AND Date >= ' + D('2010-01-01') + ' AND P_SOL__mg_l_ >= 0 AND P_SOL__mg_l_ < 5') + '&outFields=StationCode,Date,P_SOL__mg_l_&returnGeometry=true&outSR=4326&geometryPrecision=4&f=json', 6)) || [];
    var by = {}; rows.forEach(function (f) { var a = f.attributes, d = typeof a.Date === 'number' ? new Date(a.Date).toISOString().slice(0, 10) : String(a.Date).slice(0, 10); if (!/^\d{4}-\d\d/.test(d)) return; var o = by[a.StationCode] = by[a.StationCode] || { g: f.geometry, v: [] }; if (!o.g && f.geometry) o.g = f.geometry; o.v.push([d, a.P_SOL__mg_l_]); });
    sites = Object.keys(by).map(function (c) {
      var o = by[c], yr = {}, mo = {}, recent = [], prev = [], summer = [], winter = [], last = null;
      o.v.forEach(function (x) { var yy = +x[0].slice(0, 4), mm = +x[0].slice(5, 7); (yr[yy] = yr[yy] || []).push(x[1]); if (yy >= 2015) { (mo[mm] = mo[mm] || []).push(x[1]); (mm >= 4 && mm <= 9 ? summer : winter).push(x[1]); } if (yy >= 2020) recent.push(x[1]); else if (yy >= 2015) prev.push(x[1]); if (!last || x[0] > last[0]) last = x; });
      var years = []; for (var yy = 2010; yy <= 2024; yy++) years.push(yr[yy] && yr[yy].length >= 3 ? r3(mean(yr[yy])) : null);
      var months = []; for (var mm = 1; mm <= 12; mm++) months.push(mo[mm] && mo[mm].length >= 3 ? r3(mean(mo[mm])) : null);
      return { code: c, name: stations[c], lat: o.g ? r4(o.g.y) : null, lon: o.g ? r4(o.g.x) : null, n: recent.length, mean: recent.length >= 6 ? r3(mean(recent)) : null, prev: prev.length >= 6 ? r3(mean(prev)) : null, years: years, months: months,
        summer: summer.length >= 6 ? r3(mean(summer)) : null, winter: winter.length >= 6 ? r3(mean(winter)) : null, max: r3(Math.max.apply(null, recent.concat([0]))), last: last ? { date: last[0], v: r3(last[1]) } : null };
    }).filter(function (s) { return s.mean != null; }).sort(function (a, b) { return b.mean - a.mean; });
    var ot = await Promise.all([safe(otherTest('River_Water_Quality_Monitoring_1990_to_2024_Ammonia', codes, D)), safe(otherTest('River_Water_Quality_Monitoring_1990_to_2024_Biochemical_Oxygen_Demand', codes, D))]);
    extra = { ammonia: ot[0], bod: ot[1] };
  }
  var pt = function (f, o) { if (f.geometry) { o.lat = r4(f.geometry.y); o.lon = r4(f.geometry.x); } return o; };
  var inc = got[3] && got[3].features && got[3].features[0] ? got[3].features[0].attributes : null, incOut = null;
  if (inc) { var ys = []; for (var y2 = 2011; y2 <= 2024; y2++) ys.push(inc['y' + y2] || 0); incOut = { total: inc.totals || 0, farm: inc.farm || 0, sewage: (inc.niw_ltd || 0) + (inc.domestic || 0), industry: inc.industry || 0, high: inc.high || 0, years: ys }; }
  var risk = null; if (got[4] && got[4].features) { risk = { low: 0, medium: 0, high: 0, parcels: 0 }; got[4].features.forEach(function (f) { var k = { 1: 'low', 2: 'medium', 3: 'high' }[f.attributes.ruleid]; if (k) { risk[k] = Math.round((f.attributes.area || 0) / 10000); risk.parcels += f.attributes.n || 0; } }); }
  var use = got[5] && got[5].features ? got[5].features.map(function (f) { return { use: f.attributes.bh, ha: Math.round((f.attributes.area || 0) / 10000) }; }).filter(function (x) { return x.use && x.ha; }).sort(function (a, b) { return b.ha - a.ha; }).slice(0, 5) : null;
  var dea = got[7] && got[7].features && got[7].features[0] ? got[7].features[0].attributes : null;
  var direct = ((got[1] && got[1].features) || []).map(function (f) { return pt(f, { name: f.attributes.Name, into: f.attributes.Receiving_Waterbody_Name }); });
  var directNames = {}; direct.forEach(function (w) { directNames[w.name] = 1; });
  var otherWorks = ((got[8] && got[8].features) || []).filter(function (f) { return !directNames[f.attributes.Name]; }).map(function (f) { return pt(f, { name: f.attributes.Name, into: f.attributes.Receiving_Waterbody_Name }); });
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({ ok: true, id: id, name: f0.attributes.namespace, status: f0.attributes.F2018_statu, km2: Math.round((f0.attributes.Shape__Area || 0) / 1e5) / 10, rings: body.rings, box: body.box,
    sites: sites, other: extra, works: got[1] ? direct : null, worksNearby: otherWorks,
    overflows: got[2] ? (got[2].features || []).map(function (f) { var a = f.attributes; return pt(f, { name: a.Name, spills: a.Predicted_Spill_Frequency___Yea || 0, vol: a.Predicted_Spill_Volume___Year__ || 0, cls: a.Storm_Overflow_Classification || '', into: a.Receiving_Waterbody_Name || '' }); }).sort(function (a, b) { return b.vol - a.vol; }) : null,
    incidents: incOut, fieldRisk: risk, fieldUse: use, poultryHouses: got[6] ? got[6].count : null,
    farmArea: dea ? { name: dea.DEAName, farms: dea.NumberOfFarms, farmedHa: dea.TotalAreaFarmedInHa, cattle: dea.TotalNumberofCattle, sheep: dea.TotalNumberofsheep, pigs: dea.TotalNumberOfPigs, poultry: (dea.TotalNumberOfPoultry000 || 0) * 1000 } : null });
}
module.exports = async function (req, res) {
  try {
    var q = req.query || {};
    if (q.list) return await list(res);
    if (!/^[A-Za-z0-9]{8,30}$/.test(q.id || '')) { res.status(400).json({ ok: false, error: 'bad_id' }); return; }
    return await detail(q.id, res);
  } catch (e) {
    console.warn('River failed:', String(e && e.message));
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message).slice(0, 80) });
  }
};
