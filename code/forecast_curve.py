"""Nvidia CEO departure model: chance Jensen Huang has left as CEO before each date.

First version 2026-11-09. Edit the inputs in model/inputs.json and rerun:
    python forecast_curve.py
Prints the forecast at the market's dates and writes forecast_curve.csv next to this file.

Three ways he leaves:
  Light     Something improper beyond the affair comes to light, and he leaves.
            p_light * p_out_if_light * played(t)
  Quiet     Nothing more comes to light, and he leaves over the scandal anyway.
            (1 - p_light) * p_out_if_not * played(t)
  Ordinary  He leaves for an unrelated reason, at a constant yearly rate.
            1 - exp(-ordinary * years)

played(t) is the share of the scandal's exits that have happened by t: half are set in motion
by median_days, three quarters by twice that, and so on; each takes lag_days more to become an
actual departure. Light and Quiet cannot both happen, so they add. Ordinary is independent.
"""
import csv
import json
import math
from datetime import date, timedelta
from pathlib import Path

INPUTS_FILE = Path(__file__).resolve().parent.parent / "model" / "inputs.json"
_cfg = json.loads(INPUTS_FILE.read_text(encoding="utf-8"))
_d = date.fromisoformat
TODAY = _d(_cfg["as_of"])
MARKET_DATES = [_d(s) for s in _cfg["market_dates"]]
# Each input is (central, low case, high case).
P_LIGHT, P_OUT_IF_LIGHT, P_OUT_IF_NOT, MEDIAN_DAYS, LAG_DAYS, ORDINARY = (
    tuple(_cfg["inputs"][name][k] for k in ("central", "low_case", "high_case"))
    for name in ("P_LIGHT", "P_OUT_IF_LIGHT", "P_OUT_IF_NOT", "MEDIAN_DAYS", "LAG_DAYS", "ORDINARY")
)


def played(n, median, lag):
    x = n - lag
    return 0.0 if x <= 0 else 1 - 0.5 ** (x / median)


def total(t, i=0):
    """i = 0 central, 1 low case, 2 high case."""
    n = (t - TODAY).days
    f = played(n, MEDIAN_DAYS[i], LAG_DAYS[i])
    light = P_LIGHT[i] * P_OUT_IF_LIGHT[i] * f
    quiet = (1 - P_LIGHT[i]) * P_OUT_IF_NOT[i] * f
    ordinary = 1 - math.exp(-ORDINARY[i] * max(n, 0) / 365.25)
    return {"light": light, "quiet": quiet, "ord": ordinary, "total": 1 - (1 - light - quiet) * (1 - ordinary)}


def after(t, span, i=0):
    """Chance he leaves within `span` days after t, given he is still CEO at t."""
    a = total(t, i)["total"]
    b = total(t + timedelta(days=span), i)["total"]
    return 0.0 if a >= 1 else (b - a) / (1 - a)


if __name__ == "__main__":
    print(f"As of {TODAY}")
    print(f"{'Before':<12} {'Left':>7} {'Low':>7} {'High':>7} {'Next 12 months if still CEO':>30}")
    for t in MARKET_DATES:
        c = total(t)
        print(f"{t.isoformat():<12} {c['total']:>7.1%} {total(t, 1)['total']:>7.1%} {total(t, 2)['total']:>7.1%} {after(t, 365):>30.1%}")

    out = Path(__file__).resolve().parent / "forecast_curve.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "light", "quiet", "ordinary", "total", "low_case", "high_case"])
        t = TODAY
        end = MARKET_DATES[-1]
        dates = set(MARKET_DATES)
        while t <= end:
            dates.add(t)
            t += timedelta(days=7)
        for t in sorted(dates):
            c = total(t)
            w.writerow([t.isoformat()] + [f"{v:.6f}" for v in (c["light"], c["quiet"], c["ord"], c["total"], total(t, 1)["total"], total(t, 2)["total"])])
    print(f"Wrote {out.name}")
