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

module.exports = async function (req, res) {
  var quiet = function (p) { return p.catch(function (e) { console.warn('Land data source failed:', String(e)); return null; }); };
  var parts = await Promise.all([quiet(basins()), quiet(farms()), quiet(fieldStats())]);
  var ok = !!(parts[0] || parts[1] || parts[2]);
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=120');
  if (req.query && req.query.summary) {
    res.status(200).json({
      ok: ok,
      basins: parts[0] && parts[0].features.map(function (f) { return f.properties.NAME; }),
      farms: parts[1] && parts[1].features.map(function (f) { return f.properties.DEAName; }),
      farmSample: parts[1] && parts[1].features[0] && parts[1].features[0].properties,
      fieldStats: parts[2],
      bytes: JSON.stringify(parts).length
    });
    return;
  }
  res.status(ok ? 200 : 502).json({
    ok: ok,
    source: 'DAERA open data (ArcGIS), Open Government Licence v3.0',
    basins: parts[0], farms: parts[1], fieldStats: parts[2]
  });
};
