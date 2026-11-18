/* What DAERA's open data records within a few kilometres of a point: treatment works, storm overflows,
   pollution incidents, licensed waste sites, poultry houses and the local farm census figures.
   ?lat=..&lon=..&km=3   Nearby is not the same as upstream. */
var ORG = 'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services';
async function q(path, lat, lon, km, extra) {
  var url = ORG + '/' + path + '/query?where=1%3D1&geometry=' + lon + ',' + lat + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' + (km ? '&distance=' + Math.round(km * 1000) + '&units=esriSRUnit_Meter' : '') + '&outFields=*&outSR=4326&resultRecordCount=200&f=json' + (extra || '');
  var r = await fetch(url); if (!r.ok) throw new Error('status ' + r.status); var j = await r.json(); if (j.error) throw new Error(j.error.message || 'service error'); return j.features || [];
}
function centre(g) { if (!g) return null; if (typeof g.x === 'number') return [g.y, g.x]; var r = g.rings && g.rings[0]; if (!r) return null; var x = 0, y = 0; r.forEach(function (p) { x += p[0] / r.length; y += p[1] / r.length; }); return [y, x]; }
function km(a, b) { var dy = (a[0] - b[0]) * 111.2, dx = (a[1] - b[1]) * 111.2 * Math.cos(a[0] * Math.PI / 180); return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10; }
function bearing(a, b) { var d = (Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI + 360) % 360; return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(d / 45) % 8]; }
module.exports = async function (req, res) {
  var lat = +req.query.lat, lon = +req.query.lon, R = Math.min(6, Math.max(1, +req.query.km || 3)), raw = req.query.raw === '1';
  if (!(lat > 53.9 && lat < 55.4 && lon > -8.3 && lon < -5.3)) { res.status(400).json({ ok: false, error: 'bad_point' }); return; }
  var here = [lat, lon], safe = function (p) { return p.catch(function (e) { return { error: String(e && e.message).slice(0, 120) }; }); };
  var got = await Promise.all([
    safe(q('NIW_Waste_water_Treatment_Works_Asssets_May_2024/FeatureServer/30', lat, lon, R)),
    safe(q('NIW_Predicted_Overflow_Assets_Data_May24/FeatureServer/32', lat, lon, R)),
    safe(q('Pollution_Incidents_2011_to_2024/FeatureServer/0', lat, lon, R)),
    safe(q('WLTWasteFacilities_PRD/FeatureServer/0', lat, lon, R)),
    safe(q('Poultry_Buildings_Declan_Test/FeatureServer/0', lat, lon, R, '&returnGeometry=true')),
    safe(q('FarmCensusDistrictElectoralArea2019/FeatureServer/0', lat, lon, 0, '&returnGeometry=false'))
  ]);
  var list = function (g, fn) { return Array.isArray(g) ? g.map(function (f) { var c = centre(f.geometry), o = fn(f.attributes); if (c) { o.km = km(here, c); o.dir = bearing(here, c); o.lat = +c[0].toFixed(4); o.lon = +c[1].toFixed(4); } return o; }).sort(function (a, b) { return (a.km || 0) - (b.km || 0); }) : g; };
  var inc = Array.isArray(got[2]) ? got[2].reduce(function (s, f) { var a = f.attributes; s.squares++; s.total += a.totals || 0; s.farm += a.farm || 0; s.sewage += (a.niw_ltd || 0) + (a.domestic || 0); s.industry += a.industry || 0; s.high += a.high || 0; s.recent += (a.y2020 || 0) + (a.y2021 || 0) + (a.y2022 || 0) + (a.y2023 || 0) + (a.y2024 || 0); return s; }, { squares: 0, total: 0, farm: 0, sewage: 0, industry: 0, high: 0, recent: 0 }) : got[2];
  var dea = Array.isArray(got[5]) && got[5][0] ? got[5][0].attributes : null;
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).json({ ok: true, lat: lat, lon: lon, km: R,
    works: list(got[0], function (a) { return { name: a.Name, into: a.Receiving_Waterbody_Name || null }; }),
    overflows: list(got[1], function (a) { return { name: a.Name, spills: a.Predicted_Spill_Frequency___Yea || 0, vol: a.Predicted_Spill_Volume___Year__ || 0, cls: a.Storm_Overflow_Classification || '', into: a.Receiving_Waterbody_Name || '' }; }),
    incidents: inc,
    /* Site names only. The register also holds contact details, which are not passed on. */
    waste: Array.isArray(got[3]) ? list(got[3], function (a) { return { name: a.SiteName, town: a.SiteTown, status: a.SiteStatus }; }) : got[3],
    poultry: Array.isArray(got[4]) ? { count: got[4].length, capped: got[4].length >= 200, nearest: list(got[4], function () { return {}; }).slice(0, 5) } : got[4],
    farmArea: dea ? { name: dea.DEAName, farms: dea.NumberOfFarms, farmedHa: dea.TotalAreaFarmedInHa, cattle: dea.TotalNumberofCattle, sheep: dea.TotalNumberofsheep, pigs: dea.TotalNumberOfPigs, poultry: (dea.TotalNumberOfPoultry000 || 0) * 1000 } : null });
};
