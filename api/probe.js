/* Temporary diagnostic: lists layers in the GSNI geology WMS. Not for production. */
var BASE = 'https://map.bgs.ac.uk/arcgis/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/WMSServer';
module.exports = async function (req, res) {
  var out = {};
  try {
    var r = await fetch(BASE + '?service=WMS&version=1.3.0&request=GetCapabilities');
    out.capStatus = r.status;
    var x = await r.text();
    out.length = x.length;
    var layers = [], re = /<Layer[^>]*>\s*<Name>([^<]*)<\/Name>\s*<Title>(?:<!\[CDATA\[)?([^<\]]*)/g, m;
    while ((m = re.exec(x))) layers.push([m[1], m[2]]);
    out.layers = layers;
    out.crs = Array.from(new Set((x.match(/<CRS>[^<]+<\/CRS>/g) || []).map(function (s) { return s.replace(/<\/?CRS>/g, ''); }))).slice(0, 20);
    out.formats = Array.from(new Set((x.match(/<Format>[^<]+<\/Format>/g) || []).map(function (s) { return s.replace(/<\/?Format>/g, ''); })));
    out.scales = (x.match(/<(Min|Max)ScaleDenominator>[^<]+/g) || []).slice(0, 30);
    out.access = (x.match(/<(Fees|AccessConstraints)>[^<]*/g) || []);
    out.cors = r.headers.get('access-control-allow-origin');
    var q = req.query && req.query.layer;
    if (q) {
      var g = await fetch(BASE + '?service=WMS&version=1.3.0&request=GetMap&layers=' + encodeURIComponent(q) + '&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox=-782715,7279251,-704443,7357523');
      var buf = Buffer.from(await g.arrayBuffer());
      out.getMap = { status: g.status, type: g.headers.get('content-type'), bytes: buf.length, head: buf.slice(0, 200).toString('latin1').replace(/[^\x20-\x7e]/g, '.') };
      var lg = await fetch(BASE + '?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=' + encodeURIComponent(q));
      out.legend = { status: lg.status, type: lg.headers.get('content-type') };
    }
  } catch (e) { out.error = String(e); }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
};
