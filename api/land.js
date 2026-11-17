/* How the land around Lough Neagh is used: river basins, the 2019 farm census and
   DAERA's field-by-field agricultural risk scores. DAERA open data, Open Government Licence. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
var NEAR = '&geometry=-6.75,54.44,-6.10,54.80&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects';
var SHAPE = '&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.002&f=geojson';

async function getJson(url) {
  var r = await fetch(url);
  if (!r.ok) throw new Error('status ' + r.status);
  var j = await r.json();
  if (j.error) throw new Error(j.error.message || 'service error');
  return j;
}
function basins() {
  return getJson(ORG + '/LocalManagementAreas/FeatureServer/0/query?where=1%3D1' + NEAR + '&outFields=NAME' + SHAPE);
}
function farms() {
  var f = 'DEAName,Year,NumberOfFarms,TotalAreaFarmedInHa,TotalCrops,TotalGrassRGrazingHa,TotalNumberofCattle,TotalNumberofsheep,TotalNumberOfPigs,TotalNumberOfPoultry000';
  return getJson(ORG + '/FarmCensusDistrictElectoralArea2019/FeatureServer/0/query?where=1%3D1' + NEAR + '&outFields=' + f + SHAPE);
}
async function fieldStats() {
  var stats = encodeURIComponent(JSON.stringify([
    { statisticType: 'sum', onStatisticField: 'shape_star', outStatisticFieldName: 'area' },
    { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }
  ]));
  var j = await getJson(ORG + '/Agricultural_Critical_Risk_Areas/FeatureServer/0/query?where=1%3D1' + NEAR +
    '&groupByFieldsForStatistics=bh,ruleid&outStatistics=' + stats + '&f=json');
  return (j.features || []).map(function (f) {
    var a = f.attributes;
    return { use: a.bh, risk: a.ruleid, ha: Math.round((a.area || 0) / 10000), fields: a.n };
  });
}

/* Confirmed water pollution incidents 2011 to 2024, counted in 1 km squares. */
async function incidents() {
  var f = 'totals,farm,niw_ltd,domestic,industry,catagriculture,catsewage,high,y2020,y2021,y2022,y2023,y2024';
  var j = await getJson(ORG + '/Pollution_Incidents_2011_to_2024/FeatureServer/0/query?where=totals%3E0' + NEAR + '&outFields=' + f +
    '&returnGeometry=true&outSR=4326&geometryPrecision=4&resultRecordCount=2000&f=json');
  return (j.features || []).filter(function (x) { return x.geometry && x.geometry.rings && x.geometry.rings[0]; }).map(function (x) {
    var a = x.attributes, xs = x.geometry.rings[0].map(function (p) { return p[0]; }), ys = x.geometry.rings[0].map(function (p) { return p[1]; });
    return {
      b: [Math.min.apply(null, ys), Math.min.apply(null, xs), Math.max.apply(null, ys), Math.max.apply(null, xs)],
      t: a.totals || 0, farm: a.farm || 0, niw: a.niw_ltd || 0, dom: a.domestic || 0, ind: a.industry || 0,
      agri: a.catagriculture || 0, sew: a.catsewage || 0, high: a.high || 0,
      recent: (a.y2020 || 0) + (a.y2021 || 0) + (a.y2022 || 0) + (a.y2023 || 0) + (a.y2024 || 0)
    };
  });
}

module.exports = async function (req, res) {
  var quiet = function (p) { return p.catch(function (e) { console.warn('Land data source failed:', String(e)); return null; }); };
  var parts = await Promise.all([quiet(basins()), quiet(farms()), quiet(fieldStats()), quiet(incidents())]);
  var ok = !!(parts[0] || parts[1] || parts[2]);
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=120');
  if (req.query && req.query.summary) {
    res.status(200).json({
      ok: ok,
      basins: parts[0] && parts[0].features.map(function (f) { return f.properties.NAME; }),
      farms: parts[1] && parts[1].features.map(function (f) { return f.properties.DEAName; }),
      farmSample: parts[1] && parts[1].features[0] && parts[1].features[0].properties,
      fieldStats: parts[2],
      incidents: parts[3] && { squares: parts[3].length, total: parts[3].reduce(function (p, x) { return p + x.t; }, 0), farm: parts[3].reduce(function (p, x) { return p + x.farm; }, 0), first: parts[3][0] },
      bytes: JSON.stringify(parts).length
    });
    return;
  }
  res.status(ok ? 200 : 502).json({
    ok: ok,
    source: 'DAERA open data (ArcGIS), Open Government Licence v3.0',
    basins: parts[0], farms: parts[1], fieldStats: parts[2], incidents: parts[3]
  });
};
