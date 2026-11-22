/*
 * Project document: collects saved absorber designs and makes a printable
 * build document. Needs core.js (AC) and ui.js (UI).
 */
(function () {
  'use strict';
  const { el, fmt, fmtHz } = UI;

  const TYPE_NAMES = {
    porous: 'Porous absorber',
    perforated: 'Perforated panel absorber',
    slotted: 'Slotted panel absorber',
    microperforated: 'Microperforated panel absorber',
    membrane: 'Membrane absorber',
    multilayer: 'Multilayer absorber',
    cloud: 'Cloud or baffle',
    diffuser: 'Diffuser',
  };

  let P = UI.project.load();
  const save = () => UI.project.save(P);
  const mm = (x, d = 0) => fmt(x, d) + ' mm';
  const posLabel = (v, front) => (v.ta >= v.depth ? 'Fills the cavity' : v.pos === 'wall' ? 'Against the wall' : front);

  /* ------------------------------------------------------------------ */
  /* Build data and instructions for one design                          */
  /* ------------------------------------------------------------------ */
  function buildData(item) {
    if (item.custom)
      return {
        rows: item.rows,
        warnings: item.warnings,
        steps: item.steps,
        checks: item.checks,
        qty: { area: (item.quantities && item.quantities.area) || 0, absorber: (item.quantities && item.quantities.absorber) || [], holes: 0, sheet: null },
      };
    if (item.type === 'multilayer') return buildMultilayer(item);
    const v = item.values;
    const W = item.panel.w;
    const H = item.panel.h;
    const Q = item.panel.qty;
    const areaOne = (W * H) / 1e6;
    const rows = [
      ['Panel size (width × height)', `${fmt(W, 0)} × ${fmt(H, 0)} mm`],
      ['Quantity', `${Q}`],
      ['Area of one panel', fmt(areaOne, 3) + ' m²'],
      ['Total area', fmt(areaOne * Q, 2) + ' m²'],
    ];
    const qty = { area: areaOne * Q, absorber: [], holes: 0, sheet: null };
    const warnings = [];
    const steps = [];
    const checks = [];
    const ta = item.type === 'porous' ? v.ta : item.type === 'microperforated' ? 0 : v.ta;
    const hasPorous = ta > 0;

    // Common warnings (ASD-STE100: the warning comes before the step)
    if (hasPorous)
      warnings.push({
        level: 'WARNING',
        text: 'Mineral wool and glass wool can cause irritation of the skin, eyes and lungs. When you cut or handle them, wear gloves, long sleeves, eye protection and a dust mask (FFP2 or better).',
      });
    warnings.push({ level: 'WARNING', text: 'Wear eye protection and ear protection when you use power tools.' });
    warnings.push({ level: 'CAUTION', text: 'Make sure that all materials (frame, absorber, fabric, panel) agree with the fire rules of your local building code.' });
    warnings.push({ level: 'CAUTION', text: 'Make sure that the wall fixings can hold the weight of the panels.' });

    if (hasPorous) {
      const vol = areaOne * (ta / 1000);
      qty.absorber.push({ t: ta, area: areaOne * Q, vol: vol * Q, sigma: v.sigma });
      rows.push(['Porous absorber', `${mm(ta)} thick, σ = ${fmt(v.sigma, 0)} Pa·s/m²`]);
      rows.push(['Porous absorber volume', fmt(vol, 4) + ' m³ per panel · ' + fmt(vol * Q, 3) + ' m³ total']);
    }

    if (item.type === 'porous') {
      rows.push(['Frame inner depth', mm(v.ta)]);
      if (v.gap > 0) rows.push(['Air gap to wall', mm(v.gap)]);
      steps.push(
        `Cut the frame parts. Make the inner depth of the frame ${mm(v.ta)}. Make the outer size ${fmt(W, 0)} × ${fmt(H, 0)} mm.`,
        'Assemble the frame. Make sure that the corners are square.',
        `Cut the porous absorber to the inner size of the frame. Use material that is ${mm(v.ta)} thick.`,
        'Put the absorber in the frame. Do not compress the absorber. Compression increases the flow resistivity and changes the result.',
        'Cover the front with an acoustically transparent fabric. Make sure that you can easily blow air through the fabric.',
        'Pull the fabric tight and attach it to the back of the frame.'
      );
      if (v.gap > 0) steps.push(`Attach spacers or brackets to the back of the frame. Make the air gap between the absorber and the wall ${mm(v.gap)}.`);
      steps.push('Attach the panel to the wall.');
      checks.push(`Absorber thickness is ${mm(v.ta)}.`, `Flow resistivity on the data sheet is approximately ${fmt(v.sigma, 0)} Pa·s/m².`);
      if (v.gap > 0) checks.push(`Air gap is ${mm(v.gap)}. Measured: ______ mm`);
      checks.push('The fabric lets air through easily.');
    }

    if (item.type === 'perforated' || item.type === 'microperforated') {
      const r = v.dh / 2000;
      const L = AC.holeLayout({ W: W / 1000, H: H / 1000, D: v.D / 1000, r, pattern: v.pattern });
      const eps = AC.holeOpenArea(r, v.D / 1000, v.pattern);
      qty.holes = L.total * Q;
      rows.push(['Panel thickness', mm(v.t, v.t < 1 ? 2 : 1)]);
      rows.push(['Hole diameter', mm(v.dh, v.dh < 1 ? 2 : 1)]);
      rows.push(['Hole pattern', (v.pattern === 'triangular' ? 'Triangular' : 'Square') + ` grid, ${mm(v.D, v.D < 10 ? 1 : 0)} between centres`]);
      rows.push(['Edge margin (edge to first hole centre)', mm(L.margin * 1000, 1)]);
      if (v.pattern === 'triangular')
        rows.push(['Rows', `${L.rows} rows, ${fmt(L.rowPitch * 1000, 2)} mm apart; ${L.perRowA} and ${L.perRowB} holes in alternate rows`]);
      else rows.push(['Rows × columns', `${L.rows} × ${L.perRowA}`]);
      rows.push(['Holes per panel', fmt(L.total, 0)]);
      rows.push(['Holes in total', fmt(L.total * Q, 0)]);
      rows.push(['Open area', `${fmt(eps * 100, 2)} % (design) · ${fmt(L.openArea * 100, 2)} % (whole panel)`]);
      rows.push(['Cavity depth (back of panel to wall)', mm(v.depth)]);
      if (item.type === 'perforated' && hasPorous) rows.push(['Absorber position', posLabel(v, 'Against the back of the panel')]);

      if (item.type === 'perforated') {
        steps.push(
          `Cut the panel to ${fmt(W, 0)} × ${fmt(H, 0)} mm from ${mm(v.t, 1)} sheet.`,
          v.pattern === 'triangular'
            ? `Mark the hole centres on a triangular grid. Put the rows ${fmt(L.rowPitch * 1000, 2)} mm apart. Move every second row ${fmt(v.D / 2, 1)} mm to the side.`
            : `Mark the hole centres on a square grid with ${mm(v.D, 1)} between centres.`,
          `Put the first hole centre ${fmt(L.margin * 1000, 1)} mm from each edge.`,
          `Drill ${fmt(L.total, 0)} holes in each panel, with a diameter of ${mm(v.dh, 1)}. Use a drill template to keep the spacing equal.`,
          'Remove the burrs from the holes.',
          'If you paint the panel, use a thin coat. Make sure that the paint does not close or decrease the holes.'
        );
      } else {
        warnings.push({
          level: 'NOTE',
          text: 'Holes smaller than 1 mm are difficult to make with a usual drill. Use a laser-cut or micro-drilled sheet, or buy a microperforated sheet with these data.',
        });
        steps.push(
          `Get a ${mm(v.t, 2)} sheet with holes of ${mm(v.dh, 2)} diameter, ${mm(v.D, 2)} between centres (open area ${fmt(eps * 100, 2)} %).`,
          `Cut the sheet to ${fmt(W, 0)} × ${fmt(H, 0)} mm.`,
          'Do not paint the sheet after the holes are made. Paint closes small holes.'
        );
      }
    }

    if (item.type === 'slotted') {
      const L = AC.slotLayout({ W: W / 1000, H: H / 1000, pitch: v.pitch / 1000, w: v.w / 1000 });
      const eps = v.w / v.pitch;
      rows.push(['Panel thickness', mm(v.t, 1)]);
      rows.push(['Slot width', mm(v.w, 1)]);
      rows.push(['Slot pitch (centre to centre)', mm(v.pitch, 1)]);
      rows.push(['Slat width (pitch − slot)', mm(L.slatWidth * 1000, 1)]);
      rows.push(['Slots per panel', `${L.count}, each ${mm(L.length * 1000)} long (panel in one piece)`]);
      rows.push(['Open area', `${fmt(eps * 100, 2)} % (design) · ${fmt(L.openArea * 100, 2)} % (whole panel)`]);
      rows.push(['Cavity depth (back of panel to wall)', mm(v.depth)]);
      if (hasPorous) rows.push(['Absorber position', posLabel(v, 'Against the back of the panel')]);
      steps.push(
        `If you make slots in one panel: cut the panel to ${fmt(W, 0)} × ${fmt(H, 0)} mm. Cut ${L.count} slots, ${mm(v.w, 1)} wide and ${mm(L.length * 1000)} long, with ${mm(v.pitch, 1)} between centres. Put the first slot centre ${mm(L.margin * 1000, 1)} from the edge.`,
        `If you use slats: cut slats ${mm(L.slatWidth * 1000, 1)} wide from ${mm(v.t, 1)} material. Use spacers to keep a gap of ${mm(v.w, 1)} between the slats.`,
        'Make sure that all slots have the same width along their full length.'
      );
    }

    if (item.type === 'membrane') {
      const m = (v.rhoS * v.ts) / 1000;
      rows.push(['Sheet', `${mm(v.ts, 1)} thick, density ${fmt(v.rhoS, 0)} kg/m³`]);
      rows.push(['Surface mass', fmt(m, 2) + ' kg/m²']);
      rows.push(['Sheet mass per panel', fmt(m * areaOne, 2) + ' kg']);
      rows.push(['Cavity depth (back of sheet to wall)', mm(v.depth)]);
      if (hasPorous) rows.push(['Absorber position', posLabel(v, 'Behind the sheet')]);
      qty.sheet = m * areaOne * Q;
      steps.push(`Cut the sheet to ${fmt(W, 0)} × ${fmt(H, 0)} mm from ${mm(v.ts, 1)} material.`);
    }

    if (item.type !== 'porous') {
      steps.push(
        `Make a frame with an inner depth of ${mm(v.depth)}. The outer size is ${fmt(W, 0)} × ${fmt(H, 0)} mm.`,
        'Seal all joints of the frame. The cavity must be closed at all edges. Air must not leak around the panel.',
        'The wall is the back of the cavity. If the wall is not flat and solid, attach a rigid back board to the frame.'
      );
      if (item.values.local) steps.push('Divide the cavity into cells with partitions, as the design specifies.');
      if (hasPorous) {
        if (item.type === 'membrane')
          steps.push(
            `Put ${mm(ta)} of porous absorber in the cavity, ${v.pos === 'wall' && ta < v.depth ? 'against the wall' : 'behind the sheet'}. Do not press the absorber against the sheet. The sheet must move freely.`
          );
        else
          steps.push(
            ta >= v.depth
              ? `Fill the cavity with ${mm(ta)} of porous absorber. Do not compress it.`
              : v.pos === 'wall'
              ? `Put ${mm(ta)} of porous absorber against the wall (back of the cavity). Keep an air space of ${mm(v.depth - ta)} in front of it.`
              : `Put ${mm(ta)} of porous absorber against the back of the panel. Attach it so that it cannot fall away from the panel.`
          );
      }
      if (item.type === 'membrane')
        steps.push('Attach the sheet to the frame at the edges only. Do not add stiffeners in the middle. Stiffeners increase the resonance frequency.');
      else steps.push('Attach the panel to the frame with screws at small intervals. The panel must not vibrate or rattle.');
      steps.push('Attach the frame to the wall.');
      checks.push(`Cavity depth is ${mm(v.depth)}. Measured: ______ mm`, 'The cavity is closed at all edges.');
      if (hasPorous) checks.push(`Absorber thickness is ${mm(ta)} and its position is correct.`);
      if (item.type === 'perforated') checks.push(`Hole diameter is ${mm(v.dh, 1)} and spacing is ${mm(v.D, 1)}.`);
      if (item.type === 'slotted') checks.push(`Slot width is ${mm(v.w, 1)} on all slots.`);
      if (item.type === 'microperforated') checks.push('The sheet is flat and does not vibrate.');
      if (item.type === 'membrane') checks.push('The sheet is attached at the edges only and can move freely.');
    }
    checks.push(`Quantity: ${Q} panels of ${fmt(W, 0)} × ${fmt(H, 0)} mm.`);
    return { rows, warnings, steps, checks, qty };
  }

  /** Build data for a multilayer design (layers stored in item.extra.L, room side first). */
  function buildMultilayer(item) {
    const W = item.panel.w;
    const H = item.panel.h;
    const Q = item.panel.qty;
    const areaOne = (W * H) / 1e6;
    let layers = [];
    try {
      layers = JSON.parse((item.extra && item.extra.L) || '[]');
    } catch (_) {
      layers = [];
    }
    const free = item.values.backing === 'free';
    const rows = [
      ['Panel size (width × height)', `${fmt(W, 0)} × ${fmt(H, 0)} mm`],
      ['Quantity', String(Q)],
      ['Total area', fmt(areaOne * Q, 2) + ' m²'],
      ...(item.extraRows || []),
      ['Back', free ? 'Open air (hangs free)' : 'Rigid wall'],
    ];
    const depth = layers.reduce((s, l) => s + (l.t > 0 ? l.t : 0), 0);
    rows.push(['Total depth', mm(depth)]);
    const qty = { area: areaOne * Q, absorber: [], holes: 0, sheet: null };
    const warnings = [];
    if (layers.some((l) => l.k === 'porous'))
      warnings.push({ level: 'WARNING', text: 'Mineral wool and glass wool can cause irritation of the skin, eyes and lungs. Wear gloves, long sleeves, eye protection and a dust mask (FFP2 or better).' });
    warnings.push({ level: 'WARNING', text: 'Wear eye protection and ear protection when you use power tools.' });
    warnings.push({ level: 'CAUTION', text: 'Make sure that all materials agree with the fire rules of your local building code.' });
    warnings.push({ level: 'CAUTION', text: 'Make sure that the fixings can hold the weight of the panels.' });
    const steps = [`Make a frame of ${fmt(W, 0)} × ${fmt(H, 0)} mm with an inner depth of ${mm(depth)}.`];
    if (!free) steps.push('Seal the frame joints. The back is the wall. If the wall is not flat and solid, add a rigid back board.');
    steps.push(free ? 'Install the layers in this order, from the back to the front:' : 'Install the layers in this order, from the wall to the room:');
    const back = [...layers].reverse();
    back.forEach((l, i) => {
      const n = layers.length - i;
      let s;
      switch (l.k) {
        case 'porous':
          s = `Layer ${n}: put ${mm(l.t)} of porous material (σ ≈ ${fmt(l.sigma, 0)} Pa·s/m²). Do not compress it.`;
          qty.absorber.push({ t: l.t, area: areaOne * Q, vol: areaOne * Q * (l.t / 1000), sigma: l.sigma });
          break;
        case 'air':
          s = `Layer ${n}: keep an air gap of ${mm(l.t)}. Use spacers or battens.`;
          break;
        case 'fabric':
          s = `Layer ${n}: stretch the fabric (flow resistance ≈ ${l.R} Pa·s/m) over the frame.`;
          break;
        case 'perforated': {
          const L = AC.holeLayout({ W: W / 1000, H: H / 1000, D: l.D / 1000, r: l.dh / 2000, pattern: 'square' });
          qty.holes += L.total * Q;
          s = `Layer ${n}: install a ${mm(l.t, 1)} perforated sheet with ${fmt(L.total, 0)} holes of Ø${mm(l.dh, 1)} on a ${mm(l.D, 1)} square grid (first hole ${mm(l.D / 2, 1)} from the edge).`;
          break;
        }
        case 'slotted': {
          const L = AC.slotLayout({ W: W / 1000, H: H / 1000, pitch: l.pitch / 1000, w: l.w / 1000 });
          s = `Layer ${n}: install a ${mm(l.t, 1)} slotted sheet with ${L.count} slots, ${mm(l.w, 1)} wide, at ${mm(l.pitch, 1)} centres.`;
          break;
        }
        case 'mpp':
          s = `Layer ${n}: install a ${mm(l.t, 2)} microperforated sheet (Ø${mm(l.dh, 2)} holes at ${mm(l.D, 2)} centres). Do not paint it.`;
          break;
        case 'membrane':
          s = `Layer ${n}: install a closed sheet of ${l.m} kg/m². Attach it at the edges only.`;
          break;
        default:
          s = `Layer ${n}: ${l.k}`;
      }
      steps.push(s);
    });
    steps.push('Attach every sheet so that it does not rattle. Seal the edges of each air gap.');
    steps.push(free ? 'Hang the panel with a suspension system that is approved for its weight.' : 'Attach the panel to the wall.');
    const checks = [`Total depth is ${mm(depth)}. Measured: ______ mm`, 'The layers are in the correct order.', `Quantity: ${Q} panels of ${fmt(W, 0)} × ${fmt(H, 0)} mm.`];
    return { rows, warnings, steps, checks, qty };
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  // A screen input with a printed copy.
  function editable(value, onInput, opts = {}) {
    const input = el(opts.multiline ? 'textarea' : 'input', {
      class: 'no-print doc-input',
      type: opts.multiline ? null : opts.type || 'text',
      rows: opts.multiline ? 4 : null,
      placeholder: opts.placeholder || '',
      'aria-label': opts.label,
      min: opts.min,
      step: opts.step,
      inputmode: opts.inputmode,
    });
    input.value = value;
    const printed = el('span', { class: 'print-only' + (opts.multiline ? ' pre' : '') }, value || '—');
    input.addEventListener('input', () => {
      printed.textContent = input.value || '—';
      onInput(input.value);
    });
    input.addEventListener('change', () => opts.onChange && opts.onChange(input.value));
    return el('span', { class: 'editable' }, input, printed);
  }

  function renderHeader(root) {
    const set = (k) => (x) => {
      P[k] = x;
      save();
    };
    const field = (label, k, o = {}) => el('div', { class: 'doc-field' }, el('div', { class: 'doc-label' }, label), editable(P[k], set(k), { label, ...o }));
    root.append(
      el(
        'section',
        { class: 'doc-cover' },
        el('div', { class: 'tag' }, 'Acoustic panel project document'),
        el('h1', {}, editable(P.name, (x) => { P.name = x; save(); document.title = (x || 'Project') + ' – Acoustic panels'; }, { label: 'Project name', placeholder: 'Project name' })),
        el(
          'div',
          { class: 'doc-fields' },
          field('Room or location', 'room', { placeholder: 'For example: Meeting room 2' }),
          field('Prepared by', 'author'),
          field('Date', 'date', { type: 'date' })
        ),
        el('div', { class: 'doc-field' }, el('div', { class: 'doc-label' }, 'Notes'), editable(P.notes, set('notes'), { label: 'Notes', multiline: true }))
      )
    );
  }

  function renderSummary(root, datas) {
    const sec = el('section', { class: 'doc-section' }, el('h2', {}, 'Summary'));
    const rows = P.items.map((it, i) => [
      String(i + 1),
      it.label,
      TYPE_NAMES[it.type] || it.type,
      `${fmt(it.panel.w, 0)} × ${fmt(it.panel.h, 0)}`,
      String(it.panel.qty),
      fmt(datas[i].qty.area, 2),
      it.ratings && it.ratings.nrc !== null ? fmt(it.ratings.nrc) : '–',
      it.ratings && it.ratings.aw !== null ? fmt(it.ratings.aw) + (it.ratings.indicators ? ` (${it.ratings.indicators})` : '') : '–',
      it.peak ? `${fmt(it.peak[1])} at ${fmtHz(it.peak[0])}` : '–',
    ]);
    const tbox = el('div');
    UI.table(tbox, ['#', 'Panel', 'Type', 'Size (mm)', 'Qty', 'Area (m²)', 'NRC', 'αw', 'Peak α'], rows);
    sec.append(tbox);

    // Bill of quantities
    const abs = {};
    let holes = 0;
    let sheet = 0;
    let area = 0;
    datas.forEach((d) => {
      area += d.qty.area;
      holes += d.qty.holes;
      if (d.qty.sheet) sheet += d.qty.sheet;
      for (const a of d.qty.absorber) {
        const k = `${a.t} mm, σ ≈ ${fmt(a.sigma, 0)} Pa·s/m²`;
        abs[k] = abs[k] || { area: 0, vol: 0 };
        abs[k].area += a.area;
        abs[k].vol += a.vol;
      }
    });
    const bq = [['Panels, total face area', fmt(area, 2) + ' m²']];
    for (const [k, x] of Object.entries(abs)) bq.push([`Porous absorber ${k}`, `${fmt(x.area, 2)} m² (${fmt(x.vol, 3)} m³)`]);
    if (holes) bq.push(['Holes, total', fmt(holes, 0)]);
    if (sheet) bq.push(['Membrane sheet, total mass', fmt(sheet, 1) + ' kg']);
    const bbox = el('div');
    UI.table(bbox, ['Material', 'Quantity (net, without waste)'], bq);
    sec.append(el('h3', {}, 'Bill of quantities'), bbox);
    root.append(sec);
  }

  function renderItem(root, it, i, d) {
    const sec = el('section', { class: 'doc-section doc-item' });
    const upd = () => {
      save();
      render();
    };
    sec.append(
      el(
        'div',
        { class: 'item-head' },
        el('h2', {}, `${i + 1}. `, editable(it.label, (x) => { it.label = x; save(); }, { label: 'Panel name', onChange: upd })),
        el(
          'div',
          { class: 'btn-row no-print' },
          el('a', { class: 'btn', href: it.page + it.hash }, 'Open in calculator'),
          el('button', { class: 'btn', type: 'button', disabled: i === 0, onclick: () => { P.items.splice(i - 1, 0, P.items.splice(i, 1)[0]); upd(); } }, 'Move up'),
          el('button', { class: 'btn', type: 'button', onclick: () => { if (confirm('Remove "' + it.label + '" from the project?')) { P.items.splice(i, 1); upd(); } } }, 'Remove')
        )
      ),
      el('p', { class: 'derived' }, `${TYPE_NAMES[it.type] || it.type} · ${it.model} · saved ${new Date(it.savedAt).toLocaleDateString('en-GB')}`)
    );

    // Panel size editor (screen only)
    const num = (label, key, unit, step) => {
      const inp = el('input', { type: 'number', min: key === 'qty' ? 1 : 10, step, value: it.panel[key], 'aria-label': label });
      inp.addEventListener('change', () => {
        const x = Number(inp.value);
        if ((key === 'qty' && x >= 1) || (key !== 'qty' && x >= 10)) {
          it.panel[key] = key === 'qty' ? Math.round(x) : x;
          upd();
        } else inp.value = it.panel[key];
      });
      return el('label', { class: 'size-field' }, label + ' ', inp, ' ' + unit);
    };
    if (!it.custom) sec.append(el('div', { class: 'size-row no-print' }, num('Width', 'w', 'mm', 1), num('Height', 'h', 'mm', 1), num('Quantity', 'qty', 'pcs', 1)));

    // Drawing
    if (it.visual && window.VIS && VIS[it.visual[0]]) {
      const spec = it.visual[0] === 'panel' ? { ...it.visual[1], w: it.panel.w, h: it.panel.h } : it.visual[1];
      const vbox = el('div', { class: 'panel-view' });
      try {
        VIS[it.visual[0]](vbox, spec);
        sec.append(el('h3', {}, 'Drawing'), vbox);
      } catch (_) {
        /* drawing not available */
      }
    }

    // Cross-section + key results
    const k = el('div');
    let kp;
    if (it.custom) kp = it.kpis || [];
    else {
      kp = [
        { label: 'Peak absorption', value: fmt(it.peak[1]), sub: 'at ' + fmtHz(it.peak[0]) },
        { label: 'NRC', value: it.ratings.nrc !== null ? fmt(it.ratings.nrc) : '–' },
        { label: 'αw', value: it.ratings.aw !== null ? fmt(it.ratings.aw) + (it.ratings.indicators ? ` (${it.ratings.indicators})` : '') : '–', sub: it.ratings.cls ? 'Class ' + it.ratings.cls : '' },
      ];
      if (it.resonance) kp.splice(1, 0, { label: it.resonance.label, value: fmtHz(it.resonance.f), sub: it.resonance.sub });
    }
    UI.kpis(k, kp);
    if (it.parts) {
      const diag = el('div', { class: 'diagram' });
      UI.diagram(diag, it.parts, { open: it.values && it.values.backing === 'free' });
      sec.append(el('div', { class: 'item-top' }, el('div', {}, el('h3', {}, 'Cross-section'), diag), el('div', {}, el('h3', {}, 'Key results (' + it.incidence + ')'), k)));
    } else sec.append(el('h3', {}, 'Key results'), k);

    // Build data
    const bd = el('div');
    UI.table(bd, ['Build data', 'Value'], d.rows);
    sec.append(el('h3', {}, 'Build data'), bd);
    if (it.custom && it.table) {
      const tb = el('div');
      UI.table(tb, it.table.headers, it.table.rows);
      sec.append(tb);
    }

    // Safety + steps + checks
    sec.append(el('h3', {}, 'Safety'));
    sec.append(el('ul', { class: 'notes' }, d.warnings.map((w) => el('li', { class: w.level === 'NOTE' ? '' : 'warn' }, el('b', {}, w.level + ': '), w.text))));
    sec.append(el('h3', {}, 'Build procedure'), el('ol', { class: 'steps' }, d.steps.map((s) => el('li', {}, s))));
    sec.append(el('h3', {}, 'Inspection'), el('ul', { class: 'checklist' }, d.checks.map((c) => el('li', {}, el('span', { class: 'box', 'aria-hidden': 'true' }), c))));

    // Chart and bands
    const ch = el('div');
    if (it.custom && it.chart) {
      const ys = it.chart.series.flatMap((x) => x.points.map((p) => p[1]));
      const ymax = Math.max(1, ...ys);
      const top = ymax <= 1 ? 1 : Math.ceil(ymax);
      const stp = top / 5;
      UI.chart(ch, {
        series: it.chart.series,
        legend: it.chart.series.length > 1,
        xMin: it.chart.xMin,
        xMax: it.chart.xMax,
        yMin: 0,
        yMax: top,
        xTicks: [125, 250, 500, 1000, 2000, 4000].filter((x) => x >= it.chart.xMin && x <= it.chart.xMax),
        xFmt: (x, h) => (h ? fmtHz(x) : UI.freqTickFmt(x)),
        yTicks: [0, 1, 2, 3, 4, 5].map((q) => +(q * stp).toFixed(2)),
        yFmt: (y, h) => fmt(y, h ? 2 : 1),
        xLabel: 'Frequency (Hz)',
        yLabel: it.chart.yLabel,
        height: 300,
      });
      sec.append(el('h3', {}, 'Predicted performance'), ch);
      if (it.extraTable) {
        const et = el('div');
        UI.table(et, it.extraTable.headers, it.extraTable.rows);
        sec.append(et);
      }
    } else if (!it.custom) {
      UI.chart(ch, {
        series: [{ name: it.label, points: it.curve, width: 2.5 }],
        xMin: 50,
        xMax: 10000,
        yMin: Math.min(0, ...it.curve.map((p) => p[1])) < 0 ? -0.1 : 0,
        yMax: 1,
        xTicks: [63, 125, 250, 500, 1000, 2000, 4000, 8000],
        xFmt: (x, h) => (h ? fmtHz(x) : UI.freqTickFmt(x)),
        yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1],
        yFmt: (y, h) => fmt(y, h ? 2 : 1),
        xLabel: 'Frequency (Hz)',
        yLabel: 'Absorption coefficient α',
        height: 300,
      });
      sec.append(el('h3', {}, 'Predicted absorption (' + it.incidence + ')'), ch);
      const ob = el('div');
      const octs = [125, 250, 500, 1000, 2000, 4000];
      UI.table(ob, ['Octave band (Hz)', ...octs.map(String)], [['α', ...octs.map((o) => fmt(it.octave[o]))]]);
      sec.append(ob);
    }

    // Inputs
    if (it.inputs && it.inputs.length) {
      const ib = el('div');
      UI.table(ib, ['Design input', 'Value'], it.inputs);
      sec.append(el('h3', {}, 'Design inputs'), ib);
    }
    const notes = [...(it.notes || []), 'These values are predictions from published models. Real panels can be different.'];
    sec.append(el('ul', { class: 'notes' }, notes.map((n) => el('li', {}, n))));
    root.append(sec);
  }

  const docRoot = document.getElementById('doc');
  function render() {
    docRoot.innerHTML = '';
    renderHeader(docRoot);
    if (!P.items.length) {
      docRoot.append(
        el(
          'section',
          { class: 'doc-section' },
          el('h2', {}, 'No designs'),
          el('p', {}, 'The project has no designs. Open a panel calculator, make a design, and click "Add to project".'),
          el('p', {}, el('a', { href: 'perforated.html' }, 'Perforated'), ' · ', el('a', { href: 'slotted.html' }, 'Slotted'), ' · ', el('a', { href: 'porous.html' }, 'Porous'), ' · ', el('a', { href: 'microperforated.html' }, 'Microperforated'), ' · ', el('a', { href: 'membrane.html' }, 'Membrane'))
        )
      );
      return;
    }
    const datas = P.items.map(buildData);
    renderSummary(docRoot, datas);
    P.items.forEach((it, i) => renderItem(docRoot, it, i, datas[i]));
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar                                                             */
  /* ------------------------------------------------------------------ */
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ format: 'acoustic-calculator-project', version: 1, project: P }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (P.name || 'project').replace(/[^\w-]+/g, '_') + '.acoustic.json' });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  });
  const fileIn = document.getElementById('import-file');
  document.getElementById('import').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const p = data.project || data;
      if (!p || !Array.isArray(p.items)) throw new Error('bad');
      if (P.items.length && !confirm('Replace the current project with the project in this file?')) return;
      P = { ...UI.project.empty(), ...p };
      save();
      render();
    } catch (_) {
      alert('This file is not a project file of the Acoustic Calculator.');
    } finally {
      fileIn.value = '';
    }
  });
  document.getElementById('clear').addEventListener('click', () => {
    if (!confirm('Delete all designs and project data from this browser?')) return;
    P = UI.project.empty();
    save();
    render();
  });

  document.title = (P.name || 'Project') + ' – Acoustic panels';
  render();
})();
