# Lough Neagh Bloom Watch

An interactive demonstration of how weather, nutrients and wind could be used to forecast blue-green algae risk around the Lough Neagh shoreline.

Live site: https://lough-neagh-bloom-watch.vercel.app

This is a demonstration model. The lough facts are real. The weather and risk numbers are illustrative and must not be used to decide whether the water is safe.

## Files

- `index.html` - the page and the schematic map
- `styles.css` - colours, fonts and layout
- `model.js` - the illustrative bloom-risk model
- `app.js` - the step-by-step walkthrough and charts
- `api/weather.js` - fetches the live Met Office forecast on the server and returns daily averages

There is no build step. Vercel serves these files as they are.

## Tabs

The page has seven tabs. **Map** is the map with its layers and guided tour. **Analysis** compares the seven river basins side by side: measured phosphorus, farming and sewage pressure, charts and the full table of figures. **Key areas** is a second map that pins the individual places the data flags (from `api/hotspots.js`): the river test sites with most phosphorus and the biggest rises, the storm overflows predicted to spill most, and the squares with most pollution incidents. **Rivers** takes one river water body at a time (from `api/river.js`) and sets out its phosphorus tests by year and season, the sewage works and overflows on it, recorded incidents and field risk, with suggestions for what could be checked or fixed. **Satellite** charts a Sentinel-2 algae index for nine areas of the lough on every clear day since 2023 (from `api/satstats.js`; pictures for the map come from `api/sat.js`). **Investigate** takes any date and sets out the weather, basin rain, buoy readings and satellite passes for the 70 days before it (from `api/event.js`), with a plain-English reading of what they suggest. **Forecast** tests a weather-only bloom score against the satellite record and sets out a range for next season (from `api/outlook.js`). Both satellite feeds need `COPERNICUS_CLIENT_ID` and `COPERNICUS_CLIENT_SECRET` set in Vercel.

## Map

The map is the main feature. The **Map layers** box under it switches the view (map, Sentinel-2 cloudless satellite image from EOX, or a NASA daily photo) and turns any data layer on or off. The seven-step tour switches on suitable layers for each step.

The map uses Leaflet with OpenStreetMap as the base map and the Geological Survey of Northern Ireland 1:250,000 geology layers (surface deposits and bedrock) from its public map service. Marker positions for rivers, shores and places are approximate.

## Open data

`api/lough.js` reads DAERA open data (Open Government Licence v3.0): the three monitoring buoys, confirmed blue-green algae locations and NI Water treatment works. `api/weather.js` also adds the last 30 days of weather from the Open-Meteo model archive. Satellite photos come from NASA GIBS. None of these need a key.

`api/land.js` adds river basin outlines, the 2019 farm census by district electoral area and totals from DAERA's agricultural risk map. `api/fields.js` returns the individual scored fields for a small map area when the reader zooms in.

`api/water.js` adds measured water quality: DAERA river phosphorus tests (2020 to 2024 averages per site), NI Water's predicted storm overflows and DAERA's 2018 water body status.

`api/sources.js` matches livestock, storm overflows, treatment works, pollution incidents, field risk and river phosphorus tests to the same river basin outlines, so the page can rank farming and sewage pressure basin by basin.

## Live forecast

The Live forecast option uses the Met Office Weather DataHub (Global Spot, three-hourly). The API key is stored in Vercel as the environment variable `MET_OFFICE_API_KEY` and is never sent to the browser. Responses are cached for an hour to stay inside the free daily allowance.

Changes pushed to the `main` branch publish to the live site automatically.
