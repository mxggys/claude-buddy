// Wetter von Open-Meteo (kostenlos, ohne Schlüssel). Abgefragt wird nur, wenn „Wetter“ an ist.
const { net } = require('electron');

async function getJson(url) {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Ort suchen: "Berlin" → { name, lat, lon }
async function findPlace(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(query)}`;
  const data = await getJson(url);
  const hit = data.results && data.results[0];
  if (!hit) return null;
  return { name: [hit.name, hit.admin1 || hit.country].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude };
}

// Aktuelles Wetter. Der Wetter-Code allein sagt oft „Regen“, obwohl gerade nichts fällt.
// Darum zählt die gemessene Niederschlagsmenge der letzten 15 Minuten (current = 15-Minuten-Werte),
// dazu die Regenwahrscheinlichkeit der aktuellen Stunde.
async function currentWeather({ lat, lon }) {
  const fields = 'temperature_2m,apparent_temperature,weather_code,is_day,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,relative_humidity_2m';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=${fields}&hourly=precipitation_probability&forecast_hours=2&timezone=auto`;
  const data = await getJson(url);
  const c = data.current;
  const hours = (data.hourly && data.hourly.precipitation_probability) || [];
  const prob = typeof hours[0] === 'number' ? hours[0] : null;
  const wet = (c.rain || 0) + (c.showers || 0) + (c.precipitation || 0);
  const snowNow = (c.snowfall || 0) > 0;
  const rainNow = !snowNow && wet >= 0.1; // ab 0,1 mm in 15 Minuten regnet es wirklich
  return {
    code: c.weather_code,
    temp: c.temperature_2m,
    feels: c.apparent_temperature,
    isDay: c.is_day === 1,
    rainNow,
    snowNow,
    storm: c.weather_code >= 95 && (rainNow || (prob || 0) >= 50),
    prob, // Regenrisiko in Prozent (diese Stunde)
    cloud: c.cloud_cover,
    wind: c.wind_speed_10m,
    humidity: c.relative_humidity_2m,
  };
}

// Kurzbeschreibung für das Menü: nach dem, was gerade wirklich passiert
function describe(w) {
  if (!w) return '';
  if (w.storm) return 'Gewitter';
  if (w.snowNow) return 'es schneit';
  if (w.rainNow) return 'es regnet';
  if (w.code === 45 || w.code === 48) return 'Nebel';
  if (w.cloud >= 85) return 'bedeckt';
  if (w.cloud >= 40) return 'bewölkt';
  return w.isDay ? 'sonnig' : 'klar';
}

module.exports = { findPlace, currentWeather, describe };
