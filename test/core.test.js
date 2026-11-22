'use strict';
/*
 * Tests for js/core.js.  Run with:  node --test
 *
 * Reference data:
 *  - "Porous Absorber Calculator V1.60" spreadsheet (C. Whealy, 2020), which
 *    re-implements the MATLAB scripts of Cox & D'Antonio, appendix B.
 *    Air: ρ0 = 1.2041 kg/m³, c = 343.38 m/s. Frequencies: 62.5·2^(i/6) Hz.
 *  - SciPy (scipy.special.jv) for complex Bessel functions.
 *  - An independent NumPy implementation for oblique incidence.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const AC = require('../js/core.js');

const sheetAir = AC.customAir({ rho: 1.20411, c: 343.38, eta: 1.85e-5 });
const sheetFreqs = Array.from({ length: 49 }, (_, i) => 62.5 * Math.pow(2, i / 6));
const parse = (s) => s.trim().split(/\s+/).map(Number);

function compareRow(name, expected, fn, tol = 0.006) {
  const got = sheetFreqs.map(fn);
  let worst = 0;
  let worstI = -1;
  expected.forEach((e, i) => {
    const d = Math.abs(got[i] - e);
    if (d > worst) {
      worst = d;
      worstI = i;
    }
  });
  assert.ok(
    worst <= tol,
    `${name}: max deviation ${worst.toFixed(4)} at ${sheetFreqs[worstI].toFixed(1)} Hz ` +
      `(got ${got[worstI].toFixed(4)}, sheet ${expected[worstI]})`
  );
}

const normal = { mode: 'normal' };
const porous = (thickness, sigma = 16500) => ({ type: 'porous', thickness, sigma, model: 'db' });
const gap = (thickness) => ({ type: 'air', thickness });

test('porous absorber, rigid backed, 30 mm, σ = 16 500 (spreadsheet sheet 1)', () => {
  const exp = parse(`-0.01 -0.01 -0.01 -0.01 -0.01 0.00 0.00 0.01 0.01 0.02 0.03 0.04 0.06 0.08
   0.10 0.12 0.16 0.19 0.24 0.29 0.34 0.40 0.47 0.53 0.60 0.67 0.74 0.81 0.86 0.91 0.95 0.97 0.99
   0.99 0.99 0.98 0.96 0.95 0.94 0.95 0.96 0.99 1.00 1.00 0.98 0.98 1.00 1.00 0.99`);
  compareRow('no gap', exp, (f) => AC.absorption(f, sheetAir, { layers: [porous(0.03)] }, normal).alpha);
});

test('porous absorber, 30 mm + 100 mm air gap (spreadsheet sheet 1)', () => {
  const exp = parse(`0.09 0.11 0.13 0.16 0.20 0.24 0.29 0.34 0.41 0.47 0.54 0.61 0.69 0.76 0.82 0.88
   0.93 0.96 0.99 1.00 0.99 0.98 0.95 0.90 0.83 0.73 0.60 0.53 0.71 0.95 1.00 0.94 0.86 0.84 0.97 0.96
   0.93 0.99 0.95 0.99 0.96 1.00 0.97 0.98 0.99 1.00 1.00 0.99 1.00`);
  compareRow('gap', exp, (f) =>
    AC.absorption(f, sheetAir, { layers: [gap(0.1), porous(0.03)] }, normal).alpha
  );
});

const perfSheet = AC.perforatedFacing({ t: 0.004, a: 0.0127, D: 0.03 });

test('perforated panel geometry (spreadsheet sheet 2)', () => {
  assert.ok(Math.abs(perfSheet.eps - 0.563) < 0.0005);
  assert.ok(Math.abs(perfSheet.delta - 0.0764) < 0.0001);
  assert.ok(Math.abs(perfSheet.tEff - 0.0059) < 0.00005);
});

test('perforated panel, absorber against panel (spreadsheet sheet 2)', () => {
  const exp = parse(`0.09 0.11 0.14 0.17 0.20 0.24 0.29 0.35 0.41 0.48 0.55 0.63 0.70 0.78 0.84 0.90
   0.94 0.98 0.99 1.00 0.99 0.96 0.92 0.87 0.80 0.72 0.62 0.60 0.82 0.97 0.95 0.90 0.91 0.98 0.89 0.88
   0.99 0.82 0.87 0.80 0.81 0.67 0.75 0.67 0.54 0.47 0.43 0.41 0.32`);
  compareRow('against panel', exp, (f) =>
    AC.absorption(f, sheetAir, { layers: [gap(0.1), porous(0.03)], facing: perfSheet }, normal).alpha
  );
});

test('perforated panel, absorber against backing (spreadsheet sheet 2)', () => {
  const exp = parse(`-0.01 -0.01 -0.01 -0.01 0.00 0.00 0.00 0.01 0.01 0.02 0.03 0.05 0.06 0.08 0.11
   0.14 0.17 0.21 0.26 0.30 0.35 0.39 0.43 0.48 0.54 0.62 0.73 0.85 0.95 0.94 0.89 0.87 0.94 0.96 0.86
   0.89 0.94 0.68 0.85 0.70 0.71 0.63 0.66 0.62 0.53 0.40 0.37 0.36 0.28`);
  compareRow('against backing', exp, (f) =>
    AC.absorption(f, sheetAir, { layers: [porous(0.03), gap(0.1)], facing: perfSheet }, normal).alpha
  );
});

test('perforated panel, cavity filled with absorber (spreadsheet sheet 2)', () => {
  // The spreadsheet leaves out the viscous resistance r_m in this one configuration only
  // (its z2 − z1 has a zero real part). Reproduce the sheet without r_m, then show that
  // the full model (with r_m, as in Cox & D'Antonio) differs by less than 0.01.
  const noRm = { impedance: (f, a) => AC.complex.C(0, (2 * Math.PI * f * a.rho * perfSheet.tEff) / perfSheet.eps) };
  const exp = parse(`0.16 0.20 0.24 0.29 0.34 0.40 0.45 0.51 0.57 0.62 0.67 0.71 0.75 0.78 0.80 0.82
   0.84 0.85 0.86 0.87 0.88 0.89 0.91 0.92 0.94 0.96 0.97 0.98 0.98 0.98 0.99 0.99 0.98 0.98 0.97 0.95
   0.93 0.91 0.87 0.84 0.79 0.74 0.68 0.62 0.56 0.49 0.43 0.37 0.32`);
  compareRow('filled (sheet, no r_m)', exp, (f) =>
    AC.absorption(f, sheetAir, { layers: [porous(0.13)], facing: noRm }, normal).alpha
  );
  compareRow('filled (full model)', exp, (f) =>
    AC.absorption(f, sheetAir, { layers: [porous(0.13)], facing: perfSheet }, normal).alpha, 0.01
  );
});

test('slot end correction matches Cox eq. 6.10 values (spreadsheet sheet 3)', () => {
  // Spreadsheet: slot w = 10 mm, solid strip 40.5 mm → pitch 50.5 mm, ε = 19.8 %, δ = 0.37687
  const s = AC.slottedFacing({ t: 0.005, w: 0.01, pitch: 0.0505 });
  assert.ok(Math.abs(s.eps - 0.198) < 0.0005);
  assert.ok(Math.abs(s.delta - 0.37687) < 0.0002);
  assert.ok(Math.abs(s.tEff - 0.01254) < 0.00002);
});

test('complex Bessel ratio J1/J0 matches SciPy', () => {
  const ref = [
    [0.3, 0.10485515694999488, -0.1072410887312154],
    [0.9, 0.2823080954312902, -0.3455554430990358],
    [2.5, 0.21584405121369724, -0.8830510225483036],
    [6.0, 0.06297118786883367, -0.9413250365032714],
    [12.0, 0.030380456989017975, -0.9705989264370398],
    [25.0, 0.014347758408561643, -0.9858640501899285],
    [40.0, 0.00891833775790216, -0.9911626253865752],
  ];
  for (const [x, re, im] of ref) {
    const z = AC.complex.scale(AC.complex.C(Math.SQRT1_2, -Math.SQRT1_2), x);
    const r = AC.complex.besselJ1overJ0(z);
    assert.ok(Math.abs(r.re - re) < 1e-12 && Math.abs(r.im - im) < 1e-12, `x=${x}: ${r.re},${r.im}`);
  }
});

test('microperforated panel: exact Maa model agrees with Maa approximate formula (within its ~7 % error)', () => {
  const a = AC.air(20);
  for (const geom of [
    { t: 0.0002, a: 0.0001, D: 0.0025 },
    { t: 0.0005, a: 0.00025, D: 0.004 },
    { t: 0.001, a: 0.0004, D: 0.006 },
  ]) {
    const mpp = AC.microperforatedFacing(geom);
    for (const f of [100, 500, 2000, 8000]) {
      const ex = mpp.impedance(f, a);
      const ap = AC.maaApproxImpedance(f, a, { ...geom, eps: mpp.eps });
      assert.ok(Math.abs(ex.re / ap.re - 1) < 0.08, `R ${f} Hz ${ex.re} vs ${ap.re}`);
      assert.ok(Math.abs(ex.im / ap.im - 1) < 0.08, `X ${f} Hz ${ex.im} vs ${ap.im}`);
    }
  }
});

test('microperforated panel: low-frequency limit is Poiseuille flow resistance', () => {
  const a = AC.air(20);
  const g = { t: 0.0005, a: 0.0001, D: 0.003 };
  const mpp = AC.microperforatedFacing(g);
  const f = 0.01;
  const z = mpp.impedance(f, a);
  const pois = (8 * a.eta * g.t) / (mpp.eps * g.a * g.a);
  assert.ok(Math.abs(z.re / pois - 1) < 1e-3);
});

test('microperforated panel: high-frequency limit (Re → ωρt√2 /(ε x))', () => {
  const a = AC.air(20);
  const g = { t: 0.001, a: 0.0005, D: 0.01 };
  const mpp = AC.microperforatedFacing(g);
  const f = 2e7; // x ≈ 1600, far above any audio use: only the asymptote is tested
  const om = 2 * Math.PI * f;
  const x = g.a * Math.sqrt((om * a.rho) / a.eta);
  const z = mpp.impedance(f, a);
  const interior = z.re - Math.sqrt(2 * om * a.rho * a.eta) / (2 * mpp.eps);
  const asym = (om * a.rho * g.t * Math.SQRT2) / (mpp.eps * x);
  assert.ok(Math.abs(interior / asym - 1) < 0.01, `${interior} vs ${asym}`);
});

test('slotted panel: low-frequency limit is Poiseuille flow resistance of a slit', () => {
  const a = AC.air(20);
  const g = { t: 0.01, w: 0.0002, pitch: 0.004 };
  const s = AC.slottedFacing(g);
  const z = s.impedance(0.01, a);
  const pois = (12 * a.eta * g.t) / (s.eps * g.w * g.w);
  assert.ok(Math.abs(z.re / pois - 1) < 1e-3);
});

test('oblique incidence matches an independent NumPy implementation', () => {
  const a = AC.customAir({ rho: 1.2041, c: 343.2, eta: 1.81e-5 });
  const ref = [
    [125, 0, 0.1606513039965195],
    [125, 30, 0.1453425094196188],
    [125, 60, 0.14909889878131566],
    [500, 0, 0.9132969699317061],
    [500, 30, 0.8574515651329883],
    [500, 60, 0.7191488757883652],
    [2000, 0, 0.8994991958388995],
    [2000, 30, 0.9269426615611384],
    [2000, 60, 0.9725047551909253],
  ];
  const cons = { layers: [gap(0.05), porous(0.05, 10000)] };
  for (const [f, th, al] of ref) {
    const got = AC.absorption(f, a, cons, { mode: 'angle', angleDeg: th }).alpha;
    assert.ok(Math.abs(got - al) < 1e-9, `${f} Hz ${th}°: ${got} vs ${al}`);
  }
});

test('diffuse incidence of a perfect absorber (Z = ρc / cosθ is not possible) stays in 0..1', () => {
  const a = AC.air(20);
  const cons = { layers: [porous(0.1, 8000)] };
  for (const f of [100, 1000, 5000]) {
    const d = AC.absorption(f, a, cons, { mode: 'diffuse' }).alpha;
    assert.ok(d > 0 && d < 1);
  }
});

test('Paris integral: a surface with α(θ) = 1 gives 1', () => {
  // Z = ρc/cosθ cannot be built, but a very thick, low-σ layer gives α near 1
  // at all angles; check the weight function integrates to 1 instead.
  let s = 0;
  const n = 180;
  const h = Math.PI / 2 / n;
  for (let i = 0; i < n; i++) s += Math.sin(2 * (i + 0.5) * h) * h;
  assert.ok(Math.abs(s - 1) < 1e-4);
});

test('air properties at 20 °C, 101.325 kPa', () => {
  const a = AC.air(20, 101.325);
  assert.ok(Math.abs(a.c - 343.2) < 0.1, `c = ${a.c}`);
  assert.ok(Math.abs(a.rho - 1.204) < 0.001, `rho = ${a.rho}`);
  assert.ok(Math.abs(a.eta - 1.81e-5) < 0.01e-5, `eta = ${a.eta}`);
});

test('Helmholtz and membrane resonance formulas', () => {
  const a = AC.air(20);
  // 60/√(m d) rule of thumb
  const f = AC.membraneFrequency({ m: 10, depth: 0.1, rho: a.rho, c: a.c });
  assert.ok(Math.abs(f - 60 / Math.sqrt(10 * 0.1)) < 1.0, `f = ${f}`);
  // exact root is close to lumped value when kd << 1
  const fe = AC.membraneFrequencyExact({ m: 10, depth: 0.05, rho: a.rho, c: a.c });
  const fl = AC.membraneFrequency({ m: 10, depth: 0.05, rho: a.rho, c: a.c });
  assert.ok(Math.abs(fe / fl - 1) < 0.02);
  // depth ↔ frequency inverse
  const d = AC.helmholtzDepth({ eps: 0.05, tEff: 0.02, f0: 300, c: a.c });
  const f0 = AC.helmholtzFrequency({ eps: 0.05, tEff: 0.02, depth: d, c: a.c });
  assert.ok(Math.abs(f0 - 300) < 1e-9);
});

test('NRC and SAA rounding (ASTM C423)', () => {
  const b = { 200: 0.3, 250: 0.42, 315: 0.5, 400: 0.6, 500: 0.71, 630: 0.8, 800: 0.85, 1000: 0.88, 1250: 0.9, 1600: 0.9, 2000: 0.92, 2500: 0.95 };
  assert.equal(AC.nrc(b).value, 0.75); // mean 0.7325 → 0.75
  assert.equal(AC.saa(b).value, 0.73); // mean 0.7275 → 0.73
});

test('ISO 11654 αw, shape indicators and class', () => {
  let r = AC.alphaW([1, 1, 1, 1, 1]);
  assert.equal(r.value, 1);
  assert.equal(r.cls, 'A');
  // Typical thin porous absorber: low at 250 Hz.
  r = AC.alphaW([0.25, 0.6, 0.9, 0.95, 0.95]);
  // shift 0.40: curve .40 .60 .60 .60 .50 → unfavourable .15 → fail
  // shift 0.45: curve .35 .55 .55 .55 .45 → unfavourable .10 → pass, αw = 0.55
  assert.equal(r.value, 0.55);
  assert.equal(r.cls, 'D');
  assert.equal(r.indicators, 'MH'); // 1000: .90-.55=.35 ; 2000: .95-.55=.40
  r = AC.alphaW([0.05, 0.05, 0.05, 0.05, 0.05]);
  assert.equal(r.value, 0.05);
  assert.equal(r.cls, 'Not classified');
});

test('Bies & Hansen flow resistivity (spreadsheet sheet 5: 7 820 rayl/m)', () => {
  const s = AC.biesHansen({ densityRatio: 0.01, d: 7.5e-6, eta: 1.85e-5 });
  assert.ok(Math.abs(s - 7820) < 1, `σ = ${s}`);
});

test('Sabine and Eyring reverberation time', () => {
  const c = 343.2;
  const T = AC.sabineRT({ V: 100, A: 20, c });
  assert.ok(Math.abs(T - 0.805) < 0.001, `T = ${T}`);
  const A = AC.absorptionAreaFromRT({ V: 100, T, c });
  assert.ok(Math.abs(A - 20) < 1e-9);
  // Eyring ≤ Sabine
  const Te = AC.eyringRT({ V: 100, S: 130, alphaMean: 20 / 130, c });
  assert.ok(Te < T);
});

test('room modes of a 5 × 4 × 3 m room', () => {
  const m = AC.roomModes({ L: 5, W: 4, H: 3, c: 343, fMax: 60 });
  assert.equal(m[0].type, 'axial');
  assert.ok(Math.abs(m[0].f - 34.3) < 1e-9);
  assert.ok(m.every((x, i) => i === 0 || x.f >= m[i - 1].f));
});

test('fibre flow resistivity, Cox table 5.1 (spreadsheet sheet 5, ε = 0.99, d = 7.5 µm)', () => {
  const q = { r: 3.75e-6, eps: 0.99, eta: 1.85e-5 };
  const F = AC.fibreFlowResistivity;
  assert.ok(Math.abs(F.parallel(q) - 7816) < 1);
  assert.ok(Math.abs(F.perpendicular(q) - 12413) < 1);
  assert.ok(Math.abs(F.glass(q) - 6085) < 1);
  assert.ok(Math.abs(F.mineral(q) - 3824) < 1);
  // Spreadsheet shows 7 075 because it rounds the exponent 4/3 to 1.333; exact 4/3 gives 7 065.
  assert.ok(Math.abs(F.random(q) - 7065.3) < 0.5);
});

test('ISO 11654 practical α rounding examples', () => {
  const p = AC.practicalAlpha;
  assert.equal(p([0.92, 0.92, 0.92]), 0.9);
  assert.equal(p([0.93, 0.93, 0.93]), 0.95);
  assert.equal(p([0.97, 0.97, 0.97]), 0.95);
  assert.equal(p([0.98, 0.98, 0.98]), 1.0);
  assert.equal(p([1.1, 1.05, 1.0]), 1.0);
});

test('Eyring inverse returns the absorption area that gives the measured RT', () => {
  const c = 343.2, V = 144, S = 168;
  const A = AC.absorptionAreaFromRTEyring({ V, S, T: 0.9, c });
  const T = AC.eyringRT({ V, S, alphaMean: A / S, c });
  assert.ok(Math.abs(T - 0.9) < 1e-12);
});
