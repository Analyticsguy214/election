# Hilltop Election Desk

Live 2026 midterm results, forecasts and prediction-market odds, hosted on GitHub Pages.

- `index.html`, `assets/` – the site. It re-reads `data/` every 30 seconds and pulls Polymarket prices directly every 30 seconds.
- `data/races.json`, `data/meta.json` – race results and control-of-Congress tallies.
- `data/markets.json` – Kalshi and Polymarket odds, refreshed every 5 minutes by `.github/workflows/markets.yml`.
- `scripts/fetch-markets.mjs` – the market updater (public endpoints, no keys).
