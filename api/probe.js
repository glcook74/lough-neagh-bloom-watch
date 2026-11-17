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
    var s = await j(base + '/' + id + '/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=3&f=json' + (dateField ? '&orderByFields=' + dateField + '%20DESC' : ''));
    out.sample = (s.features || []).slice(0, 3); out.sampleErr = s.error;
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
