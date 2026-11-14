# Ur Family Office: public website

The static site at https://simmyhundal.github.io/ur-family-office-site/. It runs in the browser and uploads nothing.

- `site/`: the pages (plain HTML, CSS and JavaScript).
- `scripts/fetch_site_prices.py` and `src/ufo/providers/prices.py`: fetch public month-end fund prices for `site/data/prices.json` in the deploy workflow.
- `.github/workflows/site.yml`: fetches prices and publishes `site/` to GitHub Pages on every push to `main` and on weekdays.

Information, not investment advice.
