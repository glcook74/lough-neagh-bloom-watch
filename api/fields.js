/* Field parcels with DAERA's agricultural risk score for a small map area.
   The page asks for this only when zoomed in. */
var URL_ = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/Agricultural_Critical_Risk_Areas/FeatureServer/0/query';
module.exports = async function (req, res) {
  var b = String((req.query && req.query.bbox) || '').split(',').map(Number);
  var bad = b.length !== 4 || b.some(function (v) { return !isFinite(v); }) ||
    b[0] < -8.5 || b[2] > -5 || b[1] < 53.8 || b[3] > 55.5 || b[2] <= b[0] || b[3] <= b[1] || b[2] - b[0] > 0.2 || b[3] - b[1] > 0.12;
  if (bad) { res.setHeader('Cache-Control', 'public, s-maxage=3600'); res.status(400).json({ ok: false, error: 'bad_area' }); return; }
  try {
    var url = URL_ + '?where=1%3D1&geometry=' + b.join(',') + '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
      '&outFields=bh,ruleid,hydoconnec&returnGeometry=true&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.00005&resultRecordCount=2000&f=geojson';
    var r = await fetch(url);
    if (!r.ok) throw new Error('status ' + r.status);
    var j = await r.json();
    if (j.error || !Array.isArray(j.features)) throw new Error('service error');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    if (req.query.summary) { res.status(200).json({ ok: true, n: j.features.length, bytes: JSON.stringify(j).length, first: j.features[0] && j.features[0].properties }); return; }
    res.status(200).json({ ok: true, more: !!(j.properties && j.properties.exceededTransferLimit) || !!j.exceededTransferLimit, features: j.features });
  } catch (e) {
    console.warn('Field parcels failed:', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
