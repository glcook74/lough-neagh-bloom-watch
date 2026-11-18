/* Algae index statistics from Sentinel-2 for nine areas of Lough Neagh, one row per satellite pass.
   ?year=2025&half=1|2   half a year at a time, to keep each request quick
   Uses the Sentinel Hub Statistical API on the Copernicus Data Space. Keys stay on the server. */
var TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
var STAT = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
var LON = [-6.64, -6.50, -6.37, -6.22], LAT = [54.47, 54.57, 54.67, 54.78];
var NAMES = [['nw', 'Ballyronan and Toome'], ['n', 'North shore'], ['ne', 'Antrim Bay'], ['w', 'Ardboe shore'], ['c', 'Open water'], ['e', 'Sandy Bay and Glenavy'], ['sw', 'Washing Bay and Maghery'], ['s', 'Bannfoot shore'], ['se', 'Kinnego and Oxford Island']];
/* Rows run north to south, columns west to east. */
var ZONES = NAMES.map(function (n, k) { var row = Math.floor(k / 3), col = k % 3; return { id: n[0], name: n[1], row: row, col: col, box: [LON[col], LAT[2 - row], LON[col + 1], LAT[3 - row]] }; });
var R = 6378137;
function mx(lon) { return lon * Math.PI / 180 * R; }
function my(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R; }
/* Band 0 is the index (NDCI). Band 1 is 1 where the index is above 0.1. Only clear water counts. */
var SCRIPT = '//VERSION=3\n' +
  'function setup(){return{input:[{bands:["B03","B04","B05","B08","SCL","dataMask"]}],output:[{id:"ndci",bands:2,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]}}\n' +
  'function evaluatePixel(s){\n' +
  ' var bad=s.SCL==0||s.SCL==1||s.SCL==3||s.SCL==8||s.SCL==9||s.SCL==10||s.SCL==11;\n' +
  ' var w=(s.B03-s.B08)/(s.B03+s.B08);\n' +
  ' var ok=s.dataMask==1&&!bad&&(s.SCL==6||w>0)&&(s.B05+s.B04)>0;\n' +
  ' var n=ok?(s.B05-s.B04)/(s.B05+s.B04):0;\n' +
  ' return {ndci:[n,n>0.1?1:0],dataMask:[ok?1:0]};\n' +
  '}';
async function token() {
  var id = (process.env.COPERNICUS_CLIENT_ID || '').trim(), secret = (process.env.COPERNICUS_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('no_keys');
  var r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&client_id=' + encodeURIComponent(id) + '&client_secret=' + encodeURIComponent(secret) });
  if (!r.ok) throw new Error('sign_in_' + r.status);
  return (await r.json()).access_token;
}
async function zoneStats(tok, z, from, to) {
  var body = {
    input: { bounds: { bbox: [mx(z.box[0]), my(z.box[1]), mx(z.box[2]), my(z.box[3])], properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 70, mosaickingOrder: 'leastCC' } }] },
    aggregation: { timeRange: { from: from + 'T00:00:00Z', to: to + 'T23:59:59Z' }, aggregationInterval: { of: 'P1D' }, evalscript: SCRIPT, resx: 200, resy: 200 },
    calculations: { default: {} }
  };
  for (var attempt = 0; attempt < 3; attempt++) {
    var r = await fetch(STAT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    if (r.ok) return (await r.json()).data || [];
    var t = await r.text();
    if (r.status !== 429 || attempt === 2) { console.warn('Statistics refused:', z.id, r.status, t.slice(0, 300)); throw new Error('stats_' + r.status); }
    await new Promise(function (ok) { setTimeout(ok, 3000 * (attempt + 1)); });
  }
}
module.exports = async function (req, res) {
  var q = req.query || {};
  try {
    var now = new Date(), year = String(q.year || ''), half = q.half === '2' ? 2 : 1;
    if (!/^20\d\d$/.test(year) || +year < 2017 || +year > now.getUTCFullYear()) { res.status(400).json({ ok: false, error: 'bad_year' }); return; }
    var from = year + (half === 1 ? '-01-01' : '-07-01'), to = year + (half === 1 ? '-06-30' : '-12-31'), today = now.toISOString().slice(0, 10);
    if (from > today) { res.setHeader('Cache-Control', 'public, s-maxage=3600'); res.status(200).json({ ok: true, year: +year, half: half, zones: ZONES, days: [] }); return; }
    var open = to >= today; if (open) to = today;
    var tok = await token();
    /* three areas at a time, so the satellite service's rate limit is not hit */
    var per = [];
    for (var g = 0; g < ZONES.length; g += 3) per = per.concat(await Promise.all(ZONES.slice(g, g + 3).map(function (z) { return zoneStats(tok, z, from, to); })));
    var byDay = {};
    per.forEach(function (rows, k) {
      rows.forEach(function (d) {
        var b = d.outputs && d.outputs.ndci && d.outputs.ndci.bands; if (!b || !b.B0 || !b.B0.stats) return;
        var s = b.B0.stats, n = (s.sampleCount || 0) - (s.noDataCount || 0);
        if (n < 20 || typeof s.mean !== 'number' || !isFinite(s.mean)) return;
        var day = String(d.interval.from).slice(0, 10);
        (byDay[day] = byDay[day] || [null, null, null, null, null, null, null, null, null])[k] = [+s.mean.toFixed(4), +(b.B1.stats.mean || 0).toFixed(3), n];
      });
    });
    var days = Object.keys(byDay).sort().map(function (d) { return { date: d, z: byDay[d] }; });
    res.setHeader('Cache-Control', 'public, max-age=' + (open ? 21600 : 2592000) + ', s-maxage=' + (open ? 86400 : 2592000) + ', stale-while-revalidate=2592000');
    res.status(200).json({ ok: true, year: +year, half: half, zones: ZONES, days: days });
  } catch (e) {
    console.warn('Satellite statistics failed:', String(e && e.message));
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message).slice(0, 40) });
  }
};
