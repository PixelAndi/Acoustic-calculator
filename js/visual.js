/*
 * Acoustic Calculator – panel drawings (SVG, no dependencies).
 * Exposes the global "VIS". Needs core.js (AC) for hole layouts.
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if ((k === 'fill' || k === 'stroke') && typeof v === 'string' && v.startsWith('var(')) e.style.setProperty(k, v);
      else e.setAttribute(k, v);
    }
    if (parent) parent.append(e);
    return e;
  }
  function text(parent, x, y, s, attrs = {}) {
    const t = svgEl('text', { x, y, class: 'vis-text', ...attrs }, parent);
    t.textContent = s;
    return t;
  }
  function makeSvg(container, w, h, label) {
    container.innerHTML = '';
    container.classList.add('vis');
    const s = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': label });
    container.append(s);
    return s;
  }
  const fmtMm = (x) => (x >= 100 ? Math.round(x) : +x.toFixed(x < 10 ? 1 : 0)) + ' mm';

  /* Materials: front, top, side colours */
  const MATERIALS = {
    wood: ['#c9a26b', '#dcbd8c', '#9c7a4b'],
    fabric: ['#5f7387', '#7a8da0', '#46576a'],
    metal: ['#b8c0c8', '#d3d9de', '#8d969f'],
    acrylic: ['#cfe7ee', '#e3f2f6', '#a9cdd8'],
    board: ['#ddd6c6', '#ebe6da', '#b4ad9d'],
    wool: ['#d8c27a', '#e6d49b', '#b29f5d'],
    dark: ['#3d4650', '#56606b', '#2b323a'],
  };

  /**
   * Oblique (cabinet) drawing of a rectangular panel.
   * spec: { w, h, depth (mm), material, face: 'plain'|'fabric'|'holes'|'slots'|'slats'|'micro',
   *         holes: {D, r, pattern}, slots: {pitch, w}, title, note }
   */
  function panel(container, spec) {
    const VW = 560;
    const VH = 380;
    const svg = makeSvg(container, VW, VH, spec.title || 'Drawing of the panel');
    const [cf, ct, cs] = MATERIALS[spec.material] || MATERIALS.board;
    const k = 0.5; // depth foreshortening
    const ang = Math.PI / 6;
    const depthVis = Math.max(spec.depth, 0);
    const hasDetail = (spec.face === 'holes' || spec.face === 'micro') && spec.holes;
    const sc = Math.min((VW - 100 - (hasDetail ? 135 : 0)) / (spec.w + depthVis * k * Math.cos(ang)), (VH - 110) / (spec.h + depthVis * k * Math.sin(ang)));
    const W = spec.w * sc;
    const H = spec.h * sc;
    const dx = Math.max(depthVis * sc * k * Math.cos(ang), 6);
    const dy = Math.max(depthVis * sc * k * Math.sin(ang), 3.5);
    const x0 = 60;
    const y0 = 40 + dy;
    const id = 'v' + ++uid;
    const defs = svgEl('defs', {}, svg);

    // shadow
    svgEl('rect', { x: x0 + 6, y: y0 + 6, width: W, height: H, fill: 'rgba(0,0,0,0.12)', rx: 2 }, svg);
    // top and side faces
    svgEl('polygon', { points: `${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + W + dx},${y0 - dy} ${x0 + W},${y0}`, fill: ct, stroke: 'rgba(0,0,0,0.25)' }, svg);
    svgEl('polygon', { points: `${x0 + W},${y0} ${x0 + W + dx},${y0 - dy} ${x0 + W + dx},${y0 + H - dy} ${x0 + W},${y0 + H}`, fill: cs, stroke: 'rgba(0,0,0,0.25)' }, svg);

    // front face
    const clip = svgEl('clipPath', { id: id + 'c' }, defs);
    svgEl('rect', { x: x0, y: y0, width: W, height: H }, clip);
    const face = svgEl('g', { 'clip-path': `url(#${id}c)` }, svg);
    let note = spec.note || '';

    if (spec.face === 'slats' && spec.slots) {
      svgEl('rect', { x: x0, y: y0, width: W, height: H, fill: '#1f2328' }, face);
      const p = spec.slots.pitch * sc;
      const g = spec.slots.w * sc;
      for (let x = x0 + g / 2; x < x0 + W; x += p) svgEl('rect', { x, y: y0, width: Math.max(p - g, 0.6), height: H, fill: cf, stroke: 'rgba(0,0,0,0.25)', 'stroke-width': 0.5 }, face);
    } else {
      svgEl('rect', { x: x0, y: y0, width: W, height: H, fill: cf }, face);
    }
    if (spec.face === 'fabric') {
      const pat = svgEl('pattern', { id: id + 'f', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, defs);
      svgEl('path', { d: 'M0,4 L4,0', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 1 }, pat);
      svgEl('rect', { x: x0, y: y0, width: W, height: H, fill: `url(#${id}f)` }, face);
    }
    if (spec.face === 'plain' && spec.material === 'wood') {
      for (let y = y0 + 7; y < y0 + H; y += 11) svgEl('path', { d: `M${x0},${y} q${W / 3},4 ${W},-2`, stroke: 'rgba(0,0,0,0.08)', fill: 'none' }, face);
    }
    if ((spec.face === 'holes' || spec.face === 'micro') && spec.holes) {
      const { D, r, pattern } = spec.holes;
      const L = AC.holeLayout({ W: spec.w / 1000, H: spec.h / 1000, D: D / 1000, r: r / 1000, pattern });
      const Dp = D * sc;
      const rp = Math.max(r * sc, 0.35);
      const holeFill = '#1c1f23';
      if (L.total <= 3000 && Dp >= 2.2) {
        const rowP = (pattern === 'triangular' ? D * Math.sqrt(3) / 2 : D) * sc;
        for (let row = 0; row < L.rows; row++) {
          const odd = pattern === 'triangular' && row % 2 === 1;
          const n = odd ? L.perRowB : L.perRowA;
          const cy = y0 + (D / 2) * sc + row * rowP;
          for (let i = 0; i < n; i++) svgEl('circle', { cx: x0 + (D / 2) * sc + (odd ? Dp / 2 : 0) + i * Dp, cy, r: rp, fill: holeFill }, face);
        }
      } else {
        // Too many holes to draw one by one: show the open area as a tone and add a detail view.
        svgEl('rect', { x: x0, y: y0, width: W, height: H, fill: holeFill, opacity: Math.min(0.55, AC.holeOpenArea(r, D, pattern) * 4) }, face);
        note = (note ? note + ' ' : '') + `${L.total.toLocaleString('en-GB')} holes per panel. See the enlarged detail.`;
      }
      // Detail circle (magnified)
      const R = 56;
      const cx = VW - R - 8;
      const cy = y0 + R + 10;
      const mag = (R * 2) / Math.max(D * 2.6, r * 8);
      const dclip = svgEl('clipPath', { id: id + 'd' }, defs);
      svgEl('circle', { cx, cy, r: R }, dclip);
      const dg = svgEl('g', { 'clip-path': `url(#${id}d)` }, svg);
      svgEl('rect', { x: cx - R, y: cy - R, width: 2 * R, height: 2 * R, fill: cf }, dg);
      const rowP = pattern === 'triangular' ? (D * Math.sqrt(3)) / 2 : D;
      for (let j = -6; j <= 6; j++)
        for (let i = -6; i <= 6; i++) {
          const off = pattern === 'triangular' && Math.abs(j) % 2 === 1 ? D / 2 : 0;
          svgEl('circle', { cx: cx + (i * D + off) * mag, cy: cy + j * rowP * mag, r: r * mag, fill: holeFill }, dg);
        }
      svgEl('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5 }, svg);
      text(svg, cx, cy + R + 14, `Detail ×${(mag / sc).toFixed(mag / sc < 10 ? 1 : 0)}`, { 'text-anchor': 'middle' });
      text(svg, cx, cy + R + 27, `Ø${+(2 * r).toFixed(2)} mm @ ${+D.toFixed(2)} mm`, { 'text-anchor': 'middle' });
    }
    if (spec.face === 'slots' && spec.slots) {
      const L = AC.slotLayout({ W: spec.w / 1000, H: spec.h / 1000, pitch: spec.slots.pitch / 1000, w: spec.slots.w / 1000 });
      const p = spec.slots.pitch * sc;
      const g = Math.max(spec.slots.w * sc, 0.6);
      for (let i = 0; i < L.count; i++)
        svgEl('rect', { x: x0 + p / 2 + i * p - g / 2, y: y0 + p / 2, width: g, height: L.length * 1000 * sc, fill: '#1c1f23', rx: Math.min(g / 2, 2) }, face);
    }
    svgEl('rect', { x: x0, y: y0, width: W, height: H, fill: 'none', stroke: 'rgba(0,0,0,0.35)', rx: spec.face === 'fabric' ? 3 : 0 }, svg);

    // Dimensions
    const dimY = y0 + H + 18;
    svgEl('line', { x1: x0, y1: dimY, x2: x0 + W, y2: dimY, class: 'vis-dim' }, svg);
    svgEl('line', { x1: x0, y1: dimY - 5, x2: x0, y2: dimY + 5, class: 'vis-dim' }, svg);
    svgEl('line', { x1: x0 + W, y1: dimY - 5, x2: x0 + W, y2: dimY + 5, class: 'vis-dim' }, svg);
    text(svg, x0 + W / 2, dimY + 15, fmtMm(spec.w), { 'text-anchor': 'middle' });
    const dimX = x0 - 18;
    svgEl('line', { x1: dimX, y1: y0, x2: dimX, y2: y0 + H, class: 'vis-dim' }, svg);
    svgEl('line', { x1: dimX - 5, y1: y0, x2: dimX + 5, y2: y0, class: 'vis-dim' }, svg);
    svgEl('line', { x1: dimX - 5, y1: y0 + H, x2: dimX + 5, y2: y0 + H, class: 'vis-dim' }, svg);
    text(svg, dimX - 6, y0 + H / 2, fmtMm(spec.h), { 'text-anchor': 'middle', transform: `rotate(-90 ${dimX - 6} ${y0 + H / 2})` });
    if (spec.depth > 0) text(svg, x0 + W + dx, y0 - dy - 5, 'depth ' + fmtMm(spec.depth), { 'text-anchor': 'end' });
    if (spec.title) text(svg, 8, 16, spec.title, { class: 'vis-title' });
    let needH = Math.max(dimY + 26, hasDetail ? y0 + 2 * 56 + 50 : 0);
    if (note) {
      text(svg, x0, needH + 6, note, { class: 'vis-text vis-note' });
      needH += 16;
    }
    svg.setAttribute('viewBox', `0 0 ${VW} ${Math.min(VH, needH)}`);
  }

  /**
   * Side view of a ceiling cloud (flat or tilted) or a vertical baffle.
   * spec: { mode: 'cloud'|'baffle', L, t, tilt (deg), dHigh (mm) }
   */
  function cloud(container, spec) {
    const VW = 560;
    const VH = 330;
    const svg = makeSvg(container, VW, VH, 'Side view of the suspended absorber');
    const defs = svgEl('defs', {}, svg);
    const id = 'v' + ++uid;
    const mk = svgEl('marker', { id: id + 'a', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--accent)' }, mk);
    const ceilY = 40;
    svgEl('rect', { x: 20, y: ceilY - 16, width: VW - 40, height: 16, fill: 'var(--panel)' }, svg);
    text(svg, 26, ceilY - 21, 'Ceiling');
    const [cf, , cs] = MATERIALS.fabric;

    if (spec.mode === 'baffle') {
      const sc = Math.min(220 / (spec.L + spec.dHigh), 2);
      const bx = VW / 2 - (spec.t * sc) / 2;
      const by = ceilY + spec.dHigh * sc;
      svgEl('line', { x1: VW / 2, y1: ceilY, x2: VW / 2, y2: by, stroke: 'var(--muted)', 'stroke-width': 1.2 }, svg);
      svgEl('rect', { x: bx, y: by, width: Math.max(spec.t * sc, 4), height: spec.L * sc, fill: cf, stroke: cs }, svg);
      text(svg, VW / 2 + 14, ceilY + (spec.dHigh * sc) / 2 + 4, fmtMm(spec.dHigh));
      text(svg, VW / 2 + 14, by + (spec.L * sc) / 2, 'height ' + fmtMm(spec.L));
      for (const s of [-1, 1]) {
        const x1 = VW / 2 + s * 170;
        svgEl('line', { x1, y1: by + 40, x2: VW / 2 + s * 18, y2: by + 30 + (spec.L * sc) / 3, stroke: 'var(--accent)', 'stroke-width': 2, 'marker-end': `url(#${id}a)` }, svg);
      }
      text(svg, VW / 2, VH - 12, 'Sound reaches both faces of a baffle.', { 'text-anchor': 'middle' });
      return;
    }
    const phi = ((spec.tilt || 0) * Math.PI) / 180;
    const totalDrop = spec.dHigh + spec.L * Math.sin(phi) + spec.t * Math.cos(phi);
    const sc = Math.min((VW - 160) / (spec.L * Math.cos(phi) + 1), 200 / (totalDrop + 1));
    const ax = 90;
    const ay = ceilY + spec.dHigh * sc; // high edge, top surface
    const ux = Math.cos(phi);
    const uy = Math.sin(phi);
    const nx = -Math.sin(phi);
    const ny = Math.cos(phi); // normal (downwards into panel)
    const P = (s, d) => [ax + (ux * s + nx * d) * sc, ay + (uy * s + ny * d) * sc];
    const pts = [P(0, 0), P(spec.L, 0), P(spec.L, spec.t), P(0, spec.t)];
    // cables
    for (const s of [0.1 * spec.L, 0.9 * spec.L]) {
      const [x, y] = P(s, 0);
      svgEl('line', { x1: x, y1: ceilY, x2: x, y2: y, stroke: 'var(--muted)', 'stroke-width': 1.2 }, svg);
    }
    svgEl('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: cf, stroke: cs }, svg);
    // gaps
    const [hx, hy] = P(0, 0);
    const [lx, ly] = P(spec.L, 0);
    text(svg, hx - 8, (ceilY + hy) / 2 + 4, fmtMm(spec.dHigh), { 'text-anchor': 'end' });
    if (phi > 0) {
      svgEl('line', { x1: lx + 6, y1: ceilY, x2: lx + 6, y2: ly, class: 'vis-dim' }, svg);
      text(svg, lx + 12, (ceilY + ly) / 2 + 4, fmtMm(spec.dHigh + spec.L * Math.sin(phi)));
      text(svg, hx + 20, hy - 6, `${spec.tilt}°`);
    }
    // reflection of a vertical ray
    const [mx, my] = P(spec.L / 2, spec.t);
    const inLen = 110;
    svgEl('line', { x1: mx, y1: my + inLen, x2: mx, y2: my + 4, stroke: 'var(--accent)', 'stroke-width': 2, 'marker-end': `url(#${id}a)` }, svg);
    // reflect d=(0,-1) about the panel normal n=(nx,ny)
    const dX = 0;
    const dY = -1;
    const dot = dX * nx + dY * ny;
    const rX = dX - 2 * dot * nx;
    const rY = dY - 2 * dot * ny;
    svgEl('line', { x1: mx, y1: my, x2: mx + rX * inLen, y2: my + rY * inLen, stroke: 'var(--series-2)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, svg);
    text(svg, mx + 8, my + inLen, 'sound from below');
    text(svg, mx + rX * inLen + (rX < 0 ? -6 : 6), my + rY * inLen + 4, phi > 0 ? `reflection, ${(2 * spec.tilt).toFixed(0)}° from vertical` : 'reflection', { 'text-anchor': rX < 0 ? 'end' : 'start' });
    text(svg, 20, VH - 10, `Panel length ${fmtMm(spec.L)}, plan length ${fmtMm(spec.L * Math.cos(phi))}, thickness ${fmtMm(spec.t)}`);
  }

  /**
   * Oblique drawing of blocks (diffusers). heights[i][j] in mm, cell size in mm.
   * Row index i runs along the length (away from the viewer), j across the width.
   * cells: [{ x, w, h }] for 1D; or grid for 2D.
   */
  function blocks(container, spec) {
    const VW = 560;
    const VH = 360;
    const svg = makeSvg(container, VW, VH, spec.title || 'Drawing of the diffuser');
    const [cf, ct, cs] = MATERIALS[spec.material || 'wood'];
    const k = 0.55;
    const ang = Math.PI / 6;
    const totalW = spec.totalWidth;
    const totalL = spec.totalLength;
    const maxH = spec.maxHeight || 1;
    const sc = Math.min((VW - 80) / (totalW + totalL * k * Math.cos(ang)), (VH - 80) / (totalL * k * Math.sin(ang) + maxH * 1.1));
    const ox = 40;
    const oy = VH - 50;
    const pr = (x, y, z) => [ox + (x + y * k * Math.cos(ang)) * sc, oy - (z + y * k * Math.sin(ang)) * sc];
    const poly = (pts, fill) => svgEl('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill, stroke: 'rgba(0,0,0,0.3)', 'stroke-width': 0.6 }, svg);
    // base plate
    poly([pr(0, 0, 0), pr(totalW, 0, 0), pr(totalW, totalL, 0), pr(0, totalL, 0)], cs);
    // painter: far rows first, left to right
    const cells = [...spec.cells].sort((a, b) => b.y - a.y || a.x - b.x);
    for (const c of cells) {
      const { x, y, w, l, h } = c;
      if (h <= 0) {
        poly([pr(x, y, 0), pr(x + w, y, 0), pr(x + w, y + l, 0), pr(x, y + l, 0)], cs);
        continue;
      }
      poly([pr(x, y, h), pr(x + w, y, h), pr(x + w, y + l, h), pr(x, y + l, h)], c.top || ct); // top
      poly([pr(x + w, y, 0), pr(x + w, y + l, 0), pr(x + w, y + l, h), pr(x + w, y, h)], cs); // right
      poly([pr(x, y, 0), pr(x + w, y, 0), pr(x + w, y, h), pr(x, y, h)], c.front || cf); // front
    }
    if (spec.title) text(svg, 20, 18, spec.title, { class: 'vis-title' });
    if (spec.note) text(svg, 20, VH - 12, spec.note, { class: 'vis-text vis-note' });
  }

  /** Polar plot (−90° … +90°) of levels in dB re maximum. series: [{name, points:[{deg, db}], dash}] */
  function polar(container, series, opts = {}) {
    const VW = 420;
    const VH = 250;
    const svg = makeSvg(container, VW, VH, opts.label || 'Polar plot of scattered sound');
    const cx = VW / 2;
    const cy = VH - 30;
    const R = 190;
    const range = opts.range || 30;
    for (let db = 0; db >= -range; db -= 10) {
      const r = R * (1 + db / range);
      svgEl('path', { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, fill: 'none', class: 'vis-grid' }, svg);
      if (db > -range) text(svg, cx + 3, cy - r + 11, db + ' dB');
    }
    for (let deg = -90; deg <= 90; deg += 30) {
      const t = (deg * Math.PI) / 180;
      svgEl('line', { x1: cx, y1: cy, x2: cx + R * Math.sin(t), y2: cy - R * Math.cos(t), class: 'vis-grid' }, svg);
      const anchor = deg === -90 ? 'start' : deg === 90 ? 'end' : 'middle';
      const lx = deg === -90 ? 2 : deg === 90 ? VW - 2 : cx + (R + 12) * Math.sin(t);
      const ly = Math.abs(deg) === 90 ? cy - 8 : cy - (R + 12) * Math.cos(t) + 4;
      text(svg, lx, ly, deg + '°', { 'text-anchor': anchor });
    }
    series.forEach((s, i) => {
      const d = s.points
        .map((p, j) => {
          const r = R * Math.max(0, 1 + Math.max(p.db, -range) / range);
          const t = (p.deg * Math.PI) / 180;
          return `${j ? 'L' : 'M'}${(cx + r * Math.sin(t)).toFixed(1)},${(cy - r * Math.cos(t)).toFixed(1)}`;
        })
        .join('');
      svgEl('path', { d, fill: 'none', stroke: s.color || `var(--series-${(i % 5) + 1})`, 'stroke-width': 2.2, 'stroke-dasharray': s.dash ? '6 4' : null }, svg);
    });
    const lg = document.createElement('div');
    lg.className = 'legend';
    series.forEach((s, i) => {
      const sp = document.createElement('span');
      const ic = document.createElement('i');
      if (s.dash) ic.className = 'dash';
      ic.style.borderTopColor = s.color || `var(--series-${(i % 5) + 1})`;
      sp.append(ic, s.name);
      lg.append(sp);
    });
    container.prepend(lg);
  }

  /** Section of a single Helmholtz resonator (box with a neck). spec: { a, L, V } in m / m³ */
  function resonator(container, spec) {
    const VW = 420;
    const VH = 270;
    const svg = makeSvg(container, VW, VH, 'Section of a Helmholtz resonator');
    const side = Math.cbrt(spec.V);
    const sc = 150 / Math.max(side + spec.L, 4 * spec.a, 1e-6);
    const bw = side * sc;
    const nw = Math.max(2 * spec.a * sc, 4);
    const nl = Math.max(spec.L * sc, 6);
    const wall = 6;
    const cx = VW / 2;
    const top = 80; // top of the neck
    const by = top + nl; // inside top of the box
    const wood = MATERIALS.wood;
    // box walls and cavity
    svgEl('rect', { x: cx - bw / 2 - wall, y: by - wall, width: bw + 2 * wall, height: bw + 2 * wall, fill: wood[0], stroke: wood[2] }, svg);
    svgEl('rect', { x: cx - bw / 2, y: by, width: bw, height: bw, fill: 'var(--surface)' }, svg);
    // neck walls and opening
    svgEl('rect', { x: cx - nw / 2 - wall, y: top, width: nw + 2 * wall, height: nl, fill: wood[0], stroke: wood[2] }, svg);
    svgEl('rect', { x: cx - nw / 2, y: top - 1, width: nw, height: nl + wall + 2, fill: 'var(--surface)' }, svg);
    // air plug in the neck
    svgEl('rect', { x: cx - nw / 2, y: top, width: nw, height: nl, fill: 'var(--accent)', opacity: 0.35 }, svg);
    // labels with leader lines
    svgEl('line', { x1: cx + nw / 2 + wall, y1: top + nl / 2, x2: cx + 70, y2: 40, class: 'vis-dim' }, svg);
    text(svg, cx + 74, 38, `Neck Ø${+(2000 * spec.a).toFixed(1)} mm`);
    text(svg, cx + 74, 52, `length ${+(1000 * spec.L).toFixed(1)} mm`);
    svgEl('line', { x1: cx - nw / 2, y1: top + nl / 2, x2: cx - 70, y2: 40, class: 'vis-dim' }, svg);
    text(svg, cx - 74, 38, 'Air in the neck', { 'text-anchor': 'end' });
    text(svg, cx - 74, 52, '(mass)', { 'text-anchor': 'end' });
    text(svg, cx, by + bw / 2 - 4, `Volume ${+(spec.V * 1000).toFixed(2)} litres`, { 'text-anchor': 'middle' });
    text(svg, cx, by + bw / 2 + 12, '(air spring)', { 'text-anchor': 'middle' });
    svg.setAttribute('viewBox', `0 0 ${VW} ${Math.max(by + bw + wall + 12, 140)}`);
  }

  root.VIS = { panel, cloud, blocks, polar, resonator, MATERIALS };
})(this);
