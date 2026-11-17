/* Temporary diagnostic for data sources. Preview only. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
async function j(u) { try { var r = await fetch(u); var t = await r.text(); try { return JSON.parse(t); } catch (e) { return { status: r.status, text: t.slice(0, 300) }; } } catch (e) { return { error: String(e) }; } }
module.exports = async function (req, res) {
  var out = {}, q = req.query || {};
  if (q.what === 'list') {
    var l = await j(ORG + '?f=json');
    out.services = (l.services || []).map(function (s) { return s.name + ' [' + s.type + ']'; });
  } else if (q.what === 'svc') {
    var base = ORG + '/' + q.name + '/FeatureServer';
    var root = await j(base + '?f=json');
    out.layers = (root.layers || []).map(function (x) { return [x.id, x.name]; });
    out.tables = (root.tables || []).map(function (x) { return [x.id, x.name]; });
    out.copyright = root.copyrightText; out.desc = (root.serviceDescription || root.description || '').slice(0, 300);
    var id = q.id || ((root.layers && root.layers[0]) || (root.tables && root.tables[0]) || {}).id || 0;
    var lay = await j(base + '/' + id + '?f=json');
    out.fields = (lay.fields || []).map(function (f) { return f.name + ':' + f.type.replace('esriFieldType', '') + (f.alias && f.alias !== f.name ? ' (' + f.alias + ')' : ''); });
    out.geometryType = lay.geometryType; out.maxRecordCount = lay.maxRecordCount;
    var dateField = (lay.fields || []).filter(function (f) { return f.type === 'esriFieldTypeDate'; }).map(function (f) { return f.name; })[0];
    out.dateField = dateField;
    out.count = await j(base + '/' + id + '/query?where=1%3D1&returnCountOnly=true&f=json');
    var near = '&geometry=-6.75,54.44,-6.10,54.80&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects';
    out.desc2 = (lay.description || '').slice(0, 400);
    out.renderer = lay.drawingInfo && lay.drawingInfo.renderer && { type: lay.drawingInfo.renderer.type, field: lay.drawingInfo.renderer.field1, values: (lay.drawingInfo.renderer.uniqueValueInfos || []).slice(0, 40).map(function (u) { return [u.value, u.label, u.symbol && u.symbol.color]; }) };
    out.nearCount = await j(base + '/' + id + '/query?where=1%3D1' + near + '&returnCountOnly=true&f=json');
    var s = await j(base + '/' + id + '/query?where=1%3D1' + near + '&outFields=*&returnGeometry=false&resultRecordCount=' + (q.n || 3) + '&f=json');
    out.sample = (s.features || []).map(function (f) { return f.attributes; }); out.sampleErr = s.error;
    if (q.distinct) { var dd = await j(base + '/' + id + '/query?where=1%3D1' + near + '&outFields=' + q.distinct + '&returnDistinctValues=true&returnGeometry=false&f=json'); out.distinct = (dd.features || []).map(function (f) { return f.attributes[q.distinct]; }).slice(0, 80); }
    if (q.size) { var gg = await fetch(base + '/' + id + '/query?where=1%3D1' + near + '&outFields=OBJECTID&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=' + q.size + '&f=geojson'); var tx = await gg.text(); out.geojsonBytes = tx.length; }
  } else if (q.what === 'wms') {
    try { var r2 = await fetch(q.url + (q.url.indexOf('?') < 0 ? '?' : '&') + 'service=WMS&request=GetCapabilities'); var x = await r2.text(); out.status = r2.status; out.len = x.length;
      var re = /<Layer[^>]*>\s*<Name>([^<]*)<\/Name>\s*<Title>(?:<!\[CDATA\[)?([^<\]]*)/g, m, ls = []; while ((m = re.exec(x))) ls.push([m[1], m[2]]); out.layers = ls.slice(0, 40);
      out.crs3857 = x.indexOf('EPSG:3857') >= 0; out.access = (x.match(/<(Fees|AccessConstraints)>[^<]{0,300}/g) || []); } catch (e) { out.error = String(e); }
  } else if (q.what === 'meteo') {
    var m = await j('https://api.open-meteo.com/v1/forecast?latitude=54.62&longitude=-6.41&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,sunshine_duration&past_days=30&forecast_days=1&wind_speed_unit=mph&timezone=UTC');
    out.keys = Object.keys(m); out.units = m.hourly_units; out.n = m.hourly && m.hourly.time.length;
    out.first = m.hourly && [m.hourly.time[0], m.hourly.temperature_2m[0], m.hourly.wind_speed_10m[0], m.hourly.wind_direction_10m[0], m.hourly.precipitation[0], m.hourly.sunshine_duration[0]];
    out.last = m.hourly && m.hourly.time[m.hourly.time.length - 1]; out.err = m.reason || m.error;
  } else if (q.what === 'gibs') {
    var d = q.date || '2026-08-10';
    var layers = ['MODIS_Terra_CorrectedReflectance_TrueColor', 'VIIRS_SNPP_CorrectedReflectance_TrueColor', 'VIIRS_NOAA20_CorrectedReflectance_TrueColor'];
    out.tiles = [];
    for (var i = 0; i < layers.length; i++) {
      var u = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + layers[i] + '/default/' + d + '/GoogleMapsCompatible_Level9/9/162/246.jpg';
      try { var r = await fetch(u); var b = Buffer.from(await r.arrayBuffer()); out.tiles.push([layers[i], r.status, r.headers.get('content-type'), b.length]); } catch (e) { out.tiles.push([layers[i], String(e)]); }
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
};
