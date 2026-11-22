/*
 * Acoustic Calculator – shared user-interface helpers (no dependencies).
 * Exposes the global "UI".
 */
(function (root) {
  'use strict';

  const PAGES = [
    { href: 'index.html', label: 'Home' },
    { href: 'advisor.html', label: 'Room advisor' },
    { href: 'panels.html', label: 'Panel types' },
    { href: 'porous.html', label: 'Porous' },
    { href: 'perforated.html', label: 'Perforated' },
    { href: 'slotted.html', label: 'Slotted' },
    { href: 'microperforated.html', label: 'Microperforated' },
    { href: 'membrane.html', label: 'Membrane' },
    { href: 'multilayer.html', label: 'Multilayer' },
    { href: 'clouds.html', label: 'Clouds & baffles' },
    { href: 'diffuser.html', label: 'Diffusers' },
    { href: 'helmholtz-resonator.html', label: 'Resonator' },
    { href: 'resonance.html', label: 'Resonance' },
    { href: 'flow-resistivity.html', label: 'Flow resistivity' },
    { href: 'ratings.html', label: 'NRC / αw' },
    { href: 'reverberation.html', label: 'Reverberation' },
    { href: 'room-modes.html', label: 'Room modes' },
    { href: 'sound-in-air.html', label: 'Sound in air' },
    { href: 'learn.html', label: 'Learn' },
    { href: 'project.html', label: 'Project' },
  ];

  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  };

  /* ---------------- theme + header ---------------- */
  function storageGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }
  function storageSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {
      /* storage blocked: ignore */
    }
  }
  const savedTheme = storageGet('ac-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  function header() {
    const here = location.pathname.split('/').pop() || 'index.html';
    const nav = el(
      'nav',
      { class: 'site-nav', id: 'site-nav', 'aria-label': 'Calculators' },
      PAGES.map((p) => el('a', { href: p.href, 'aria-current': p.href === here ? 'page' : null }, p.label))
    );
    const toggle = el(
      'button',
      {
        class: 'nav-toggle',
        'aria-controls': 'site-nav',
        'aria-expanded': 'false',
        onclick: (e) => {
          const open = nav.classList.toggle('open');
          e.currentTarget.setAttribute('aria-expanded', String(open));
        },
      },
      'Menu'
    );
    const theme = el(
      'button',
      {
        class: 'theme-toggle',
        title: 'Change colour theme',
        onclick: () => {
          const cur =
            document.documentElement.getAttribute('data-theme') ||
            (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          const next = cur === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          storageSet('ac-theme', next);
          document.dispatchEvent(new Event('themechange'));
        },
      },
      'Theme'
    );
    const h = el(
      'header',
      { class: 'site-header' },
      el('div', { class: 'inner' }, el('a', { class: 'brand', href: 'index.html' }, 'Acoustic ', el('span', {}, 'Calculator')), toggle, nav, theme)
    );
    document.body.prepend(h);
    const foot = el(
      'footer',
      { class: 'site-footer' },
      'The results are predictions from published models. They are not measurements. Make sure that you read the limits on each page.'
    );
    document.body.append(foot);
  }

  /* ---------------- number formatting ---------------- */
  function fmt(v, digits = 2) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '–';
    return v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtSig(v, sig = 3) {
    if (!Number.isFinite(v)) return '–';
    if (v === 0) return '0';
    const d = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
    return fmt(v, Math.min(d, 6));
  }
  function fmtHz(f) {
    if (f >= 1000) return (f / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 }) + ' kHz';
    return Math.round(f).toLocaleString('en-GB') + ' Hz';
  }

  /* ---------------- URL state ---------------- */
  function readUrlState() {
    const out = {};
    const h = location.hash.replace(/^#/, '');
    if (!h) return out;
    for (const part of h.split('&')) {
      const [k, v] = part.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
    return out;
  }
  function writeUrlState(values) {
    const s = Object.entries(values)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'boolean' ? (v ? 1 : 0) : v))
      .join('&');
    try {
      history.replaceState(null, '', '#' + s);
    } catch (_) {
      /* ignore */
    }
  }

  /* ---------------- form builder ---------------- */
  /**
   * fields: [{ group } | { id, label, unit, value, min, max, step, type, options, help, showIf }]
   * Returns { values(), setValue(id, v), valid() }.
   */
  function form(container, fields, onChange, opts = {}) {
    const state = opts.urlState === false ? {} : readUrlState();
    const inputs = {};
    const rows = {};
    let fs = null;
    const defs = fields.filter((f) => f.id);
    for (const f of fields) {
      if (f.group) {
        fs = el('fieldset', {}, el('legend', {}, f.group));
        container.append(fs);
        continue;
      }
      if (!fs) {
        fs = el('fieldset');
        container.append(fs);
      }
      const id = 'f-' + f.id;
      let input;
      let row;
      const init = state[f.id] !== undefined ? state[f.id] : f.value;
      if (f.type === 'select') {
        input = el('select', { id }, f.options.map((o) => el('option', { value: o.value }, o.label)));
        input.value = String(init);
        if (input.selectedIndex < 0) input.value = String(f.value);
        row = el('div', { class: 'field' }, el('label', { for: id }, f.label), input);
      } else if (f.type === 'checkbox') {
        input = el('input', { id, type: 'checkbox' });
        input.checked = init === true || init === '1' || init === 'true';
        row = el('div', { class: 'field check' }, input, el('label', { for: id }, f.label));
      } else {
        input = el('input', {
          id,
          type: 'number',
          inputmode: 'decimal',
          step: f.step ?? 'any',
          min: f.min,
          max: f.max,
        });
        input.value = init;
        const wrap = el('div', { class: 'input-wrap' + (f.unit ? ' has-unit' : '') }, input, f.unit ? el('span', { class: 'unit' }, f.unit) : null);
        row = el('div', { class: 'field' }, el('label', { for: id }, f.label), wrap);
      }
      if (f.help) row.append(el('div', { class: 'help' }, f.help));
      fs.append(row);
      inputs[f.id] = input;
      rows[f.id] = row;
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    }

    function rawValues() {
      const v = {};
      for (const f of defs) {
        const i = inputs[f.id];
        if (f.type === 'select') v[f.id] = i.value;
        else if (f.type === 'checkbox') v[f.id] = i.checked;
        else v[f.id] = i.value === '' ? NaN : Number(i.value);
      }
      return v;
    }

    function validate(v) {
      let ok = true;
      for (const f of defs) {
        const row = rows[f.id];
        const visible = !f.showIf || f.showIf(v);
        row.style.display = visible ? '' : 'none';
        const old = row.querySelector('.err');
        if (old) old.remove();
        row.classList.remove('invalid');
        if (!visible || f.type === 'select' || f.type === 'checkbox') continue;
        const x = v[f.id];
        let msg = null;
        if (!Number.isFinite(x)) msg = 'Type a number.';
        else if (f.min !== undefined && (f.exclusiveMin ? x <= f.min : x < f.min))
          msg = `Use a value ${f.exclusiveMin ? 'more than' : 'of'} ${f.min}${f.exclusiveMin ? '' : ' or more'}.`;
        else if (f.max !== undefined && x > f.max) msg = `Use a value of ${f.max} or less.`;
        if (msg) {
          ok = false;
          row.classList.add('invalid');
          row.append(el('div', { class: 'err' }, msg));
        }
      }
      return ok;
    }

    function update() {
      const v = rawValues();
      const ok = validate(v);
      if (opts.urlState !== false) writeUrlState(opts.extraState ? { ...v, ...opts.extraState() } : v);
      onChange(v, ok);
    }

    update();
    return {
      values: rawValues,
      update,
      setValue(id, val) {
        const i = inputs[id];
        if (i.type === 'checkbox') i.checked = !!val;
        else i.value = val;
      },
    };
  }

  /* ---------------- chart ---------------- */
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs = {}) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      // CSS variables do not work in SVG presentation attributes: use inline style.
      if ((k === 'stroke' || k === 'fill') && typeof v === 'string' && v.startsWith('var(')) e.style.setProperty(k, v);
      else e.setAttribute(k, v);
    }
    return e;
  };

  /**
   * Line chart with log or linear x axis.
   * opts: { series:[{name, points:[[x,y]], color, dash}], xLog, xMin, xMax, yMin, yMax,
   *         xLabel, yLabel, xTicks, yTicks, yFmt, xFmt, stems }
   */
  function chart(container, opts) {
    chartRegistry.set(container, opts);
    container.innerHTML = '';
    container.classList.add('chart');
    // Draw at the real width (300–720 px) so that the text keeps its size on phones.
    const cw = container.clientWidth || 720;
    const W = Math.round(Math.min(720, Math.max(300, cw)));
    const H = Math.round(Math.min(opts.height || 360, Math.max(opts.height ? opts.height * 0.7 : 230, W * 0.62)));
    container.dataset.drawnWidth = String(W);
    const m = { l: W < 480 ? 44 : 52, r: W < 480 ? 8 : 14, t: 12, b: 44 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const xLog = opts.xLog !== false;
    const tx = (x) =>
      m.l + (xLog ? Math.log(x / opts.xMin) / Math.log(opts.xMax / opts.xMin) : (x - opts.xMin) / (opts.xMax - opts.xMin)) * pw;
    const ty = (y) => m.t + (1 - (y - opts.yMin) / (opts.yMax - opts.yMin)) * ph;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || 'Chart' });
    const yTicks = opts.yTicks || [];
    for (const y of yTicks) {
      svg.append(sv('line', { class: 'gridline', x1: m.l, x2: m.l + pw, y1: ty(y), y2: ty(y) }));
      const t = sv('text', { x: m.l - 6, y: ty(y) + 4, 'text-anchor': 'end' });
      t.textContent = opts.yFmt ? opts.yFmt(y) : y;
      svg.append(t);
    }
    let lastLabelX = -Infinity;
    for (const x of opts.xTicks || []) {
      svg.append(sv('line', { class: 'gridline', x1: tx(x), x2: tx(x), y1: m.t, y2: m.t + ph }));
      // Leave out a label if it is too close to the previous label (narrow screens).
      if (tx(x) - lastLabelX < 30) continue;
      lastLabelX = tx(x);
      const t = sv('text', { x: tx(x), y: m.t + ph + 16, 'text-anchor': 'middle' });
      t.textContent = opts.xFmt ? opts.xFmt(x) : x;
      svg.append(t);
    }
    svg.append(sv('line', { class: 'axis', x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph }));
    svg.append(sv('line', { class: 'axis', x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph }));
    const xt = sv('text', { class: 'axis-title', x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle' });
    xt.textContent = opts.xLabel || '';
    svg.append(xt);
    const yt = sv('text', { class: 'axis-title', x: 14, y: m.t + ph / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` });
    yt.textContent = opts.yLabel || '';
    svg.append(yt);

    const clipId = 'clip' + Math.random().toString(36).slice(2);
    const defs = sv('defs');
    const cp = sv('clipPath', { id: clipId });
    cp.append(sv('rect', { x: m.l, y: m.t - 2, width: pw, height: ph + 4 }));
    defs.append(cp);
    svg.append(defs);
    const g = sv('g', { 'clip-path': `url(#${clipId})` });
    svg.append(g);

    opts.series.forEach((s, i) => {
      const color = s.color || `var(--series-${(i % 5) + 1})`;
      if (opts.stems || s.stems) {
        for (const [x, y] of s.points) {
          g.append(sv('line', { x1: tx(x), x2: tx(x), y1: ty(opts.yMin), y2: ty(y), stroke: color, 'stroke-width': s.width || 2 }));
        }
        return;
      }
      if (s.markers) {
        for (const [x, y] of s.points) g.append(sv('circle', { cx: tx(x), cy: ty(y), r: 3.5, fill: color }));
      }
      const d = s.points
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        .map(([x, y], j) => `${j ? 'L' : 'M'}${tx(x).toFixed(1)},${ty(y).toFixed(1)}`)
        .join('');
      const p = sv('path', { class: 'series', d, stroke: color });
      if (s.dash) p.setAttribute('stroke-dasharray', '6 4');
      if (s.width) p.setAttribute('stroke-width', s.width);
      g.append(p);
    });

    // Legend
    if (opts.series.length > 1 || opts.legend) {
      const lg = el('div', { class: 'legend' });
      opts.series.forEach((s, i) => {
        const color = s.color || `var(--series-${(i % 5) + 1})`;
        lg.append(el('span', {}, el('i', { class: s.dash ? 'dash' : '', style: `border-top-color:${color}` }), s.name));
      });
      container.append(lg);
    }
    container.append(svg);

    // Hover read-out
    if (!opts.stems && opts.series.length) {
      const tip = el('div', { class: 'chart-tip' });
      container.append(tip);
      const hl = sv('line', { class: 'hover-line', y1: m.t, y2: m.t + ph, x1: 0, x2: 0, visibility: 'hidden' });
      svg.append(hl);
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * W;
        if (px < m.l || px > m.l + pw) {
          tip.style.display = 'none';
          hl.setAttribute('visibility', 'hidden');
          return;
        }
        const frac = (px - m.l) / pw;
        const x = xLog ? opts.xMin * Math.pow(opts.xMax / opts.xMin, frac) : opts.xMin + frac * (opts.xMax - opts.xMin);
        const lines = [];
        opts.series.forEach((s) => {
          let best = null;
          for (const pt of s.points) if (!best || Math.abs(Math.log(pt[0] / x)) < Math.abs(Math.log(best[0] / x))) best = pt;
          if (best) lines.push(`${s.name}: ${opts.yFmt ? opts.yFmt(best[1], true) : fmt(best[1])}`);
        });
        hl.setAttribute('x1', px);
        hl.setAttribute('x2', px);
        hl.setAttribute('visibility', 'visible');
        tip.innerHTML = '';
        tip.append(el('div', {}, el('b', {}, opts.xFmt ? opts.xFmt(x, true) : fmtHz(x))));
        lines.forEach((l) => tip.append(el('div', {}, l)));
        tip.style.display = 'block';
        const cr = container.getBoundingClientRect();
        let left = ev.clientX - cr.left + 12;
        if (left + tip.offsetWidth > cr.width) left = ev.clientX - cr.left - tip.offsetWidth - 12;
        tip.style.left = Math.max(0, left) + 'px';
        tip.style.top = ev.clientY - cr.top - 10 + 'px';
      };
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerdown', move);
      svg.addEventListener('pointerleave', () => {
        tip.style.display = 'none';
        hl.setAttribute('visibility', 'hidden');
      });
    }
  }

  /* ---------- cross-section diagram ---------- */
  function diagram(container, parts, dopts = {}) {
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
      const e = sv(tag, a);
      svg.append(e);
      return e;
    };
    const txt = (x0, y0, s, anchor = 'middle') => {
      const t = mk('text', { x: x0, y: y0, 'text-anchor': anchor });
      t.textContent = s;
    };
    // sound arrow
    mk('line', { x1: 6, y1: 40, x2: 38, y2: 40, stroke: 'var(--muted)', 'stroke-width': 2 });
    mk('path', { d: 'M38,36 L44,40 L38,44 Z', fill: 'var(--muted)' });
    txt(4, 30, 'Sound', 'start');
    const minW = 10;
    for (const p of parts) {
      let w = (Math.max(p.mm, 1) / total) * avail;
      if (p.kind === 'facing' || p.kind === 'membrane') w = Math.max(minW, Math.min(w, 18));
      else w = Math.max(w, 18);
      let fill;
      if (p.kind === 'porous') fill = 'var(--porous)';
      else if (p.kind === 'air') fill = 'none';
      else fill = 'var(--panel)';
      mk('rect', {
        x,
        y: 20,
        width: w,
        height: 90,
        fill,
        stroke: 'var(--border)',
        'stroke-dasharray': p.kind === 'air' ? '3 3' : '',
      });
      if (p.kind === 'facing') {
        // draw openings
        for (let yy = 30; yy < 105; yy += 16) mk('rect', { x, y: yy, width: w, height: 5, fill: 'var(--surface)' });
      }
      txt(x + w / 2, 124, p.mm >= 10 ? Math.round(p.mm) + ' mm' : (+p.mm.toFixed(2)) + ' mm');
      const lab = mk('text', { x: x + w / 2, y: 142, 'text-anchor': 'middle' });
      lab.textContent = p.label;
      x += w;
    }
    if (dopts.open) {
      txt(x + 4, 66, 'Open', 'start');
      txt(x + 4, 80, '(air)', 'start');
    } else {
      mk('rect', { x, y: 10, width: 14, height: 110, fill: 'var(--muted)' });
      txt(x + 7, 8, 'Wall');
    }
    container.append(svg);
  }


  /* Redraw charts when the width changes (phone rotation, window resize). */
  const chartRegistry = new Map();
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const [c, o] of chartRegistry) {
        if (!c.isConnected) {
          chartRegistry.delete(c);
          continue;
        }
        const w = Math.round(Math.min(720, Math.max(300, c.clientWidth)));
        if (String(w) !== c.dataset.drawnWidth) chart(c, o);
      }
    }, 150);
  });

  const FREQ_TICKS = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const freqTickFmt = (f) => (f >= 1000 ? f / 1000 + 'k' : String(f));

  /* ---------------- table / csv / notes ---------------- */
  function table(container, headers, rows, opts = {}) {
    container.innerHTML = '';
    const stack = opts.stack !== undefined ? opts.stack : headers.length > 4;
    const t = el(
      'table',
      { class: 'data' + (stack ? ' stack' : '') },
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', { scope: 'col' }, h)))),
      el(
        'tbody',
        {},
        rows.map((r) =>
          el(
            'tr',
            {},
            r.map((c, i) => {
              const cls = opts.negClass && typeof c === 'object' && c && c.neg ? 'neg' : null;
              return el(i === 0 ? 'th' : 'td', { scope: i === 0 ? 'row' : null, class: cls, 'data-label': headers[i] }, c && typeof c === 'object' ? c.text : c);
            })
          )
        )
      )
    );
    container.append(el('div', { class: 'table-wrap' }, t));
  }

  function downloadCsv(filename, headers, rows) {
    const esc = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function notes(container, list) {
    container.innerHTML = '';
    if (!list.length) return;
    container.append(el('ul', { class: 'notes' }, list.map((n) => el('li', { class: n.level || '' }, n.text))));
  }

  function kpis(container, items) {
    container.innerHTML = '';
    container.classList.add('kpis');
    for (const k of items) {
      container.append(
        el('div', { class: 'kpi' }, el('div', { class: 'label' }, k.label), el('div', { class: 'value' }, k.value), k.sub ? el('div', { class: 'sub' }, k.sub) : null)
      );
    }
  }

  function copyLink(btn) {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        const t = btn.textContent;
        btn.textContent = 'Link copied';
        setTimeout(() => (btn.textContent = t), 1500);
      } catch (_) {
        prompt('Copy this link:', location.href);
      }
    });
  }

  /* Shared panel results for the reverberation page */
  function savePanelResult(name, octaveAlpha) {
    storageSet('ac-last-panel', JSON.stringify({ name, octaveAlpha, saved: new Date().toISOString() }));
  }
  function loadPanelResult() {
    try {
      return JSON.parse(storageGet('ac-last-panel'));
    } catch (_) {
      return null;
    }
  }

  /* Project document store (in this browser only) */
  const PROJECT_KEY = 'ac-project';
  const emptyProject = () => ({ name: '', room: '', author: '', date: new Date().toISOString().slice(0, 10), notes: '', items: [] });
  const project = {
    load() {
      try {
        const p = JSON.parse(storageGet(PROJECT_KEY));
        if (p && Array.isArray(p.items)) return { ...emptyProject(), ...p };
      } catch (_) {
        /* ignore */
      }
      return emptyProject();
    },
    save(p) {
      storageSet(PROJECT_KEY, JSON.stringify(p));
    },
    addItem(item) {
      const p = project.load();
      item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      item.savedAt = new Date().toISOString();
      p.items.push(item);
      project.save(p);
      return item;
    },
    empty: emptyProject,
  };

  /* Phones: a floating button that jumps between the inputs and the results. */
  function jumpButton() {
    const calc = document.querySelector('.calc');
    if (!calc || calc.children.length < 2) return;
    const inputs = calc.children[0];
    const results = calc.children[1];
    const btn = el('button', { class: 'jump-btn', type: 'button', 'aria-label': 'Go to the results' }, 'Results ↓');
    let toResults = true;
    btn.addEventListener('click', () => {
      (toResults ? results : inputs).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const update = () => {
      const r = results.getBoundingClientRect();
      toResults = r.top > window.innerHeight * 0.5;
      btn.textContent = toResults ? 'Results ↓' : 'Inputs ↑';
      btn.setAttribute('aria-label', toResults ? 'Go to the results' : 'Go to the inputs');
    };
    window.addEventListener('scroll', update, { passive: true });
    document.body.append(btn);
    update();
  }

  document.addEventListener('DOMContentLoaded', header);
  document.addEventListener('DOMContentLoaded', jumpButton);

  root.UI = {
    el,
    fmt,
    fmtSig,
    fmtHz,
    form,
    chart,
    FREQ_TICKS,
    freqTickFmt,
    table,
    downloadCsv,
    notes,
    kpis,
    copyLink,
    savePanelResult,
    project,
    readUrlState,
    loadPanelResult,
    cssVar,
    diagram,
  };
})(this);
