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

## Map

The map uses Leaflet with OpenStreetMap as the base map and the Geological Survey of Northern Ireland 1:250,000 geology layers (surface deposits and bedrock) from its public map service. Marker positions for rivers, shores and places are approximate.

## Open data

`api/lough.js` reads DAERA open data (Open Government Licence v3.0): the three monitoring buoys, confirmed blue-green algae locations and NI Water treatment works. `api/weather.js` also adds the last 30 days of weather from the Open-Meteo model archive. Satellite photos come from NASA GIBS. None of these need a key.

`api/land.js` adds river basin outlines, the 2019 farm census by district electoral area and totals from DAERA's agricultural risk map. `api/fields.js` returns the individual scored fields for a small map area when the reader zooms in.

## Live forecast

The Live forecast option uses the Met Office Weather DataHub (Global Spot, three-hourly). The API key is stored in Vercel as the environment variable `MET_OFFICE_API_KEY` and is never sent to the browser. Responses are cached for an hour to stay inside the free daily allowance.

Changes pushed to the `main` branch publish to the live site automatically.
