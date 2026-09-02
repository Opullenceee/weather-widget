# Weather Widget 🌸
 The Desktop weather widget, rebuilt from the Figma design into a real
**Electron** app (plain HTML / CSS / JavaScript. No React/build step needed
to run it). Frameless, draggable, always-transparent, and lives in your
system tray.

## What's included

- **Live weather, anywhere in the world.** Powered by
  [Open-Meteo](https://open-meteo.com) — free and no API key required.
- **Search any city on Earth** — click the city name at the top of the
  widget to open the search panel and type any city.
- **"50 Famous Cities" quick-pick list** — one iconic city for 50 of the
  world's most well-known countries, one tap away.
- Exact pixel-art look from the Figma file: purple/pink palette, hard pixel
  borders, `Press Start 2P` font, drop-shadow icon, the whole thing.
- All original interactions preserved:
  - **−** minimize button collapses the widget to a small pill.
  - **×** close button shows the "WIDGET CLOSED / REOPEN ♡" screen.
  - **7-DAY / HOURLY** tabs switch the forecast list.
  - **°F / °C** toggle converts every temperature and wind speed live.
  - Footer shows "updated Xs/m ago", ticking in real time.
- Runs in the system tray so you can always bring it back (right-click the
  tray icon for **Show Widget**, **Always on Top**, and **Quit**).
- Remembers your last-picked city and unit between launches.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer.

## Run it

```bash
cd weather-widget
npm install
npm start
```

## Build a standalone installer (optional)

```bash
npm run dist
```

This uses `electron-builder` to produce a `.dmg` (macOS), `.exe`/NSIS
installer (Windows), or `.AppImage` (Linux) in a `dist/` folder, so you can
install the widget like a normal app instead of running it from source.

## Project structure

```
weather-widget/
├─ main.js        # Electron main process — window, tray, drag support
├─ preload.js      # Safe bridge between main and renderer
├─ index.html      # Widget markup
├─ style.css       # Pixel-art styling (matches the Figma file 1:1)
├─ renderer.js     # App logic: state, rendering, weather + geocoding calls
├─ cities.js        # The 50 famous quick-pick cities (lat/lon)
└─ package.json
```

## Notes

- Weather and city search both call the public Open-Meteo APIs directly
  from the widget, so an internet connection is required.
- Temperatures/wind are fetched in °F/mph and converted client-side for °C —
  this keeps a single API call fast and avoids re-fetching on unit toggle.
- The window is frameless and transparent; drag it by the title bar. Resize
  from any edge like a normal window.
