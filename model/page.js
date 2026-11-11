// The Model page for this event. The maths is in model.js; the shared look and controls come from eventneutral.com/kit/v1.
fetch('inputs.json', { cache: 'no-cache' }).then((r) => r.json()).then((cfg) => {
  const M = window.ForecastModel.fromConfig(cfg);
  const { pct } = EN.fmt;
  const DAY = 86400000;
  const YEAR = 365.25 * DAY;
  const fmtDate = d3.utcFormat('%b %-d, %Y');
  const n1 = (v) => `${+(v * 100).toFixed(1)}%`;

  // footnote marker for a source in the page's Sources list (same order as the list in index.html)
  const ORDER = ['board', 'email', 'nbc', 'terms', 'ces', 'house'];
  const fn = (k) => { const n = ORDER.indexOf(k) + 1; return `<sup class="fn"><a href="#s${n}">${n}</a></sup>`; };

  const GROUPS = [
    { key: 'light', cls: 's-light', name: 'The critical question' },
    { key: 'time', cls: 's-time', name: 'Timing' },
    { key: 'ord', cls: 's-ord', name: 'Unrelated exits' },
  ];
  // pct: shown as a percentage. key matches M.DEFAULTS. note says what the slider measures, where the label alone
  // is not enough; the reasoning behind each default is in "Why these numbers" on the page.
  const INPUTS = [
    { key: 'P_LIGHT', group: 'light', label: 'Chance that something improper happened and comes to light', pct: true, step: 1,
      note: 'Beyond the admitted affair: a conflict of interest, a preference given to the customer, information passed, that he knew, or misconduct such as a relationship with a direct report. Found and made public, not only true.' },
    { key: 'P_OUT_IF_LIGHT', group: 'light', label: 'Chance he leaves, if something improper comes to light', pct: true, step: 1 },
    { key: 'P_OUT_IF_NOT', group: 'light', label: 'Chance he leaves over the scandal, if nothing more comes to light', pct: true, step: 0.5, sliderMax: 40 },
    { key: 'MEDIAN_DAYS', group: 'time', label: 'Median days until he has left, if he leaves over the scandal', unit: 'days', step: 1, min: 1, max: 1500, sliderMax: 120,
      note: `Counted from Nov 11, 2026. He is as likely to have left before this many days as after. The market counts only an actual departure; an announced future exit does not count.${fn('terms')}` },
    { key: 'ORDINARY', group: 'ord', label: 'Chance per year he leaves for a reason unrelated to the scandal', pct: true, step: 0.5, sliderMax: 15 },
  ];
  const CASES = ['medium', 'low', 'high']; // index order in M.DEFAULTS

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let params = clone(M.DEFAULTS);
  let end = 0;      // right edge of the chart
  let rows = [];    // curve points up to `end`
  let sel = M.MARKET_DATES[0]; // the date the sentence describes
  let flow = null;

  // ---------- inputs ----------
  const fields = {};
  const hows = {};
  const root = document.getElementById('inputs');
  const el = (tag, cls, parent, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; if (parent) parent.appendChild(n); return n; };
  const shown = (inp, v) => (inp.pct ? v * 100 : v);
  const stored = (inp, v) => (inp.pct ? v / 100 : v);
  // An input whose low and high cases start equal to its central value has no range:
  // it shows one number, and all three cases move together.
  const tied = (inp) => { const d = M.DEFAULTS[inp.key]; return d[0] === d[1] && d[0] === d[2]; };

  GROUPS.forEach((group) => {
    const sec = el('section', `group ${group.cls}`, root);
    el('h3', '', sec, group.name);
    hows[group.key] = el('p', 'how', sec);
    INPUTS.filter((inp) => inp.group === group.key).forEach((inp) => {
      const one = tied(inp);
      const row = el('div', one ? 'field one' : 'field', sec);
      el('div', 'name', row, inp.label);
      const base = { min: inp.min || 0, max: inp.pct ? 100 : inp.max, step: inp.step, unit: inp.pct ? '%' : inp.unit };
      const set = (i) => (v) => {
        if (one) params[inp.key] = [0, 1, 2].map(() => stored(inp, v));
        else params[inp.key][i] = stored(inp, v);
        changed();
      };
      const central = EN.sliderField({ ...base, value: shown(inp, params[inp.key][0]), sliderMin: inp.sliderMin, sliderMax: inp.sliderMax, label: `${inp.label}, medium`, onChange: set(0) });
      row.appendChild(central.range);
      central.box.el.classList.add('central');
      // the number boxes sit in the order low, medium, high
      const cases = el('div', 'cases', row);
      const boxes = [central.box];
      const tag = (b, text) => b.el.insertBefore(el('span', 'case-label', null, text), b.el.firstChild);
      const side = (i, text) => {
        const b = EN.numberBox({ ...base, value: shown(inp, params[inp.key][i]), label: `${inp.label}, ${CASES[i]}`, onChange: set(i) });
        tag(b, text);
        cases.appendChild(b.el);
        boxes[i] = b;
      };
      if (!one) side(1, 'Low');
      tag(central.box, 'Medium');
      cases.appendChild(central.box.el);
      if (!one) side(2, 'High');
      if (inp.note) el('p', 'note', row).innerHTML = inp.note;
      fields[inp.key] = { inp, central, boxes };
    });
  });

  function syncInputs() {
    let any = false;
    INPUTS.forEach((inp) => {
      const f = fields[inp.key], p = params[inp.key];
      f.central.set(shown(inp, p[0]));
      f.central.setBand(shown(inp, p[1]), shown(inp, p[2]));
      f.boxes.forEach((b, i) => {
        if (i) b.set(shown(inp, p[i]));
        b.input.classList.toggle('changed', Math.abs(p[i] - M.DEFAULTS[inp.key][i]) > 1e-12);
      });
      any = any || p.some((v, i) => Math.abs(v - M.DEFAULTS[inp.key][i]) > 1e-12);
    });
    resetBtn.disabled = !any;
  }

  const resetBtn = document.getElementById('reset');
  resetBtn.textContent = `Reset to ${M.AS_OF} values`;
  resetBtn.addEventListener('click', () => { params = clone(M.DEFAULTS); changed(); });
  document.querySelectorAll('input[name="horizon"]').forEach((r) => r.addEventListener('change', changed));

  // ---------- the critical question, drawn as a tree ----------
  // Two branches, each ending in "he leaves" or "he stays". Every bar is on the same 0 to 100% scale,
  // so a bar's length is that outcome's share of all cases. Unrelated exits are not in this picture.
  flow = EN.chart.frame(document.getElementById('flow'), () => 338, ({ svg, width }) => {
    svg.selectAll('*').remove();
    const pl = params.P_LIGHT[0], py = params.P_OUT_IF_LIGHT[0], pn = params.P_OUT_IF_NOT[0];
    const faint = 'var(--ink-faint)';
    const rows = [
      { lvl: 0, name: 'Something improper comes to light', parts: [[pl, 'var(--s1)']] },
      { lvl: 1, name: `He leaves, ${n1(py)} of the time`, parts: [[pl * py, 'var(--s1)']] },
      { lvl: 1, name: `He stays, ${n1(1 - py)} of the time`, parts: [[pl * (1 - py), faint]], last: true },
      { lvl: 0, name: 'Nothing more comes to light', parts: [[1 - pl, faint]], gap: 10 },
      { lvl: 1, name: `He leaves anyway, ${n1(pn)} of the time`, parts: [[(1 - pl) * pn, 'var(--s2)']] },
      { lvl: 1, name: `He stays, ${n1(1 - pn)} of the time`, parts: [[(1 - pl) * (1 - pn), faint]], last: true },
      { lvl: 0, name: 'He leaves over the scandal, either way', parts: [[pl * py, 'var(--s1)'], [(1 - pl) * pn, 'var(--s2)']], gap: 22, rule: true },
    ];
    svg.attr('aria-label', rows.map((r) => `${r.name}: ${n1(d3.sum(r.parts, (q) => q[0]))}`).join('. '));
    const indent = 22, step = 42, scale = width - indent;
    const g = svg.append('g');
    let y = 0, parentY = 0;
    rows.forEach((r) => {
      y += r.gap || 0;
      const x0 = r.lvl ? indent : 0;
      if (r.rule) g.append('line').attr('x1', 0).attr('x2', width).attr('y1', y - 10).attr('y2', y - 10).attr('stroke', 'var(--line)');
      if (r.lvl) {
        // the elbow from the branch above to this outcome
        g.append('path').attr('d', `M7,${parentY}V${y + 27}H${indent - 5}`).attr('fill', 'none').attr('stroke', 'var(--line)').attr('stroke-width', 1.5);
      } else parentY = y + 34;
      g.append('text').attr('class', r.lvl ? 'leaf' : 'branch').attr('x', x0).attr('y', y + 15).text(r.name);
      g.append('text').attr('class', r.lvl ? 'leaf-val' : 'val').attr('x', width).attr('y', y + 15).attr('text-anchor', 'end').text(n1(d3.sum(r.parts, (q) => q[0])));
      let x = x0;
      r.parts.forEach(([v, tone]) => {
        g.append('rect').attr('x', x).attr('y', y + 23).attr('width', Math.max(v * scale, 0)).attr('height', r.lvl ? 7 : 9).attr('rx', 1.5)
          .attr('fill', tone).attr('fill-opacity', tone === faint ? 0.6 : 1);
        x += v * scale;
      });
      y += step;
    });
  });

  // ---------- chart ----------
  // The three ways he leaves are drawn stacked, so their heights add up to the chance he has left.
  // (The exact total is a little less than the plain sum, so each layer is scaled by total / sum.)
  const LAYERS = [
    { key: 'light', name: 'Something came to light', tone: 'var(--s1)' },
    { key: 'quiet', name: 'Nothing more came to light', tone: 'var(--s2)' },
    { key: 'ord', name: 'Unrelated', tone: 'var(--s3)' },
  ];
  const stack = (r) => {
    const sum = r.light + r.quiet + r.ord;
    const f = sum > 0 ? r.total / sum : 0;
    const a = r.light * f, b = a + r.quiet * f;
    return { light: [0, a], quiet: [a, b], ord: [b, r.total] };
  };
  const box = document.getElementById('chart');
  let G = null;               // the chart's persistent pieces, rebuilt only on resize
  let x = null, y = null;

  const nearest = (t) => rows.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  const rowAt = (t) => rows.find((r) => r.t === t) || nearest(t);

  EN.chart.frame(box, (w) => Math.max(260, Math.min(430, w * 0.56)), ({ svg, width, height }) => {
    const wide = width > 640;
    const m = { t: 30, r: wide ? 200 : 10, b: 30, l: 46 };
    svg.selectAll('*').remove();
    svg.attr('aria-label', 'Chance he has left before each date, in total and by cause');
    G = { width, height, m, wide };
    G.grid = svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`);
    G.yAxis = svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`);
    G.xAxis = svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.b})`);
    G.band = svg.append('path').attr('fill', 'var(--band)');
    G.edges = svg.append('g').attr('fill', 'none').attr('stroke-width', 1.5);
    LAYERS.slice(0, 2).forEach((l) => G.edges.append('path').attr('data-k', l.key).attr('stroke', l.tone));
    G.total = svg.append('path').attr('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 2.75).attr('stroke-linejoin', 'round');
    G.dots = svg.append('g');
    G.labels = svg.append('g');

    // drag anywhere on the plot to pick a date
    G.hit = svg.append('rect').attr('class', 'plot-hit').attr('x', m.l).attr('y', 0).attr('width', width - m.l - m.r).attr('height', height - m.b)
      .attr('fill', 'transparent').attr('tabindex', 0).attr('role', 'slider').attr('aria-label', 'Date');
    G.cursor = svg.append('g').attr('class', 'cursor').attr('pointer-events', 'none');
    G.cursor.append('line').attr('y1', m.t - 6).attr('y2', height - m.b).attr('stroke', 'var(--ink-soft)');
    G.cursor.append('circle').attr('class', 'grip').attr('cy', m.t - 6).attr('r', 5).attr('fill', 'var(--ink)').attr('stroke', 'var(--bg)').attr('stroke-width', 2);
    G.cursorText = G.cursor.append('text').attr('class', 'note').attr('y', m.t - 16).style('fill', 'var(--ink)');
    G.marks = G.cursor.append('g');

    const px = (e) => e.clientX - box.getBoundingClientRect().left;
    const hit = G.hit.node();
    const move = (p) => { sel = nearest(+x.invert(p)).t; paint(); };
    hit.addEventListener('pointerdown', (e) => { hit.setPointerCapture(e.pointerId); move(px(e)); e.preventDefault(); hit.focus({ preventScroll: true }); });
    hit.addEventListener('pointermove', (e) => { if (hit.hasPointerCapture(e.pointerId)) move(px(e)); });
    G.hit.on('keydown', (e) => {
      const i = rows.findIndex((r) => r.t === sel);
      const j = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: rows.length - 1 }[e.key];
      if (j == null) return;
      e.preventDefault();
      sel = rows[Math.max(0, Math.min(rows.length - 1, j))].t;
      paint();
    });
    paint();
  });

  // Recompute the curve, then repaint. Called when an input or the chart's end date changes.
  function changed() {
    const [hy, hm, hd] = document.querySelector('input[name="horizon"]:checked').value.split('-').map(Number);
    end = M.d(hy, hm, hd);
    rows = [{ t: M.TODAY, light: 0, quiet: 0, ord: 0, played: 0, total: 0, low: 0, high: 0 }].concat(M.curve(params, end));
    sel = nearest(Math.min(sel, end)).t;
    syncInputs();
    paint();
    if (flow) flow.redraw();
  }

  function paint() {
    if (!G || !rows.length) return;
    const { width, height, m, wide } = G;
    const top = Math.max(...rows.map((r) => Math.max(r.high, r.total, r.low)), 0.01);
    x = d3.scaleUtc([M.TODAY, end], [m.l, width - m.r]);
    y = d3.scaleLinear([0, Math.min(1, top * 1.06)], [height - m.b, m.t]).nice(5);
    const plot = width - m.l - m.r;
    const months = (end - M.TODAY) / YEAR * 12;

    G.grid.call(d3.axisLeft(y).ticks(5).tickSize(-plot).tickFormat(''));
    G.yAxis.call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8).tickFormat((v) => Math.round(v * 100) + '%')).call((g) => g.select('.domain').remove());
    if (months <= 2) {
      // a few weeks: label days, as many as fit
      const days = (end - M.TODAY) / 86400000;
      const step = [1, 2, 3, 5, 7, 14].find((s) => days / s <= plot / 56) || 14;
      G.xAxis.call(d3.axisBottom(x).ticks(d3.utcDay.every(step)).tickSize(5).tickPadding(6).tickFormat(d3.utcFormat('%b %-d')));
    } else if (months <= 30) {
      // a short view: label months, as many as fit
      const step = [1, 2, 3, 6, 12].find((s) => months / s <= plot / 84) || 12;
      G.xAxis.call(d3.axisBottom(x).ticks(d3.utcMonth.every(step)).tickSize(5).tickPadding(6).tickFormat(d3.utcFormat('%b %Y')));
    } else {
      const every = Math.max(1, Math.ceil((months / 12) / (plot / 64)));
      G.xAxis.call(d3.axisBottom(x).ticks(d3.utcYear.every(every)).tickSize(5).tickPadding(6).tickFormat(d3.utcFormat('%Y')));
    }

    const st = rows.map(stack);
    LAYERS.slice(0, 2).forEach((l) => G.edges.select(`[data-k="${l.key}"]`).attr('d', d3.line().x((r) => x(r.t)).y((r, i) => y(st[i][l.key][1]))(rows)));
    G.band.attr('d', d3.area().x((r) => x(r.t)).y0((r) => y(r.low)).y1((r) => y(r.high))(rows));
    G.total.attr('d', d3.line().x((r) => x(r.t)).y((r) => y(r.total))(rows));

    // the market's dates
    G.dots.selectAll('circle').data(M.MARKET_DATES.filter((t) => t <= end)).join('circle')
      .attr('r', 4).attr('fill', 'var(--bg)').attr('stroke', 'var(--ink)').attr('stroke-width', 2)
      .attr('cx', (t) => x(t)).attr('cy', (t) => y(rowAt(t).total));

    // names at the line ends (wide screens; narrow screens use the key above the chart)
    const last = rows[rows.length - 1], lastSt = st[st.length - 1];
    const ends = wide ? EN.chart.dodge(
      [{ key: 'total', name: 'Chance he has left', tone: 'var(--ink)', y: y(last.total) - 9 }]
        .concat(LAYERS.map((l) => ({ ...l, y: y((lastSt[l.key][0] + lastSt[l.key][1]) / 2) }))), 18, m.t, height - m.b + 4) : [];
    G.labels.selectAll('text').data(ends, (d) => d.key).join('text')
      .attr('class', 'end-label').attr('x', width - m.r + 10).attr('dy', '0.35em')
      .attr('y', (d) => d.ly).style('fill', (d) => d.tone).text((d) => d.name);

    // the chosen date
    const r = rowAt(sel);
    const cx = x(r.t);
    G.cursor.attr('transform', `translate(${cx},0)`);
    const half = 48;
    G.cursorText.text(fmtDate(new Date(r.t)))
      .attr('text-anchor', cx - half < m.l ? 'start' : cx + half > width ? 'end' : 'middle')
      .attr('x', cx - half < m.l ? -6 : cx + half > width ? 6 : 0);
    G.marks.selectAll('circle').data([r]).join('circle').attr('r', 5)
      .attr('fill', 'var(--ink)').attr('stroke', 'var(--bg)').attr('stroke-width', 1.5).attr('cy', (d) => y(d.total));
    G.hit.attr('aria-valuetext', `${fmtDate(new Date(r.t))}: ${pct(r.total)}`);

    say(r);
    how(r);
  }

  // ---------- the forecast in words ----------
  function say(r) {
    const st = stack(r);
    const part = (cls, name, k) => `<span class="tone ${cls}">${name}</span> ${pct(st[k][1] - st[k][0])}`;
    document.getElementById('say').innerHTML = r.t === M.TODAY
      ? `The forecast starts on <b>${fmtDate(new Date(r.t))}</b>. Pick a later date.`
      : `Before <b>${fmtDate(new Date(r.t))}</b>, the chance he has left is <b>${pct(r.total)}</b>, with a range of ${pct(r.low)} to ${pct(r.high)}. ` +
        `That is ${part('s-light', 'something came to light', 'light')} + ${part('s-quiet', 'nothing more came to light', 'quiet')} + ${part('s-ord', 'unrelated', 'ord')}. ` +
        `If he is still chief executive on that date, the chance he leaves in the following 12 months is <b>${pct(M.after(r.t, 365, params, 0))}</b>.`;
  }

  // ---------- each group's arithmetic for the chosen date ----------
  function how(r) {
    const p = params, date = fmtDate(new Date(r.t));
    const days = M.days(M.TODAY, r.t);
    const ever = p.P_LIGHT[0] * p.P_OUT_IF_LIGHT[0] + (1 - p.P_LIGHT[0]) * p.P_OUT_IF_NOT[0];
    hows.light.textContent = `${n1(p.P_LIGHT[0])} × ${n1(p.P_OUT_IF_LIGHT[0])} + ${n1(1 - p.P_LIGHT[0])} × ${n1(p.P_OUT_IF_NOT[0])} = ${n1(ever)} that he leaves over the scandal at some point`;
    hows.time.textContent = `Before ${date}, ${days} days in: ${n1(r.played)} of the exits over the scandal have happened. ${n1(ever)} × ${n1(r.played)} = ${n1(r.light + r.quiet)}`;
    hows.ord.textContent = `Before ${date}: ${n1(p.ORDINARY[0])} a year over ${(days / 365.25).toFixed(1)} years = ${n1(r.ord)}`;
  }

  changed();
}).catch((e) => {
  document.getElementById('chart').insertAdjacentHTML('afterbegin', '<p class="muted">The model inputs could not be loaded. Reload the page.</p>');
  console.error(e);
});
