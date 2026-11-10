# Jensen Departure Model

A model from [Event Neutral](https://eventneutral.com): will Jensen Huang leave as Nvidia's chief executive? Built around Kalshi's `KXCEONVDA` markets.

- `index.html`: the Question page (served at nvidia-ceo-departure-model.eventneutral.com). `rules/`: the market's rules.
- `model/`: the interactive Model page. `model/model.js` is a line-for-line port of the Python; a change to the math goes in both.
- `model/inputs.json`: the forecast's inputs, read by both the Python and the pages. Edit inputs here only.
- `code/forecast_curve.py`: the same model as a short script. Run it to print the forecast and write a week-by-week CSV.
- The look shared by Event Neutral pages (styles, light/dark switch, D3, sliders) is loaded from `https://eventneutral.com/kit/v1/`. Its source is in the `event-neutral-site` repository.

---

Started 2026-11-09. Nothing here is financial advice.

License: MIT, see [LICENSE](LICENSE).
