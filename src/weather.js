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

// Aktuelles Wetter: { code (WMO), temp (°C), isDay }
async function currentWeather({ lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const { current } = await getJson(url);
  return { code: current.weather_code, temp: current.temperature_2m, isDay: current.is_day === 1 };
}

// Kurzbeschreibung für das Menü
function describe(code) {
  if (code <= 1) return 'sonnig';
  if (code <= 3) return 'bewölkt';
  if (code === 45 || code === 48) return 'Nebel';
  if (code >= 95) return 'Gewitter';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Schnee';
  if (code >= 51) return 'Regen';
  return 'wechselhaft';
}

module.exports = { findPlace, currentWeather, describe };
