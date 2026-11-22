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
  const SLAT = { t: 12, w: 13, pitch: 40, felt: 9, feltSigma: 20000 }; // slats on felt backing
  const FELT = { t: 9, sigma: 20000 }; // PET felt tiles
  const PEG = { t: 5, d: 6.35, D: 25.4 }; // standard hardboard pegboard (1/4" holes, 1" centres)

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
      id: 'slatwall', kind: 'model', group: 'Shop products (product types)', name: 'Wood slat panel on felt, fixed directly to the wall',
      text: 'Wood or MDF slats glued on a felt backing ("akupanel" type). Sold by many shops, for example Bauhaus.',
      place: 'Walls', range: 'Middle and high (low when on the wall)', page: 'multilayer.html',
      cons: () => ({ layers: [wool(SLAT.felt, SLAT.feltSigma)], facing: AC.slottedFacing({ t: SLAT.t / 1000, w: SLAT.w / 1000, pitch: SLAT.pitch / 1000 }) }),
      assumptions: [`Slats ${SLAT.t} mm thick, ${SLAT.pitch - SLAT.w} mm wide, ${SLAT.w} mm gaps`, `Felt ${SLAT.felt} mm, σ ≈ ${SLAT.feltSigma} Pa·s/m² (assumed)`],
    },
    {
      id: 'slatbatten', kind: 'model', group: 'Shop products (product types)', name: 'Wood slat panel on felt, on 45 mm battens with 45 mm wool',
      text: 'The same slat panel, fixed on battens with mineral wool behind. The wool and the depth give more absorption at low and middle frequencies.',
      place: 'Walls, ceiling', range: 'Low-middle to high', page: 'multilayer.html',
      cons: () => ({ layers: [wool(45), wool(SLAT.felt, SLAT.feltSigma)], facing: AC.slottedFacing({ t: SLAT.t / 1000, w: SLAT.w / 1000, pitch: SLAT.pitch / 1000 }) }),
      assumptions: [`Slats ${SLAT.t} mm thick, ${SLAT.pitch - SLAT.w} mm wide, ${SLAT.w} mm gaps`, `Felt ${SLAT.felt} mm, σ ≈ ${SLAT.feltSigma} Pa·s/m² (assumed)`, '45 mm mineral wool, σ = 10 000 Pa·s/m²'],
    },
    {
      id: 'felt', kind: 'model', group: 'Shop products (product types)', name: 'Felt wall tiles 9 mm (for example hexagonal PET felt)',
      text: 'Thin polyester felt tiles glued to the wall. Sold by many shops, for example Rusta. Thin tiles absorb mainly high frequencies.',
      place: 'Walls', range: 'High', page: 'porous.html#ta=9&sigma=20000&gap=0',
      cons: () => ({ layers: [wool(FELT.t, FELT.sigma)] }), assumptions: [`${FELT.t} mm felt, σ ≈ ${FELT.sigma} Pa·s/m² (assumed)`],
    },
    {
      id: 'peg', kind: 'model', group: 'Shop products (product types)', name: 'Pegboard on 50 mm battens with 50 mm wool behind',
      text: 'A hardboard pegboard (for example IKEA SKÅDIS or a standard pegboard) on battens, with mineral wool in the cavity. Without the wool the absorption is low.',
      place: 'Walls (also storage)', range: 'Middle', page: `perforated.html#t=${PEG.t}&dh=${PEG.d}&D=${PEG.D}&depth=50&ta=50&pos=panel`,
      cons: () => ({ layers: [wool(50)], facing: AC.perforatedFacing({ t: PEG.t / 1000, a: PEG.d / 2000, D: PEG.D / 1000 }) }),
      assumptions: [`Standard pegboard: ${PEG.t} mm board, Ø${PEG.d} mm holes at ${PEG.D} mm (check your board)`, 'Round holes; other hole shapes change the result'],
    },
  ];

  /** Furniture and soft furnishings: useful, but not counted in the numbers. */
  const FURNITURE = [
    { name: 'Bookshelves with books', text: 'Books of different depths scatter sound and absorb a little. Fill the shelves, and put the books at different depths. A bookshelf on the rear wall of a listening room breaks up reflections.', examples: 'For example IKEA BILLY or KALLAX.' },
    { name: 'Upholstered sofa and chairs', text: 'Soft seats absorb middle and high frequencies. People on the seats absorb more.' },
    { name: 'Rugs and carpet', text: 'Absorb high frequencies and decrease footstep noise. A thick rug on an underlay absorbs more. They have little effect on bass.' },
    { name: 'Heavy curtains', text: 'Hang heavy curtains with folds, 100 mm or more from the window or wall. They absorb middle and high frequencies, and cover reflective glass.' },
    { name: 'Wall hangings and textiles', text: 'Thin textiles on a wall absorb only high frequencies. With an air gap behind them, they absorb more.' },
    { name: 'Open storage with items', text: 'Shelves with boxes, files and objects break up flat walls and decrease flutter echo.' },
  ];

  root.TREAT = { OCTS, octaveAlpha, CATALOG, FURNITURE, SLAT, FELT, PEG };
})(this);
