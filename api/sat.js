/* Sentinel-2 pictures of Lough Neagh for a chosen day, from the Copernicus Data Space (Sentinel Hub).
   ?list=1            clear days in the chosen period, with the cloud share for each
   ?date=YYYY-MM-DD   one picture of the lough: mode=true (photo) or mode=algae (algae index on the water)
   ?check=1           a short self-test
   The Copernicus keys stay on the server and are never sent to the page. */
var TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
var SH = 'https://sh.dataspace.copernicus.eu/api/v1';
var BOX = [-6.78, 54.42, -6.06, 54.82];           /* west, south, east, north */
var R = 6378137;
function mx(lon) { return lon * Math.PI / 180 * R; }
function my(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R; }
var MBOX = [mx(BOX[0]), my(BOX[1]), mx(BOX[2]), my(BOX[3])];

var PHOTO = '//VERSION=3\n' +
  'function setup(){return{input:["B02","B03","B04"],output:{bands:3}}}\n' +
  'function evaluatePixel(s){return [2.8*s.B04,2.8*s.B03,2.8*s.B02]}';
/* Algae index (NDCI): how strongly the water reflects red-edge light compared with red. Water only. */
var ALGAE = '//VERSION=3\n' +
  'function setup(){return{input:["B03","B04","B05","B08","SCL","dataMask"],output:{bands:4}}}\n' +
  'var ST=[[-0.15,[0.08,0.19,0.45]],[0.0,[0.16,0.50,0.72]],[0.1,[0.45,0.76,0.45]],[0.2,[0.96,0.89,0.26]],[0.35,[0.93,0.50,0.12]],[0.5,[0.74,0.10,0.12]]];\n' +
  'function col(v){if(v<=ST[0][0])return ST[0][1];for(var i=1;i<ST.length;i++){if(v<=ST[i][0]){var a=ST[i-1],b=ST[i],k=(v-a[0])/(b[0]-a[0]);return [a[1][0]+(b[1][0]-a[1][0])*k,a[1][1]+(b[1][1]-a[1][1])*k,a[1][2]+(b[1][2]-a[1][2])*k];}}return ST[ST.length-1][1];}\n' +
  'function evaluatePixel(s){\n' +
  ' if(!s.dataMask)return [0,0,0,0];\n' +
  ' if(s.SCL==3||s.SCL==8||s.SCL==9||s.SCL==10)return [0.86,0.86,0.86,0.8];\n' +
  ' var w=(s.B03-s.B08)/(s.B03+s.B08);\n' +
  ' if(s.SCL!=6&&w<=0)return [0,0,0,0];\n' +
  ' var c=col((s.B05-s.B04)/(s.B05+s.B04));return [c[0],c[1],c[2],1];\n' +
  '}';

async function token() {
  var id = (process.env.COPERNICUS_CLIENT_ID || '').trim(), secret = (process.env.COPERNICUS_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('no_keys');
  var r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&client_id=' + encodeURIComponent(id) + '&client_secret=' + encodeURIComponent(secret) });
  if (!r.ok) { var t = await r.text(); console.warn('Copernicus sign-in refused:', r.status, t.slice(0, 200)); throw new Error('sign_in_' + r.status); }
  return (await r.json()).access_token;
}
async function picture(tok, date, mode, width) {
  var height = Math.round(width * (MBOX[3] - MBOX[1]) / (MBOX[2] - MBOX[0]));
  var body = {
    input: { bounds: { bbox: MBOX, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from: date + 'T00:00:00Z', to: date + 'T23:59:59Z' }, mosaickingOrder: 'leastCC' } }] },
    output: { width: width, height: height, responses: [{ identifier: 'default', format: mode === 'algae' ? { type: 'image/png' } : { type: 'image/jpeg', quality: 85 } }] },
    evalscript: mode === 'algae' ? ALGAE : PHOTO
  };
  return fetch(SH + '/process', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, Accept: mode === 'algae' ? 'image/png' : 'image/jpeg' }, body: JSON.stringify(body) });
}
/* Days with a Sentinel-2 pass over the lough. Cloud is the clearest tile's share for that day, covering a wider area than the lough. */
async function days(tok, from, to, maxCloud) {
  var best = {}, next = null;
  for (var page = 0; page < 6; page++) {
    var q = { bbox: BOX, datetime: from + 'T00:00:00Z/' + to + 'T23:59:59Z', collections: ['sentinel-2-l2a'], limit: 100,
      filter: { op: '<=', args: [{ property: 'eo:cloud_cover' }, maxCloud] }, 'filter-lang': 'cql2-json',
      fields: { include: ['properties.datetime', 'properties.eo:cloud_cover'], exclude: ['geometry', 'assets', 'links', 'bbox', 'stac_extensions'] } };
    if (next != null) q.next = next;
    var r = await fetch(SH + '/catalog/1.0.0/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(q) });
    if (!r.ok) { var t = await r.text(); console.warn('Catalogue refused:', r.status, t.slice(0, 300)); throw new Error('catalogue_' + r.status); }
    var j = await r.json();
    (j.features || []).forEach(function (f) {
      var d = String(f.properties.datetime).slice(0, 10), c = f.properties['eo:cloud_cover'];
      if (typeof c === 'number' && (best[d] == null || c < best[d])) best[d] = c;
    });
    next = j.context && j.context.next != null ? j.context.next : null;
    if (next == null) break;
  }
  return Object.keys(best).sort().reverse().map(function (d) { return { date: d, cloud: Math.round(best[d]) }; });
}
function iso(d) { return d.toISOString().slice(0, 10); }

module.exports = async function (req, res) {
  var q = req.query || {};
  try {
    var tok = await token();
    if (q.check) {
      var out = { ok: true, signIn: true };
      try { var ds = await days(tok, iso(new Date(Date.now() - 120 * 86400000)), iso(new Date()), 40); out.days = ds.length; out.first = ds.slice(0, 5); } catch (e) { out.daysError = String(e.message); ds = []; }
      var d0 = ds.length ? ds[0].date : '2025-08-12';
      for (var m of ['true', 'algae']) {
        var pr = await picture(tok, d0, m, 256), info = { status: pr.status, type: pr.headers.get('content-type') };
        if (pr.ok) info.bytes = (await pr.arrayBuffer()).byteLength; else info.error = (await pr.text()).slice(0, 400);
        out[m] = info;
      }
      res.setHeader('Cache-Control', 'no-store'); res.status(200).json(out); return;
    }
    if (q.list) {
      var to = new Date(), from = new Date(Date.now() - 365 * 86400000);
      if (/^20\d\d$/.test(q.year || '')) { from = new Date(q.year + '-01-01T00:00:00Z'); to = new Date(Math.min(Date.now(), Date.parse(q.year + '-12-31T00:00:00Z'))); }
      var list = await days(tok, iso(from), iso(to), 50);
      res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      res.status(200).json({ ok: true, box: BOX, days: list }); return;
    }
    var date = String(q.date || ''), mode = q.mode === 'algae' ? 'algae' : 'true';
    if (!/^20\d\d-\d\d-\d\d$/.test(date) || date < '2017-01-01' || date > iso(new Date())) { res.status(400).json({ ok: false, error: 'bad_date' }); return; }
    var p = await picture(tok, date, mode, 2048);
    if (!p.ok) { var txt = await p.text(); console.warn('Picture refused:', p.status, txt.slice(0, 300)); res.setHeader('Cache-Control', 'public, s-maxage=120'); res.status(502).json({ ok: false, error: 'picture_' + p.status }); return; }
    var buf = Buffer.from(await p.arrayBuffer());
    res.setHeader('Content-Type', mode === 'algae' ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');
    res.status(200).send(buf);
  } catch (e) {
    console.warn('Satellite feed failed:', String(e && e.message));
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message).slice(0, 40) });
  }
};
