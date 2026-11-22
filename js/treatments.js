/*
 * Acoustic Calculator – treatment catalogue for the room advisor.
 * Every modelled entry gets its absorption from the tested models in core.js
 * (diffuse field, octave bands). Assumptions are listed for each entry.
 * Exposes the global "TREAT". Needs core.js (AC).
 */
(function (root) {
  'use strict';
  const OCTS = [125, 250, 500, 1000, 2000, 4000];
  const THIRDS = {
    125: [100, 125, 160],
    250: [200, 250, 315],
    500: [400, 500, 630],
    1000: [800, 1000, 1250],
    2000: [1600, 2000, 2500],
    4000: [3150, 4000, 5000],
  };

  /** Octave α (diffuse field) of a construction: mean of three 1/3-octave band means. */
  function octaveAlpha(cons, a) {
    const f = (fr) => Math.max(0, AC.absorption(fr, a, cons, { mode: 'diffuse', steps: 45 }).alpha);
    return OCTS.map((o) => THIRDS[o].reduce((s, n) => s + AC.thirdOctaveBandMean(f, n, 3), 0) / 3);
  }

  const wool = (t, sigma = 10000) => ({ type: 'porous', thickness: t / 1000, sigma, model: 'db' });
  const air = (t) => ({ type: 'air', thickness: t / 1000 });

  /* Assumed dimensions of common retail products. Check the product before use. */
  // Standard 1/4" hardboard pegboard: 9/32" holes at 1" centres (DPI product data).
  const PEG = { t: 6.35, d: 7.14, D: 25.4 };

  /** Example spectrum for a published αw: the ISO 11654 reference curve shifted to αw; 125 Hz unknown → 0. */
  function classSpectrum(aw) {
    const ref = [0.8, 1.0, 1.0, 1.0, 0.9];
    return [0, ...ref.map((r) => Math.max(0, +(r - (1 - aw)).toFixed(2)))];
  }

  /**
   * Catalogue. kind: 'model' (calculated), 'info' (no numbers).
   * place: where to put it. examples: shop products of this type (names only; check the data sheet).
   */
  const CATALOG = [
    {
      id: 'por50', kind: 'model', group: 'Panels you can build or buy', name: 'Porous panel 50 mm on the wall',
      text: 'Mineral wool or glass wool panel with fabric, fixed directly to the wall.',
      place: 'Walls, first reflection points', range: 'Middle and high', page: 'porous.html#ta=50&gap=0',
      cons: () => ({ layers: [wool(50)] }), assumptions: ['σ = 10 000 Pa·s/m²'],
    },
    {
      id: 'por100', kind: 'model', group: 'Panels you can build or buy', name: 'Porous panel 100 mm on the wall',
      text: 'Thick mineral wool panel with fabric. Absorbs lower frequencies than a 50 mm panel.',
      place: 'Walls, rear wall', range: 'Low-middle to high', page: 'porous.html#ta=100&gap=0',
      cons: () => ({ layers: [wool(100)] }), assumptions: ['σ = 10 000 Pa·s/m²'],
    },
    {
      id: 'bb', kind: 'model', group: 'Panels you can build or buy', name: 'Broadband panel: 50 mm wool + 100 mm air gap',
      text: 'A 50 mm porous panel on spacers, 100 mm from the wall. The air gap increases low-frequency absorption.',
      place: 'Walls, rear wall', range: 'Wide', page: 'porous.html#ta=50&gap=100',
      cons: () => ({ layers: [air(100), wool(50)] }), assumptions: ['σ = 10 000 Pa·s/m²', 'Air gap without partitions'],
    },
    {
      id: 'cloud', kind: 'model', group: 'Panels you can build or buy', name: 'Ceiling cloud 50 mm, 300 mm below the ceiling',
      text: 'A porous panel that hangs below the ceiling. Values are per m² of panel (lower face only, model A).',
      place: 'Ceiling', range: 'Middle and high', page: 'clouds.html', mount: 'ceiling',
      cons: () => ({ layers: [air(300), wool(50)] }), assumptions: ['σ = 10 000 Pa·s/m²', 'Lower face only; real clouds absorb more (edges, upper face)'],
    },
    {
      id: 'membrane', kind: 'model', group: 'Bass absorbers', name: 'Membrane bass panel (6 mm plywood, 100 mm cavity)',
      text: 'A closed plywood sheet on an airtight frame with 50 mm wool in the cavity. Absorbs a band near 90 Hz.',
      place: 'Walls near corners', range: 'Low', page: 'membrane.html#rhoS=700&ts=6&depth=100&ta=50',
      cons: () => ({ layers: [air(50), wool(50)], facing: AC.membraneFacing({ m: 4.2 }) }), assumptions: ['Limp sheet, 4.2 kg/m²', 'No stiffness or edge losses'],
    },
    {
      id: 'deep', kind: 'model', group: 'Bass absorbers', name: 'Deep porous bass absorber: 100 mm wool + 200 mm air gap',
      text: 'Thick porous panel far from the wall, or across a corner. Absorbs low and middle frequencies.',
      place: 'Corners, rear wall', range: 'Low to high', page: 'porous.html#ta=100&gap=200',
      cons: () => ({ layers: [air(200), wool(100)] }), assumptions: ['σ = 10 000 Pa·s/m²', 'Flat panel model (a corner shape is not modelled)'],
    },
    {
      id: 'perf', kind: 'model', group: 'Bass absorbers', name: 'Perforated panel resonator (Ø8 mm @ 32 mm, 12 mm board)',
      text: 'Perforated board on a 100 mm frame with 50 mm wool behind the board. Absorbs a low-middle band.',
      place: 'Walls', range: 'Low-middle', page: 'perforated.html#t=12&dh=8&D=32&depth=100&ta=50&pos=panel',
      cons: () => ({ layers: [air(50), wool(50)], facing: AC.perforatedFacing({ t: 0.012, a: 0.004, D: 0.032 }) }), assumptions: ['σ = 10 000 Pa·s/m²'],
    },
    {
      id: 'slatA', kind: 'class', aw: 0.9, group: 'Shop products (published data)', name: 'Wood slat panel on felt, on 45 mm battens with insulation (published class A)',
      text: 'Slats on a felt backing ("akupanel" type), sold by many shops, for example Bauhaus. Lundbergs publishes class A− for this mounting.',
      place: 'Walls, ceiling', range: 'Wide', source: 'Lundbergs product guide: class A− on 45 mm battens with insulation',
      assumptions: ['Spectrum: ISO 11654 reference curve at αw = 0.90 (class A lower limit)', 'No data at 125 Hz: 0 is used'],
    },
    {
      id: 'slatD', kind: 'class', aw: 0.3, group: 'Shop products (published data)', name: 'Wood slat panel on felt, fixed directly to the wall (published class D)',
      text: 'The same slat panel, glued or screwed directly to the wall. Lundbergs publishes class D− for this mounting.',
      place: 'Walls', range: 'Middle and high', source: 'Lundbergs product guide: class D− directly on wall or ceiling',
      assumptions: ['Spectrum: ISO 11654 reference curve at αw = 0.30 (class D lower limit)', 'No data at 125 Hz: 0 is used'],
    },
    {
      id: 'slatC', kind: 'class', aw: 0.6, group: 'Shop products (published data)', name: 'Wood slat panel 15 mm, Rusta (published class C, mounting not stated)',
      text: 'Rusta sells a 1175 × 360 mm slat panel, 15 mm thick, with 13 mm slat gaps and PET felt. Rusta gives class C, but does not state the mounting.',
      place: 'Walls', range: 'Middle and high', source: 'Rusta product page: "klass C"',
      assumptions: ['Spectrum: ISO 11654 reference curve at αw = 0.60 (class C lower limit)', 'No data at 125 Hz: 0 is used', 'Mounting of the test is not stated'],
    },
    {
      id: 'felt', kind: 'measured', group: 'Shop products (published data)', name: 'PET felt panel 12 mm, fixed directly to the wall (measured)',
      text: 'Polyester felt panels or tiles glued to the wall, for example hexagonal felt tiles (sold by Rusta and others). Thin felt absorbs mainly high frequencies.',
      place: 'Walls', range: 'High', source: 'Benjo PET felt data sheet, ISO 354 (αw 0.25). A 9 mm felt also has αw 0.25 (Peutz report A 4576-2E-RA-001)',
      alpha: [0.0, 0.05, 0.22, 0.49, 0.71, 0.94],
      assumptions: ['Measured values of one 12 mm product. Rusta does not publish data for its hexagonal tiles.'],
    },
    {
      id: 'felt50', kind: 'class', aw: 0.55, group: 'Shop products (published data)', name: 'PET felt 9 mm with 50 mm air gap (measured αw 0.55)',
      text: 'Felt panels mounted on spacers, 50 mm from the wall. The air gap increases the absorption.',
      place: 'Walls, ceiling', range: 'Middle and high', source: 'Peutz report A 4576-2E-RA-001: αw 0.55 (class D)',
      assumptions: ['Spectrum: ISO 11654 reference curve at αw = 0.55', 'No data at 125 Hz: 0 is used'],
    },
    {
      id: 'felt100', kind: 'class', aw: 0.75, group: 'Shop products (published data)', name: 'PET felt 9 mm with 100 mm air gap (measured αw 0.75)',
      text: 'Felt panels or baffles 100 mm from the wall or ceiling.',
      place: 'Walls, ceiling', range: 'Middle and high', source: 'Peutz report A 4576-2E-RA-001: αw 0.75 (class C)',
      assumptions: ['Spectrum: ISO 11654 reference curve at αw = 0.75', 'No data at 125 Hz: 0 is used'],
    },
    {
      id: 'peg', kind: 'model', group: 'Shop products (product types)', name: 'Pegboard on 50 mm battens with 50 mm wool behind',
      text: 'A standard 6 mm hardboard pegboard on battens, with mineral wool in the cavity. Without the wool the absorption is low. IKEA SKÅDIS is a fibreboard pegboard, but IKEA does not publish its hole size and spacing, so check them and use the perforated panel calculator.',
      place: 'Walls (also storage)', range: 'Middle', page: `perforated.html#t=${PEG.t}&dh=${PEG.d}&D=${PEG.D}&depth=50&ta=50&pos=panel`,
      cons: () => ({ layers: [wool(50)], facing: AC.perforatedFacing({ t: PEG.t / 1000, a: PEG.d / 2000, D: PEG.D / 1000 }) }),
      assumptions: [`Standard 1/4" pegboard: ${PEG.t} mm board, Ø${PEG.d} mm (9/32") holes at ${PEG.D} mm (1")`, 'Round holes; other hole shapes change the result'],
    },
  ];

  /** Furniture and soft furnishings: useful, but not counted in the numbers. */
  const FURNITURE = [
    { name: 'Bookshelves with books', text: 'Books of different depths scatter sound and absorb some sound. The German workplace rule ASR A3.7 gives a mean absorption coefficient of 0.35 (250–2000 Hz) for library bookshelves. Fill the shelves and put the books at different depths. A bookshelf on the rear wall of a listening room breaks up reflections.', examples: 'For example IKEA BILLY or KALLAX.' },
    { name: 'Upholstered sofa and chairs', text: 'Soft seats absorb middle and high frequencies. People on the seats absorb more.' },
    { name: 'Rugs and carpet', text: 'Absorb high frequencies and decrease footstep noise. ASR A3.7 gives mean absorption coefficients (250–2000 Hz) of 0.15 for carpet with pile up to 6 mm, 0.26 for 7–10 mm pile, and 0.57 for 5 mm carpet on a 5 mm felt underlay. They have little effect on bass.' },
    { name: 'Heavy curtains', text: 'Hang heavy curtains with folds, 100 mm or more from the window or wall. They absorb middle and high frequencies, and cover reflective glass.' },
    { name: 'Wall hangings and textiles', text: 'Thin textiles on a wall absorb only high frequencies. With an air gap behind them, they absorb more.' },
    { name: 'Open storage with items', text: 'Shelves with boxes, files and objects break up flat walls and decrease flutter echo.' },
  ];

  for (const t of CATALOG) if (t.kind === 'class') t.alpha = classSpectrum(t.aw);
  root.TREAT = { OCTS, octaveAlpha, CATALOG, FURNITURE, PEG, classSpectrum };
})(this);
