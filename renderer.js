// ============================================================================
// Weather Widget
// ============================================================================

const els = {
  app: document.getElementById('app'),
  minimizeBtn: document.getElementById('minimizeBtn'),
  closeBtn: document.getElementById('closeBtn'),
  minimizedNotice: document.getElementById('minimizedNotice'),
  mainContent: document.getElementById('mainContent'),
  locationBtn: document.getElementById('locationBtn'),
  locationLabel: document.getElementById('locationLabel'),
  searchPanel: document.getElementById('searchPanel'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  famousList: document.getElementById('famousList'),
  errorBanner: document.getElementById('errorBanner'),
  heroIcon: document.getElementById('heroIcon'),
  heroTemp: document.getElementById('heroTemp'),
  heroCondition: document.getElementById('heroCondition'),
  heroFeels: document.getElementById('heroFeels'),
  statHumidity: document.getElementById('statHumidity'),
  statWind: document.getElementById('statWind'),
  statUv: document.getElementById('statUv'),
  tabWeek: document.getElementById('tabWeek'),
  tabHourly: document.getElementById('tabHourly'),
  unitToggle: document.getElementById('unitToggle'),
  forecastList: document.getElementById('forecastList'),
  footer: document.getElementById('footer'),
};

const STORAGE_KEY = 'weather-widget:last-city';
const UNIT_KEY = 'weather-widget:unit';

const state = {
  city: { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  unit: localStorage.getItem(UNIT_KEY) === 'C' ? 'C' : 'F',
  tab: 'week',
  minimized: false,
  weather: null,   // parsed weather payload
  lastUpdated: null,
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Weather code -> pixel-cute icon + label (WMO codes, per Open-Meteo docs)
// ---------------------------------------------------------------------------
function weatherCodeInfo(code, isDay) {
  const table = {
    0: { icon: isDay ? '☀️' : '🌙', label: 'CLEAR' },
    1: { icon: isDay ? '🌤' : '🌙', label: 'MOSTLY CLEAR' },
    2: { icon: '⛅', label: 'PARTLY CLOUDY' },
    3: { icon: '☁️', label: 'OVERCAST' },
    45: { icon: '🌫', label: 'FOGGY' },
    48: { icon: '🌫', label: 'FOGGY' },
    51: { icon: '🌦', label: 'LIGHT DRIZZLE' },
    53: { icon: '🌦', label: 'DRIZZLE' },
    55: { icon: '🌦', label: 'HEAVY DRIZZLE' },
    56: { icon: '🌧', label: 'FREEZING DRIZZLE' },
    57: { icon: '🌧', label: 'FREEZING DRIZZLE' },
    61: { icon: '🌧', label: 'LIGHT RAIN' },
    63: { icon: '🌧', label: 'RAIN' },
    65: { icon: '🌧', label: 'HEAVY RAIN' },
    66: { icon: '🌧', label: 'FREEZING RAIN' },
    67: { icon: '🌧', label: 'FREEZING RAIN' },
    71: { icon: '❄️', label: 'LIGHT SNOW' },
    73: { icon: '❄️', label: 'SNOW' },
    75: { icon: '❄️', label: 'HEAVY SNOW' },
    77: { icon: '❄️', label: 'SNOW GRAINS' },
    80: { icon: '🌦', label: 'RAIN SHOWERS' },
    81: { icon: '🌧', label: 'RAIN SHOWERS' },
    82: { icon: '🌧', label: 'HEAVY SHOWERS' },
    85: { icon: '🌨', label: 'SNOW SHOWERS' },
    86: { icon: '🌨', label: 'SNOW SHOWERS' },
    95: { icon: '⛈', label: 'THUNDERSTORM' },
    96: { icon: '⛈', label: 'THUNDERSTORM' },
    99: { icon: '⛈', label: 'SEVERE STORM' },
  };
  return table[code] || { icon: '🌡', label: 'UNKNOWN' };
}

function uvLabel(uv) {
  if (uv == null || isNaN(uv)) return '--';
  if (uv < 3) return 'LOW';
  if (uv < 6) return 'MOD';
  if (uv < 8) return 'HIGH';
  if (uv < 11) return 'V.HIGH';
  return 'EXTREME';
}

// ---------------------------------------------------------------------------
// Unit conversion — API always returns Fahrenheit + mph; we convert for °C display
// ---------------------------------------------------------------------------
function fmtTemp(f) {
  if (f == null || isNaN(f)) return '--°';
  const val = state.unit === 'F' ? Math.round(f) : Math.round((f - 32) * 5 / 9);
  return `${val}°`;
}

function fmtWind(mph) {
  if (mph == null || isNaN(mph)) return '--';
  if (state.unit === 'F') return `${Math.round(mph)}mph`;
  return `${Math.round(mph * 1.60934)}km/h`;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
async function geocodeSearch(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocoding failed');
  const data = await res.json();
  return (data.results || []).map(r => ({
    name: r.name,
    country: r.country || r.country_code || '',
    admin1: r.admin1 || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,uv_index_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '8',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  return res.json();
}

// ---------------------------------------------------------------------------
// Data shaping
// ---------------------------------------------------------------------------
function buildViewModel(raw) {
  const cur = raw.current;
  const hourly = raw.hourly;
  const daily = raw.daily;

  // Current UV: find the hourly index matching "now" in the API's own timezone.
  let currentUv = null;
  if (hourly && hourly.time) {
    const nowIdx = hourly.time.indexOf(cur.time);
    currentUv = nowIdx >= 0 ? hourly.uv_index[nowIdx] : hourly.uv_index[0];
  }

  const info = weatherCodeInfo(cur.weather_code, cur.is_day === 1);

  // Next 5 hourly points starting from "now"
  const nowIdx = hourly.time.indexOf(cur.time);
  const startIdx = nowIdx >= 0 ? nowIdx : 0;
  const hourlyPoints = [];
  for (let i = startIdx; i < hourly.time.length && hourlyPoints.length < 6; i += 1) {
    const d = new Date(hourly.time[i]);
    hourlyPoints.push({
      label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', ''),
      icon: weatherCodeInfo(hourly.weather_code[i], true).icon,
      temp: hourly.temperature_2m[i],
    });
  }

  // Next 7 days (skip today, index 0, to mirror a forward-looking forecast; if
  // fewer than 8 days returned, just show what's available starting at index 0)
  const dayPoints = [];
  const startDay = daily.time.length > 7 ? 1 : 0;
  for (let i = startDay; i < daily.time.length && dayPoints.length < 7; i += 1) {
    const d = new Date(daily.time[i] + 'T00:00:00');
    dayPoints.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      icon: weatherCodeInfo(daily.weather_code[i], true).icon,
      hi: daily.temperature_2m_max[i],
      lo: daily.temperature_2m_min[i],
    });
  }

  return {
    tempF: cur.temperature_2m,
    feelsF: cur.apparent_temperature,
    humidity: Math.round(cur.relative_humidity_2m),
    windMph: cur.wind_speed_10m,
    uv: currentUv,
    icon: info.icon,
    condition: info.label,
    hourly: hourlyPoints,
    daily: dayPoints,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  els.minimizedNotice.classList.toggle('hidden', !state.minimized);
  els.mainContent.style.display = state.minimized ? 'none' : '';

  els.locationLabel.textContent = `◆ ${state.city.name.toUpperCase()} ◆`;
  els.unitToggle.textContent = state.unit === 'F' ? '°C' : '°F';

  els.tabWeek.classList.toggle('active', state.tab === 'week');
  els.tabHourly.classList.toggle('active', state.tab === 'hourly');

  if (state.error) {
    els.errorBanner.textContent = `⚠ ${state.error}`;
    els.errorBanner.classList.remove('hidden');
  } else {
    els.errorBanner.classList.add('hidden');
  }

  if (state.weather) {
    const w = state.weather;
    els.heroIcon.textContent = w.icon;
    els.heroTemp.textContent = fmtTemp(w.tempF);
    els.heroCondition.textContent = w.condition;
    els.heroFeels.textContent = `FEELS ${fmtTemp(w.feelsF)}`;
    els.statHumidity.textContent = `${w.humidity}%`;
    els.statWind.textContent = fmtWind(w.windMph);
    els.statUv.textContent = uvLabel(w.uv);

    els.forecastList.innerHTML = '';
    if (state.tab === 'week') {
      w.daily.forEach(d => {
        const row = document.createElement('div');
        row.className = 'forecast-row';
        row.innerHTML = `
          <span class="forecast-day">${d.label}</span>
          <span class="forecast-icon">${d.icon}</span>
          <div class="forecast-temps">
            <span class="forecast-hi">${fmtTemp(d.hi)}</span>
            <span class="forecast-lo">${fmtTemp(d.lo)}</span>
          </div>`;
        els.forecastList.appendChild(row);
      });
    } else {
      w.hourly.forEach(h => {
        const row = document.createElement('div');
        row.className = 'forecast-row';
        row.innerHTML = `
          <span class="forecast-time">${h.label}</span>
          <span class="forecast-icon">${h.icon}</span>
          <span class="forecast-single">${fmtTemp(h.temp)}</span>`;
        els.forecastList.appendChild(row);
      });
    }
  } else {
    els.heroTemp.textContent = state.loading ? '--°' : '--°';
    els.heroCondition.textContent = state.loading ? 'LOADING' : '--';
  }

  renderFooter();
}

function renderFooter() {
  if (state.loading) {
    els.footer.textContent = '♡ updating… ♡';
    return;
  }
  if (!state.lastUpdated) {
    els.footer.textContent = '♡ not updated yet ♡';
    return;
  }
  const secs = Math.floor((Date.now() - state.lastUpdated) / 1000);
  let when;
  if (secs < 10) when = 'just now';
  else if (secs < 60) when = `${secs}s ago`;
  else if (secs < 3600) when = `${Math.floor(secs / 60)}m ago`;
  else when = `${Math.floor(secs / 3600)}h ago`;
  els.footer.textContent = `♡ updated ${when} ♡`;
}
setInterval(renderFooter, 15000);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function selectCity(city) {
  state.city = city;
  state.error = null;
  closeSearchPanel();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(city));
  await refreshWeather();
}

async function refreshWeather() {
  state.loading = true;
  render();
  try {
    const raw = await fetchWeather(state.city.lat, state.city.lon);
    state.weather = buildViewModel(raw);
    state.lastUpdated = Date.now();
    state.error = null;
  } catch (err) {
    state.error = 'COULD NOT LOAD WEATHER — CHECK CONNECTION';
  } finally {
    state.loading = false;
    render();
  }
}

let searchDebounce = null;
function onSearchInput(e) {
  const q = e.target.value.trim();
  clearTimeout(searchDebounce);
  if (q.length < 2) {
    els.searchResults.innerHTML = '';
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const results = await geocodeSearch(q);
      renderSearchResults(results);
    } catch (err) {
      els.searchResults.innerHTML = '<div class="no-results">SEARCH FAILED — CHECK CONNECTION</div>';
    }
  }, 350);
}

function renderSearchResults(results) {
  els.searchResults.innerHTML = '';
  if (!results.length) {
    els.searchResults.innerHTML = '<div class="no-results">NO CITIES FOUND</div>';
    return;
  }
  results.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'result-item';
    const place = [r.admin1, r.country].filter(Boolean).join(', ');
    btn.innerHTML = `${r.name.toUpperCase()}<br><span class="result-country">${place}</span>`;
    btn.addEventListener('click', () => selectCity({ name: r.name, country: r.country, lat: r.lat, lon: r.lon }));
    els.searchResults.appendChild(btn);
  });
}

function renderFamousList() {
  els.famousList.innerHTML = '';
  (window.FAMOUS_CITIES || []).forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'famous-item';
    btn.textContent = c.city.toUpperCase();
    btn.title = c.country;
    btn.addEventListener('click', () => selectCity({ name: c.city, country: c.country, lat: c.lat, lon: c.lon }));
    els.famousList.appendChild(btn);
  });
}

function toggleSearchPanel() {
  const willOpen = els.searchPanel.classList.contains('hidden');
  els.searchPanel.classList.toggle('hidden', !willOpen);
  if (willOpen) {
    els.searchInput.value = '';
    els.searchResults.innerHTML = '';
    setTimeout(() => els.searchInput.focus(), 30);
  }
}
function closeSearchPanel() {
  els.searchPanel.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
els.minimizeBtn.addEventListener('click', () => {
  state.minimized = !state.minimized;
  render();
});

els.closeBtn.addEventListener('click', () => {
  window.widgetAPI.closeApp();
});

els.locationBtn.addEventListener('click', toggleSearchPanel);
els.searchInput.addEventListener('input', onSearchInput);

els.tabWeek.addEventListener('click', () => { state.tab = 'week'; render(); });
els.tabHourly.addEventListener('click', () => { state.tab = 'hourly'; render(); });

els.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'F' ? 'C' : 'F';
  localStorage.setItem(UNIT_KEY, state.unit);
  render();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(function init() {
  renderFamousList();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.lat && saved.lon) state.city = saved;
  } catch (_) { /* ignore malformed storage */ }

  render();
  refreshWeather();

  // Auto-refresh every 10 minutes
  setInterval(refreshWeather, 10 * 60 * 1000);
})();