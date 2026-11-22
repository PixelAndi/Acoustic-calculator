/*
 * Shared page logic for all absorber calculators (porous, perforated,
 * slotted, microperforated, membrane). Needs core.js (AC) and ui.js (UI).
 */
(function (root) {
  'use strict';
  const { el, fmt, fmtHz } = UI;

  const OCTAVES = {
    63: [50, 63, 80],
    125: [100, 125, 160],
    250: [200, 250, 315],
    500: [400, 500, 630],
    1000: [800, 1000, 1250],
    2000: [1600, 2000, 2500],
    4000: [3150, 4000, 5000],
    8000: [6300, 8000, 10000],
  };

  const COMMON_FIELDS = (opts) => [
    { group: 'Sound field' },
    {
      id: 'incidence',
      label: 'Incident sound',
      type: 'select',
      value: 'normal',
      options: [
        { value: 'normal', label: 'Normal (0°)' },
        { value: 'angle', label: 'One angle' },
        { value: 'diffuse', label: 'Diffuse (random)' },
      ],
      help: 'Diffuse is closest to a room. Normal is the same as an impedance-tube test.',
    },
    { id: 'angle', label: 'Angle from normal', unit: '°', value: 45, min: 0, max: 89, showIf: (v) => v.incidence === 'angle' },
    ...(opts.cavityOption
      ? [
          {
            id: 'local',
            label: 'Cavity has partitions (honeycomb or grid)',
            type: 'checkbox',
            value: false,
          },
        ]
      : []),
    { group: 'Air' },
    { id: 'temp', label: 'Air temperature', unit: '°C', value: 20, min: -20, max: 50 },
  ];

  /* ---------- cross-section diagram ---------- */
  function diagram(container, parts) {
    // parts: list from the ROOM side to the WALL: {kind:'facing'|'porous'|'air'|'membrane', label, mm}
    container.innerHTML = '';
    const W = 360;
    const H = 150;
    const total = parts.reduce((s, p) => s + Math.max(p.mm, 1), 0) || 1;
    const avail = W - 84;
    let x = 46;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Cross-section of the construction');
    const mk = (tag, a) => {
      const e = document.createElementNS(NS, tag);
      for (const k in a) e.setAttribute(k, a[k]);
      svg.append(e);
      return e;
    };
    const txt = (x0, y0, s, anchor = 'middle') => {
      const t = mk('text', { x: x0, y: y0, 'text-anchor': anchor });
      t.textContent = s;
    };
    // sound arrow
    mk('line', { x1: 6, y1: 40, x2: 38, y2: 40, stroke: UI.cssVar('--muted'), 'stroke-width': 2 });
    mk('path', { d: 'M38,36 L44,40 L38,44 Z', fill: UI.cssVar('--muted') });
    txt(4, 30, 'Sound', 'start');
    const minW = 10;
    for (const p of parts) {
      let w = (Math.max(p.mm, 1) / total) * avail;
      if (p.kind === 'facing' || p.kind === 'membrane') w = Math.max(minW, Math.min(w, 18));
      else w = Math.max(w, 18);
      let fill;
      if (p.kind === 'porous') fill = '#d8c27a';
      else if (p.kind === 'air') fill = 'none';
      else fill = '#9aa4ad';
      mk('rect', {
        x,
        y: 20,
        width: w,
        height: 90,
        fill,
        stroke: UI.cssVar('--border'),
        'stroke-dasharray': p.kind === 'air' ? '3 3' : '',
      });
      if (p.kind === 'facing') {
        // draw openings
        for (let yy = 30; yy < 105; yy += 16) mk('rect', { x, y: yy, width: w, height: 5, fill: UI.cssVar('--surface') });
      }
      txt(x + w / 2, 124, p.mm >= 10 ? Math.round(p.mm) + ' mm' : (+p.mm.toFixed(2)) + ' mm');
      const lab = mk('text', { x: x + w / 2, y: 142, 'text-anchor': 'middle' });
      lab.textContent = p.label;
      x += w;
    }
    // wall
    mk('rect', { x, y: 10, width: 14, height: 110, fill: UI.cssVar('--muted') });
    txt(x + 7, 8, 'Wall');
    container.append(svg);
  }

  /**
   * opts = { name, fields, build(v, air) → { construction, parts, info, resonance, notes } , cavityOption }
   */
  function init(mount, opts) {
    const inputs = el('div', { class: 'card' });
    const diag = el('div', { class: 'diagram' });
    const derived = el('div', { class: 'derived' });
    inputs.append(el('h2', {}, 'Inputs'), diag, derived);
    const formBox = el('div');
    inputs.append(formBox);
    const linkBtn = el('button', { class: 'btn', type: 'button' }, 'Copy link to these inputs');
    UI.copyLink(linkBtn);
    inputs.append(el('div', { class: 'btn-row' }, linkBtn));

    const kpiBox = el('div');
    const chartBox = el('div');
    const pinBtn = el('button', { class: 'btn', type: 'button' }, 'Keep curve for comparison');
    const clearBtn = el('button', { class: 'btn', type: 'button' }, 'Clear kept curves');
    const csvBtn = el('button', { class: 'btn', type: 'button' }, 'Download CSV');
    const sendBtn = el('button', { class: 'btn primary', type: 'button' }, 'Save result for other pages');
    const saveMsg = el('div', { class: 'derived', role: 'status' });
    const notesBox = el('div');
    const bandBox = el('div');
    const bandTabs = el('div', { class: 'tabs', role: 'tablist' });
    let bandMode = 'third';
    const mkTab = (id, label) =>
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': id === bandMode ? 'true' : 'false',
          onclick: (e) => {
            bandMode = id;
            [...bandTabs.children].forEach((b) => b.setAttribute('aria-selected', 'false'));
            e.currentTarget.setAttribute('aria-selected', 'true');
            renderBands();
          },
        },
        label
      );
    bandTabs.append(mkTab('third', '1/3 octave'), mkTab('octave', 'Octave'));

    const out = el(
      'div',
      {},
      el(
        'div',
        { class: 'card' },
        el('h2', {}, 'Results'),
        kpiBox,
        chartBox,
        el('div', { class: 'btn-row' }, pinBtn, clearBtn, csvBtn, sendBtn),
        saveMsg,
        notesBox
      ),
      el('div', { class: 'card' }, el('h2', {}, 'Absorption coefficient by band'), bandTabs, bandBox)
    );
    mount.classList.add('calc');
    mount.append(inputs, out);

    const pinned = [];
    let last = null;

    function compute(v, ok) {
      if (!ok) {
        UI.notes(notesBox, [{ level: 'error', text: 'One or more inputs are not correct. Correct the inputs that show in red.' }]);
        return;
      }
      const a = AC.air(v.temp);
      let b;
      try {
        b = opts.build(v, a);
      } catch (e) {
        UI.notes(notesBox, [{ level: 'error', text: e.message }]);
        return;
      }
      if (b.error) {
        UI.notes(notesBox, [{ level: 'error', text: b.error }]);
        return;
      }
      const cons = { ...b.construction, localReaction: !!v.local };
      const inc = { mode: v.incidence, angleDeg: v.angle };
      const alphaAt = (f) => AC.absorption(f, a, cons, inc).alpha;
      const freqs = AC.logFrequencies(50, 10000, 24);
      const curve = freqs.map((f) => [f, alphaAt(f)]);
      const third = {};
      for (const n of AC.THIRD_OCTAVE_NOMINAL) third[n] = AC.thirdOctaveBandMean(alphaAt, n);
      const octave = {};
      for (const o of Object.keys(OCTAVES)) octave[o] = OCTAVES[o].reduce((s, n) => s + third[n], 0) / 3;
      const rt = AC.ratings(third);

      let peak = curve[0];
      for (const p of curve) if (p[1] > peak[1]) peak = p;

      const incLabel = v.incidence === 'normal' ? 'normal incidence' : v.incidence === 'angle' ? `${v.angle}° incidence` : 'diffuse field';
      last = { curve, third, octave, rt, name: `${opts.name} – ${b.short || ''} (${incLabel})`, v };

      // Derived values + diagram
      diagram(diag, b.parts);
      derived.innerHTML = '';
      for (const [label, value] of b.info || []) derived.append(el('div', {}, label + ': ', el('b', {}, value)));
      derived.append(el('div', {}, 'Speed of sound: ', el('b', {}, fmt(a.c, 1) + ' m/s'), ' · Air density: ', el('b', {}, fmt(a.rho, 3) + ' kg/m³')));

      // KPIs
      const k = [
        { label: 'Peak absorption', value: fmt(peak[1]), sub: 'at ' + fmtHz(peak[0]) },
        { label: 'NRC', value: rt.nrc ? fmt(rt.nrc.value) : '–', sub: 'ASTM C423 method' },
        { label: 'αw', value: rt.alphaW ? fmt(rt.alphaW.value) + (rt.alphaW.indicators ? ` (${rt.alphaW.indicators})` : '') : '–', sub: rt.alphaW ? 'Class ' + rt.alphaW.cls + ' · ISO 11654 method' : '' },
        { label: 'SAA', value: rt.saa ? fmt(rt.saa.value) : '–', sub: 'ASTM C423 method' },
      ];
      if (b.resonance) k.splice(1, 0, { label: b.resonance.label, value: fmtHz(b.resonance.f), sub: b.resonance.sub || 'formula estimate' });
      UI.kpis(kpiBox, k);

      // Chart
      const minY = Math.min(0, ...curve.map((p) => p[1]));
      const series = [
        ...pinned.map((p) => ({ name: p.name, points: p.curve, dash: true })),
        { name: last.name, points: curve, width: 2.5 },
      ];
      UI.chart(chartBox, {
        series,
        legend: true,
        xMin: 50,
        xMax: 10000,
        yMin: minY < 0 ? -0.1 : 0,
        yMax: 1,
        xTicks: [63, 125, 250, 500, 1000, 2000, 4000, 8000],
        xFmt: (x, hover) => (hover ? fmtHz(x) : UI.freqTickFmt(x)),
        yTicks: minY < 0 ? [-0.1, 0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 0.2, 0.4, 0.6, 0.8, 1],
        yFmt: (y, hover) => fmt(y, hover ? 2 : 1),
        xLabel: 'Frequency (Hz)',
        yLabel: 'Absorption coefficient α',
        ariaLabel: 'Absorption coefficient against frequency',
      });

      // Notes
      const n = [];
      for (const L of cons.layers) {
        if (L.type !== 'porous' || !(L.thickness > 0)) continue;
        // X = ρ0 f/σ (Delany & Bazley) or f/σ (Miki); tested range 0.01 ≤ X ≤ 1.0
        const k = L.model === 'miki' ? 1 : a.rho;
        const fLo = (0.01 * L.sigma) / k;
        const fHi = L.sigma / k;
        const parts = [];
        if (fLo > 50) parts.push('below ' + fmtHz(fLo));
        if (fHi < 10000) parts.push('above ' + fmtHz(fHi));
        if (parts.length)
          n.push({
            level: 'warn',
            text: `The porous model is outside its tested range (0.01 ≤ X ≤ 1.0) ${parts.join(' and ')} for σ = ${L.sigma.toLocaleString('en-GB')} Pa·s/m². Results there are less accurate.`,
          });
        break;
      }
      if (minY < 0)
        n.push({
          level: 'warn',
          text: 'The curve has negative values. This is a known error of the Delany & Bazley model at low frequencies. Real absorption is not negative. Try the Miki model. The ratings use 0 for negative values.',
        });
      for (const x of b.notes || []) n.push(x);
      n.push({
        text:
          'NRC, SAA and αw use the rules of ASTM C423 and ISO 11654. These standards use measured values from a reverberation room. Here the values come from a prediction, so they are only estimates.' +
          (v.incidence !== 'diffuse' ? ' For the best estimate, set "Incident sound" to "Diffuse".' : ''),
      });
      UI.notes(notesBox, n);
      renderBands();
    }

    function renderBands() {
      if (!last) return;
      const neg = (x) => ({ text: fmt(x), neg: x < 0 });
      if (bandMode === 'third') {
        UI.table(
          bandBox,
          ['Band (Hz)', 'α'],
          AC.THIRD_OCTAVE_NOMINAL.map((n) => [String(n), neg(last.third[n])]),
          { negClass: true }
        );
      } else {
        const pr = last.rt.practical || {};
        UI.table(
          bandBox,
          ['Octave (Hz)', 'α (mean of 3 bands)', 'αp (ISO 11654)'],
          Object.keys(OCTAVES).map((o) => [o, neg(last.octave[o]), pr[o] !== undefined ? fmt(pr[o]) : '–']),
          { negClass: true }
        );
      }
      bandBox.append(
        el('p', { class: 'help', style: 'font-size:0.8rem;color:var(--muted)' }, 'Each band value is the mean of 7 points in the band. αp is the practical sound absorption coefficient of ISO 11654.')
      );
    }

    pinBtn.addEventListener('click', () => {
      if (!last) return;
      if (pinned.length >= 4) pinned.shift();
      pinned.push({ name: last.name, curve: last.curve });
      f.update();
    });
    clearBtn.addEventListener('click', () => {
      pinned.length = 0;
      f.update();
    });
    csvBtn.addEventListener('click', () => {
      if (!last) return;
      const rows = [];
      rows.push(['# ' + last.name]);
      rows.push(['# Inputs: ' + Object.entries(last.v).map(([k, x]) => `${k}=${x}`).join('; ')]);
      rows.push(['Frequency (Hz)', 'alpha']);
      for (const [fr, al] of last.curve) rows.push([fr.toFixed(1), al.toFixed(4)]);
      rows.push([]);
      rows.push(['1/3-octave band (Hz)', 'alpha (band mean)']);
      for (const nb of AC.THIRD_OCTAVE_NOMINAL) rows.push([nb, last.third[nb].toFixed(4)]);
      UI.downloadCsv(opts.file || 'absorption.csv', [], rows);
    });
    sendBtn.addEventListener('click', () => {
      if (!last) return;
      const oct = {};
      for (const o of [125, 250, 500, 1000, 2000, 4000]) oct[o] = Math.max(0, last.octave[o]);
      UI.savePanelResult(last.name, oct);
      saveMsg.innerHTML = '';
      saveMsg.append('Saved. Open the ', el('a', { href: 'reverberation.html' }, 'reverberation'), ' or ', el('a', { href: 'ratings.html' }, 'ratings'), ' page and click "Load last panel result".');
    });

    const f = UI.form(formBox, [...opts.fields, ...COMMON_FIELDS(opts)], compute);
    document.addEventListener('themechange', () => f.update());
    return f;
  }

  /** Shared input definitions for a porous layer. */
  const porousModelField = {
    id: 'model',
    label: 'Porous model',
    type: 'select',
    value: 'db',
    options: [
      { value: 'db', label: 'Delany & Bazley (1970)' },
      { value: 'miki', label: 'Miki (1990)' },
    ],
  };
  const sigmaField = (value = 10000) => ({
    id: 'sigma',
    label: 'Flow resistivity σ',
    unit: 'Pa·s/m²',
    value,
    min: 100,
    max: 1000000,
    exclusiveMin: true,
    help: 'Also called rayl/m. Get this value from the data sheet, or use the flow resistivity page.',
  });

  const cavityFields = [
    { group: 'Cavity' },
    { id: 'depth', label: 'Cavity depth (panel to wall)', unit: 'mm', value: 50, min: 1, max: 2000 },
    { id: 'ta', label: 'Porous absorber thickness', unit: 'mm', value: 50, min: 0, max: 2000, help: 'Type 0 for an empty cavity.' },
    { id: 'pos', label: 'Absorber position', type: 'select', value: 'panel', options: [
      { value: 'panel', label: 'Against the panel' }, { value: 'wall', label: 'Against the wall' }],
      showIf: (v) => v.ta > 0 && v.ta < v.depth },
    { ...sigmaField(10000), showIf: (v) => v.ta > 0 },
    { ...porousModelField, showIf: (v) => v.ta > 0 },
  ];
  function cavity(v) {
    if (v.ta > v.depth) return { error: 'The absorber is thicker than the cavity. Make the absorber thinner or the cavity deeper.' };
    const g = (v.depth - v.ta) / 1000;
    const p = { type: 'porous', thickness: v.ta / 1000, sigma: v.sigma, model: v.model };
    const air = { type: 'air', thickness: g };
    const layers = v.pos === 'wall' ? [p, air] : [air, p];
    const parts = [];
    const pp = { kind: 'porous', label: 'Porous', mm: v.ta };
    const ap = { kind: 'air', label: 'Air', mm: v.depth - v.ta };
    if (v.pos === 'wall') { if (ap.mm > 0) parts.push(ap); if (pp.mm > 0) parts.push(pp); }
    else { if (pp.mm > 0) parts.push(pp); if (ap.mm > 0) parts.push(ap); }
    return { layers, parts };
  }

  root.AbsorberPage = { init, porousModelField, sigmaField, cavityFields, cavity };
})(this);
