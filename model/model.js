// Forecast model, a line-for-line port of code/forecast_curve.py.
// Both read their inputs from model/inputs.json. Call ForecastModel.fromConfig(parsedJson).
// Works in the browser (window.ForecastModel) and in Node (module.exports) so it can be tested.
(function (root) {
  const DAY = 86400000;
  const KEYS = ['P_LIGHT', 'P_OUT_IF_LIGHT', 'P_OUT_IF_NOT', 'MEDIAN_DAYS', 'LAG_DAYS', 'ORDINARY'];
  const d = (y, m, day) => Date.UTC(y, m - 1, day);
  const parse = (s) => { const [y, m, day] = s.split('-').map(Number); return d(y, m, day); };

  function fromConfig(cfg) {
    const TODAY = parse(cfg.as_of);
    const MARKET_DATES = cfg.market_dates.map(parse);
    // [central, low case, high case], same order as the Python tuples.
    const DEFAULTS = {};
    KEYS.forEach((k) => { const v = cfg.inputs[k]; DEFAULTS[k] = [v.central, v.low_case, v.high_case]; });

    const days = (a, b) => Math.round((b - a) / DAY);

    // Share of the scandal's exits that have happened `n` days in.
    // Half are set in motion by the median, three quarters by twice the median, and so on;
    // each takes `lag` more days to become an actual departure.
    function played(n, median, lag) {
      const x = n - lag;
      return x <= 0 ? 0 : 1 - Math.pow(0.5, x / median);
    }

    // i = 0 central, 1 low case, 2 high case
    function total(t, p, i) {
      const n = days(TODAY, t);
      const f = played(n, p.MEDIAN_DAYS[i], p.LAG_DAYS[i]);
      const light = p.P_LIGHT[i] * p.P_OUT_IF_LIGHT[i] * f;        // something comes to light, and he leaves
      const quiet = (1 - p.P_LIGHT[i]) * p.P_OUT_IF_NOT[i] * f;    // nothing more comes to light, and he leaves anyway
      const ord = 1 - Math.exp(-p.ORDINARY[i] * Math.max(n, 0) / 365.25); // unrelated exit
      return { light, quiet, ord, played: f, total: 1 - (1 - light - quiet) * (1 - ord) };
    }

    // Chance he leaves within `span` days after t, given he is still CEO at t.
    function after(t, span, p, i) {
      const a = total(t, p, i).total;
      const b = total(t + span * DAY, p, i).total;
      return a >= 1 ? 0 : (b - a) / (1 - a);
    }

    // Weekly points from TODAY to `end`, plus the market's dates.
    function curve(p, end) {
      const set = new Set(MARKET_DATES.filter((t) => t <= end));
      for (let t = TODAY + 7 * DAY; t <= end; t += 7 * DAY) set.add(t);
      return [...set].sort((a, b) => a - b).map((t) => {
        const c = total(t, p, 0);
        return { t, ...c, low: total(t, p, 1).total, high: total(t, p, 2).total };
      });
    }

    return { AS_OF: cfg.as_of, TODAY, MARKET_DATES, DEFAULTS, d, days, total, after, curve };
  }

  const api = { fromConfig, d, parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ForecastModel = api;
})(this);
