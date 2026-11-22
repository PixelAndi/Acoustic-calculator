/*
 * Acoustic Calculator – physics core.
 *
 * All calculations in one dependency-free file. It runs in the browser
 * (global "AC") and in Node.js (module.exports) so the same code is tested.
 *
 * Time convention: exp(+jωt). A passive impedance has the form R + jX,
 * and a wave travelling into a lossy layer decays as exp(-jkx) with Im(k) < 0.
 *
 * Main reference:
 *   T. J. Cox & P. D'Antonio, "Acoustic Absorbers and Diffusers:
 *   Theory, Design and Application" (chapters 1, 5, 6, 7 and appendix B).
 */
(function (root, factory) {
  'use strict';
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.AC = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Complex arithmetic                                                  */
  /* ------------------------------------------------------------------ */
  const C = (re, im = 0) => ({ re, im });
  const ZERO = C(0, 0);
  const ONE = C(1, 0);
  const J = C(0, 1);
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const scale = (a, s) => C(a.re * s, a.im * s);
  const neg = (a) => C(-a.re, -a.im);
  const abs = (a) => Math.hypot(a.re, a.im);
  const div = (a, b) => {
    // Smith's algorithm (avoids overflow / loss of precision).
    if (Math.abs(b.re) >= Math.abs(b.im)) {
      const r = b.im / b.re;
      const d = b.re + b.im * r;
      return C((a.re + a.im * r) / d, (a.im - a.re * r) / d);
    }
    const r = b.re / b.im;
    const d = b.re * r + b.im;
    return C((a.re * r + a.im) / d, (a.im * r - a.re) / d);
  };
  const sqrt = (a) => {
    // Principal square root: Re >= 0.
    const m = abs(a);
    if (m === 0) return C(0, 0);
    const re = Math.sqrt((m + a.re) / 2);
    const im = Math.sqrt(Math.max(0, (m - a.re) / 2));
    return C(re, a.im < 0 ? -im : im);
  };
  const sin = (a) => C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
  const cos = (a) => C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
  const tan = (a) => {
    // tan(x+iy) = (sin2x + i sinh2y) / (cos2x + cosh2y); stable for large |y|.
    if (Math.abs(a.im) > 20) return C(0, Math.sign(a.im));
    const d = Math.cos(2 * a.re) + Math.cosh(2 * a.im);
    return C(Math.sin(2 * a.re) / d, Math.sinh(2 * a.im) / d);
  };
  const isFiniteC = (a) => Number.isFinite(a.re) && Number.isFinite(a.im);

  /** J1(z)/J0(z) for complex z (backward recurrence of the Gauss continued fraction). */
  function besselJ1overJ0(z) {
    const n0 = Math.ceil(abs(z)) + 60;
    let r = ZERO;
    for (let n = n0; n >= 1; n--) r = div(ONE, sub(div(C(2 * n, 0), z), r));
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Air                                                                 */
  /* ------------------------------------------------------------------ */
  const GAS_CONSTANT_AIR = 287.05; // J/(kg K), dry air
  const GAMMA_AIR = 1.4; // ratio of specific heats, dry air

  /**
   * Properties of dry air.
   * @param {number} tempC  air temperature in °C
   * @param {number} pressureKPa static pressure in kPa
   */
  function air(tempC = 20, pressureKPa = 101.325) {
    const T = tempC + 273.15;
    const P = pressureKPa * 1000;
    const rho = P / (GAS_CONSTANT_AIR * T); // ideal gas
    const c = Math.sqrt(GAMMA_AIR * GAS_CONSTANT_AIR * T); // ideal gas
    const eta = (1.458e-6 * Math.pow(T, 1.5)) / (T + 110.4); // Sutherland's law, Pa s
    return { tempC, pressureKPa, T, P, rho, c, eta, nu: eta / rho, Z0: rho * c, gamma: GAMMA_AIR };
  }

  /** Build a custom air object (used for tests and for user overrides). */
  function customAir({ rho, c, eta }) {
    return { rho, c, eta, nu: eta / rho, Z0: rho * c, gamma: GAMMA_AIR };
  }

  /* ------------------------------------------------------------------ */
  /* Porous material models                                              */
  /* ------------------------------------------------------------------ */
  /** Delany & Bazley (1970). Cox & D'Antonio eq. 5.9–5.11. X = ρ0 f / σ. */
  function delanyBazley(f, sigma, a) {
    const X = (a.rho * f) / sigma;
    const k0 = (2 * Math.PI * f) / a.c;
    const zc = scale(C(1 + 0.0571 * Math.pow(X, -0.754), -0.087 * Math.pow(X, -0.732)), a.Z0);
    const k = scale(C(1 + 0.0978 * Math.pow(X, -0.7), -0.189 * Math.pow(X, -0.595)), k0);
    return { zc, k, X, valid: X >= 0.01 && X <= 1.0 };
  }

  /** Miki (1990). Uses f / σ. */
  function miki(f, sigma, a) {
    const X = f / sigma;
    const k0 = (2 * Math.PI * f) / a.c;
    const pz = Math.pow(X, -0.632);
    const pk = Math.pow(X, -0.618);
    const zc = scale(C(1 + 0.07 * pz, -0.107 * pz), a.Z0);
    const k = scale(C(1 + 0.109 * pk, -0.16 * pk), k0);
    return { zc, k, X, valid: X >= 0.01 && X <= 1.0 };
  }

  const POROUS_MODELS = { db: delanyBazley, miki };

  /* ------------------------------------------------------------------ */
  /* Layered absorber (transfer of impedance from a rigid wall)          */
  /* ------------------------------------------------------------------ */
  /**
   * Characteristic values of one layer.
   * layer = { type: 'air' | 'porous', thickness (m), sigma (Pa s/m²), model: 'db'|'miki' }
   */
  function layerProps(layer, f, a) {
    if (layer.type === 'air') {
      return { zc: C(a.Z0, 0), k: C((2 * Math.PI * f) / a.c, 0), valid: true, X: null };
    }
    const fn = POROUS_MODELS[layer.model || 'db'];
    if (!fn) throw new Error('Unknown porous model: ' + layer.model);
    return fn(f, layer.sigma, a);
  }

  /**
   * Surface impedance (Pa s/m) of a layered absorber on a rigid wall.
   * @param {number} f frequency (Hz)
   * @param {number} thetaRad angle of incidence from the normal (rad)
   * @param {object} a air object
   * @param {Array} layers ordered from the WALL outwards
   * @param {object|null} facing  object with impedance(f, a) (locally reacting sheet)
   * @param {object} opts { localReaction: boolean }
   */
  function surfaceImpedance(f, thetaRad, a, layers, facing, opts = {}) {
    const k0 = (2 * Math.PI * f) / a.c;
    const kt = k0 * Math.sin(thetaRad);
    let Z = null; // null = rigid wall (infinite impedance)
    let valid = true;
    for (const layer of layers) {
      if (!(layer.thickness > 0)) continue;
      const p = layerProps(layer, f, a);
      if (!p.valid) valid = false;
      let kx = p.k;
      let Zn = p.zc;
      if (!opts.localReaction && kt !== 0) {
        kx = sqrt(sub(mul(p.k, p.k), C(kt * kt, 0)));
        Zn = div(mul(p.zc, p.k), kx);
      }
      const arg = scale(kx, layer.thickness);
      const s = sin(arg);
      const c = cos(arg);
      if (Z === null) {
        // Rigid backing: Z = -j Zn cot(kx d)
        Z = div(mul(Zn, c), mul(J, s));
      } else {
        // Z_in = Zn (Z_L cos + j Zn sin) / (Zn cos + j Z_L sin)
        const num = add(mul(Z, c), mul(J, mul(Zn, s)));
        const den = add(mul(Zn, c), mul(J, mul(Z, s)));
        Z = mul(Zn, div(num, den));
      }
    }
    if (Z === null) Z = C(Infinity, Infinity);
    if (facing) Z = add(Z, facing.impedance(f, a));
    return { Z, valid };
  }

  /** Pressure reflection factor and absorption coefficient for a surface impedance. */
  function reflection(Z, thetaRad, a) {
    if (!isFiniteC(Z)) return { R: ONE, alpha: 0 };
    const zc = scale(Z, Math.cos(thetaRad));
    const R = div(sub(zc, C(a.Z0, 0)), add(zc, C(a.Z0, 0)));
    const m = abs(R);
    return { R, alpha: 1 - m * m };
  }

  /**
   * Absorption coefficient of a construction.
   * construction = { layers, facing, localReaction }
   * incidence = { mode: 'normal' | 'angle' | 'diffuse', angleDeg }
   */
  function absorption(f, a, construction, incidence = { mode: 'normal' }) {
    const opts = { localReaction: !!construction.localReaction };
    const one = (theta) => {
      const s = surfaceImpedance(f, theta, a, construction.layers, construction.facing, opts);
      return { alpha: reflection(s.Z, theta, a).alpha, Z: s.Z, valid: s.valid };
    };
    if (incidence.mode === 'diffuse') {
      // Paris formula: α_d = ∫0^{π/2} α(θ) sin(2θ) dθ  (midpoint rule, 0.5° steps)
      const n = 180;
      const h = Math.PI / 2 / n;
      let sum = 0;
      let valid = true;
      for (let i = 0; i < n; i++) {
        const th = (i + 0.5) * h;
        const r = one(th);
        if (!r.valid) valid = false;
        sum += r.alpha * Math.sin(2 * th) * h;
      }
      const n0 = one(0);
      return { alpha: sum, Z: n0.Z, valid };
    }
    const theta = incidence.mode === 'angle' ? ((incidence.angleDeg || 0) * Math.PI) / 180 : 0;
    return one(theta);
  }

  /* ------------------------------------------------------------------ */
  /* Facings (thin, locally reacting sheets in front of the cavity)      */
  /* ------------------------------------------------------------------ */
  /** Open-area ratio of circular holes, radius r, centre spacing D. */
  function holeOpenArea(r, D, pattern = 'square') {
    const cell = pattern === 'triangular' ? (Math.sqrt(3) / 2) * D * D : D * D;
    return (Math.PI * r * r) / cell;
  }

  /**
   * Perforated panel with circular holes (Cox & D'Antonio ch. 6, app. B.4).
   *   z = r_m + jωρ t'/ε
   *   t' = t + 2δa,  δ = 0.8(1 − 1.47√ε + 0.47ε^{3/2})
   *   r_m = (ρ/ε) √(8νω) (1 + t/(2a))
   * t = sheet thickness, a = hole radius, D = hole spacing (all in m).
   */
  function perforatedFacing({ t, a: r, D, pattern = 'square' }) {
    const eps = holeOpenArea(r, D, pattern);
    const delta = 0.8 * (1 - 1.47 * Math.sqrt(eps) + 0.47 * Math.pow(eps, 1.5));
    const tEff = t + 2 * delta * r;
    return {
      kind: 'perforated',
      eps,
      delta,
      tEff,
      impedance(f, a) {
        const w = 2 * Math.PI * f;
        const rm = (a.rho / eps) * Math.sqrt(8 * a.nu * w) * (1 + t / (2 * r));
        return C(rm, (w * a.rho * tEff) / eps);
      },
    };
  }

  /**
   * Slotted panel (parallel slots).
   *   Inside the slot: exact viscous slit impedance
   *     z_slot = (jωρt/ε) [1 − tan(y)/y]^-1,  y = (w/2)√(ωρ/η) e^{-jπ/4}
   *   End correction (Cox & D'Antonio eq. 6.10, after Smits & Kosten):
   *     δ = (1/π) ln(1 / sin(πε/2)),  added mass jωρ (2δw)/ε
   * t = sheet thickness, w = slot width, pitch = slot centre spacing (m).
   */
  function slottedFacing({ t, w, pitch }) {
    const eps = w / pitch;
    const delta = (1 / Math.PI) * Math.log(1 / Math.sin((Math.PI * eps) / 2));
    const tEff = t + 2 * delta * w;
    return {
      kind: 'slotted',
      eps,
      delta,
      tEff,
      impedance(f, a) {
        const om = 2 * Math.PI * f;
        const x = (w / 2) * Math.sqrt((om * a.rho) / a.eta);
        const y = scale(C(Math.SQRT1_2, -Math.SQRT1_2), x);
        let g; // g = 1 − tan(y)/y
        if (x < 0.05) {
          const y2 = mul(y, y);
          g = sub(scale(y2, -1 / 3), scale(mul(y2, y2), 2 / 15));
        } else {
          g = sub(ONE, div(tan(y), y));
        }
        const inner = div(C(0, (om * a.rho * t) / eps), g);
        return add(inner, C(0, (om * a.rho * 2 * delta * w) / eps));
      },
    };
  }

  /**
   * Microperforated panel, exact model of D.-Y. Maa (Cox & D'Antonio ch. 6.5).
   *   z = (jωρt/ε) [1 − 2J1(y)/(y J0(y))]^-1 + √(2ωρη)/(2ε) + jωρ(1.7a)/ε
   *   y = a √(ωρ/η) e^{-jπ/4}
   * t = sheet thickness, a = hole radius, D = hole spacing (m).
   */
  function microperforatedFacing({ t, a: r, D, pattern = 'square' }) {
    const eps = holeOpenArea(r, D, pattern);
    return {
      kind: 'microperforated',
      eps,
      impedance(f, a) {
        const om = 2 * Math.PI * f;
        const x = r * Math.sqrt((om * a.rho) / a.eta);
        const y = scale(C(Math.SQRT1_2, -Math.SQRT1_2), x);
        let g; // g = 1 − 2J1(y)/(y J0(y))
        if (x < 0.05) {
          const y2 = mul(y, y);
          g = sub(scale(y2, -1 / 8), scale(mul(y2, y2), 1 / 48));
        } else {
          g = sub(ONE, scale(div(besselJ1overJ0(y), y), 2));
        }
        const inner = div(C(0, (om * a.rho * t) / eps), g);
        const endR = Math.sqrt(2 * om * a.rho * a.eta) / (2 * eps);
        const endX = (om * a.rho * 1.7 * r) / eps;
        return add(inner, C(endR, endX));
      },
    };
  }

  /** Maa's approximate formula (for cross-checking the exact model). */
  function maaApproxImpedance(f, a, { t, a: r, eps }) {
    const om = 2 * Math.PI * f;
    const d = 2 * r;
    const x = d * Math.sqrt((om * a.rho) / (4 * a.eta));
    const kr = Math.sqrt(1 + (x * x) / 32) + (Math.SQRT2 / 32) * x * (d / t);
    const km = 1 + 1 / Math.sqrt(9 + (x * x) / 2) + 0.85 * (d / t);
    const rr = ((32 * a.eta * t) / (eps * d * d)) * kr; // absolute, Pa s/m
    const mm = ((a.rho * t) / eps) * km; // kg/m²
    return C(rr, om * mm);
  }

  /** Limp membrane / panel of surface mass m (kg/m²), with optional resistance r (Pa s/m). */
  function membraneFacing({ m, r = 0 }) {
    return {
      kind: 'membrane',
      impedance(f) {
        return C(r, 2 * Math.PI * f * m);
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Resonance estimates                                                 */
  /* ------------------------------------------------------------------ */
  /** Helmholtz resonance of a perforated / slotted sheet over an air cavity (lumped, normal incidence). */
  function helmholtzFrequency({ eps, tEff, depth, c }) {
    return (c / (2 * Math.PI)) * Math.sqrt(eps / (tEff * depth));
  }
  /** Cavity depth for a target Helmholtz frequency. */
  function helmholtzDepth({ eps, tEff, f0, c }) {
    const w = 2 * Math.PI * f0;
    return (eps * c * c) / (w * w * tEff);
  }
  /** Mass–air–mass resonance of a limp membrane over an air cavity (lumped). */
  function membraneFrequency({ m, depth, rho, c }) {
    return (1 / (2 * Math.PI)) * Math.sqrt((rho * c * c) / (m * depth));
  }
  /** Exact normal-incidence root of ωm = ρc·cot(kd) (limp mass over an empty cavity). */
  function membraneFrequencyExact({ m, depth, rho, c }) {
    const g = (f) => {
      const w = 2 * Math.PI * f;
      return w * m - (rho * c) / Math.tan((w / c) * depth);
    };
    // First root lies below the cavity λ/4 frequency c/(4d).
    let lo = 1e-3;
    let hi = (c / (4 * depth)) * (1 - 1e-12);
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (g(mid) > 0) hi = mid;
      else lo = mid;
    }
    return 0.5 * (lo + hi);
  }

  /* ------------------------------------------------------------------ */
  /* Frequency bands and single-number ratings                           */
  /* ------------------------------------------------------------------ */
  const THIRD_OCTAVE_NOMINAL = [
    50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500,
    3150, 4000, 5000, 6300, 8000, 10000,
  ];
  /** Exact base-10 centre frequency of a nominal 1/3-octave band. */
  function exactThirdOctave(nominal) {
    const n = Math.round(10 * Math.log10(nominal / 1000));
    return 1000 * Math.pow(10, n / 10);
  }
  /** Log-spaced frequencies for curves. */
  function logFrequencies(fMin, fMax, perOctave = 24) {
    const out = [];
    const n = Math.round(Math.log2(fMax / fMin) * perOctave);
    for (let i = 0; i <= n; i++) out.push(fMin * Math.pow(2, i / perOctave));
    return out;
  }
  /** Mean of fn over one 1/3-octave band (7 log-spaced points between band edges). */
  function thirdOctaveBandMean(fn, nominal, points = 7) {
    const fc = exactThirdOctave(nominal);
    let s = 0;
    for (let i = 0; i < points; i++) {
      const e = -0.05 + (0.1 * (i + 0.5)) / points;
      s += fn(fc * Math.pow(10, e));
    }
    return s / points;
  }

  const roundTo = (v, step) => Math.round(v / step + 1e-9) * step;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /** NRC (ASTM C423): mean of the 1/3-octave values at 250, 500, 1000, 2000 Hz, rounded to 0.05. */
  function nrc(byBand) {
    const v = [250, 500, 1000, 2000].map((b) => byBand[b]);
    if (v.some((x) => x === undefined || Number.isNaN(x))) return null;
    const mean = v.reduce((s, x) => s + x, 0) / 4;
    return { value: +roundTo(mean, 0.05).toFixed(2), mean };
  }

  /** SAA (ASTM C423): mean of 12 1/3-octave values 200–2500 Hz, rounded to 0.01. */
  function saa(byBand) {
    const bands = [200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];
    const v = bands.map((b) => byBand[b]);
    if (v.some((x) => x === undefined || Number.isNaN(x))) return null;
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    return { value: +roundTo(mean, 0.01).toFixed(2), mean };
  }

  const ISO11654_BANDS = [250, 500, 1000, 2000, 4000];
  const ISO11654_REFERENCE = [0.8, 1.0, 1.0, 1.0, 0.9];

  /** Practical absorption coefficient αp (ISO 11654) from three 1/3-octave values. */
  function practicalAlpha(values) {
    // ISO 11654 §4.1: mean calculated to two decimals, then rounded in steps of 0.05, max 1.00.
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const hundredths = Math.round(mean * 100 + 1e-9);
    const twentieths = Math.round(hundredths / 5 + 1e-9);
    return Math.min(1, twentieths / 20);
  }

  /**
   * Weighted sound absorption coefficient αw (ISO 11654).
   * @param {number[]} ap practical α at 250, 500, 1000, 2000, 4000 Hz
   */
  function alphaW(ap) {
    // Work in hundredths (integers) to avoid floating-point rounding errors.
    const p = ap.map((x) => Math.round(x * 100));
    const ref = ISO11654_REFERENCE.map((x) => Math.round(x * 100));
    let shift = 0;
    for (; shift <= 100; shift += 5) {
      let unfav = 0;
      for (let i = 0; i < 5; i++) unfav += Math.max(0, ref[i] - shift - p[i]);
      if (unfav <= 10) break;
    }
    const aw = Math.max(0, ref[1] - shift);
    const curve = ref.map((x) => x - shift);
    const ex = p.map((x, i) => x - curve[i]);
    let indicators = '';
    if (ex[0] >= 25) indicators += 'L';
    if (ex[1] >= 25 || ex[2] >= 25) indicators += 'M';
    if (ex[3] >= 25 || ex[4] >= 25) indicators += 'H';
    return { value: aw / 100, indicators, curve: curve.map((x) => x / 100), cls: absorptionClass(aw / 100) };
  }

  /** Sound absorption class (ISO 11654, annex B). */
  function absorptionClass(aw) {
    const v = Math.round(aw * 100);
    if (v >= 90) return 'A';
    if (v >= 80) return 'B';
    if (v >= 60) return 'C';
    if (v >= 30) return 'D';
    if (v >= 15) return 'E';
    return 'Not classified';
  }

  /** All ratings from a map {nominal 1/3-octave band: α}. Negative α is set to 0. */
  function ratings(byBand) {
    const clean = {};
    for (const k of Object.keys(byBand)) clean[k] = Math.max(0, byBand[k]);
    const out = { nrc: nrc(clean), saa: saa(clean), alphaW: null, practical: null };
    const groups = {
      125: [100, 125, 160],
      250: [200, 250, 315],
      500: [400, 500, 630],
      1000: [800, 1000, 1250],
      2000: [1600, 2000, 2500],
      4000: [3150, 4000, 5000],
    };
    const practical = {};
    let ok = true;
    for (const oct of Object.keys(groups)) {
      const v = groups[oct].map((b) => clean[b]);
      if (v.some((x) => x === undefined || Number.isNaN(x))) {
        if (oct !== '125') ok = false;
        continue;
      }
      practical[oct] = practicalAlpha(v);
    }
    out.practical = practical;
    if (ok) out.alphaW = alphaW(ISO11654_BANDS.map((b) => practical[b]));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Flow resistivity estimates                                          */
  /* ------------------------------------------------------------------ */
  /** σ = Δp / (U d)   (Cox & D'Antonio eq. 5.1) */
  function flowResistivityFromMeasurement({ dp, U, d }) {
    return dp / (U * d);
  }
  /**
   * Bies & Hansen: σ = 27.3 (ρm/ρf)^1.53 η / d²
   * ρm/ρf = bulk density / fibre material density = 1 − porosity. d = fibre diameter (m).
   */
  function biesHansen({ densityRatio, d, eta }) {
    return (27.3 * Math.pow(densityRatio, 1.53) * eta) / (d * d);
  }

  /**
   * Fibre-based estimates (Cox & D'Antonio, 2nd ed., table 5.1, after Mechel and Tarnow).
   * r = mean fibre RADIUS (m), eps = porosity (0..1), eta = dynamic viscosity of air.
   */
  const fibreFlowResistivity = {
    parallel: ({ r, eps, eta }) => (3.94 * eta * Math.pow(1 - eps, 1.413) * (1 + 27 * Math.pow(1 - eps, 3))) / (r * r * eps),
    perpendicular: ({ r, eps, eta }) =>
      r <= 15e-6
        ? (10.56 * eta * Math.pow(1 - eps, 1.531)) / (r * r * Math.pow(eps, 3)) // stated range 6–10 µm
        : (6.8 * eta * Math.pow(1 - eps, 1.296)) / (r * r * Math.pow(eps, 3)), // stated range 20–30 µm
    random: ({ r, eps, eta }) =>
      ((4 * eta) / (r * r)) * ((0.55 * Math.pow(1 - eps, 4 / 3)) / eps + (Math.SQRT2 * Math.pow(1 - eps, 2)) / Math.pow(eps, 3)),
    glass: ({ r, eps, eta }) => (3.2 * eta * Math.pow(1 - eps, 1.42)) / (r * r),
    mineral: ({ r, eps, eta }) => (4.4 * eta * Math.pow(1 - eps, 1.59)) / (r * r),
  };

  /* ------------------------------------------------------------------ */
  /* Rooms                                                               */
  /* ------------------------------------------------------------------ */
  const SABINE_K = 24 * Math.log(10); // 55.26…  →  T = 55.26 V / (c A)

  function sabineRT({ V, A, c }) {
    return (SABINE_K * V) / (c * A);
  }
  function eyringRT({ V, S, alphaMean, c }) {
    if (alphaMean >= 1) return 0;
    return (SABINE_K * V) / (c * -S * Math.log(1 - alphaMean));
  }
  /** Equivalent absorption area from a measured RT (Sabine). */
  function absorptionAreaFromRT({ V, T, c }) {
    return (SABINE_K * V) / (c * T);
  }

  /** Equivalent absorption area from a measured RT (Eyring inverse): A = S (1 − exp(−55.26 V / (c S T))). */
  function absorptionAreaFromRTEyring({ V, S, T, c }) {
    return S * (1 - Math.exp(-(SABINE_K * V) / (c * S * T)));
  }

  /** Room modes of a rectangular room with rigid walls. */
  function roomModes({ L, W, H, c, fMax, maxOrder = 20 }) {
    const out = [];
    for (let nx = 0; nx <= maxOrder; nx++)
      for (let ny = 0; ny <= maxOrder; ny++)
        for (let nz = 0; nz <= maxOrder; nz++) {
          if (nx + ny + nz === 0) continue;
          const f = (c / 2) * Math.sqrt((nx / L) ** 2 + (ny / W) ** 2 + (nz / H) ** 2);
          if (f > fMax) continue;
          const zeros = [nx, ny, nz].filter((n) => n === 0).length;
          const type = zeros === 2 ? 'axial' : zeros === 1 ? 'tangential' : 'oblique';
          out.push({ nx, ny, nz, f, type });
        }
    out.sort((p, q) => p.f - q.f);
    return out;
  }
  /** Schroeder frequency: f = 2000 √(T/V). */
  function schroederFrequency({ T, V }) {
    return 2000 * Math.sqrt(T / V);
  }

  return {
    complex: { C, add, sub, mul, div, scale, neg, abs, sqrt, sin, cos, tan, besselJ1overJ0 },
    air,
    customAir,
    delanyBazley,
    miki,
    POROUS_MODELS,
    surfaceImpedance,
    reflection,
    absorption,
    holeOpenArea,
    perforatedFacing,
    slottedFacing,
    microperforatedFacing,
    maaApproxImpedance,
    membraneFacing,
    helmholtzFrequency,
    helmholtzDepth,
    membraneFrequency,
    membraneFrequencyExact,
    THIRD_OCTAVE_NOMINAL,
    exactThirdOctave,
    logFrequencies,
    thirdOctaveBandMean,
    nrc,
    saa,
    practicalAlpha,
    alphaW,
    absorptionClass,
    ratings,
    flowResistivityFromMeasurement,
    biesHansen,
    fibreFlowResistivity,
    sabineRT,
    eyringRT,
    absorptionAreaFromRT,
    absorptionAreaFromRTEyring,
    roomModes,
    schroederFrequency,
  };
});
