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
  /** Normal-direction wave values (k_x, Z_n) of a layer for a given angle. */
  function layerWave(layer, f, thetaRad, a, opts) {
    const p = layerProps(layer, f, a);
    const kt = ((2 * Math.PI * f) / a.c) * Math.sin(thetaRad);
    let kx = p.k;
    let Zn = p.zc;
    if (!opts.localReaction && kt !== 0) {
      kx = sqrt(sub(mul(p.k, p.k), C(kt * kt, 0)));
      Zn = div(mul(p.zc, p.k), kx);
    }
    return { kx, Zn, valid: p.valid };
  }

  /**
   * Surface impedance (Pa s/m) of a layered absorber on a rigid wall.
   * @param {number} f frequency (Hz)
   * @param {number} thetaRad angle of incidence from the normal (rad)
   * @param {object} a air object
   * @param {Array} layers ordered from the WALL outwards. A layer is
   *   { type: 'air'|'porous', thickness, sigma, model } or
   *   { type: 'sheet', sheet: <facing object> } (thin sheet in series).
   * @param {object|null} facing  object with impedance(f, a) (locally reacting sheet)
   * @param {object} opts { localReaction: boolean }
   */
  function surfaceImpedance(f, thetaRad, a, layers, facing, opts = {}) {
    let Z = null; // null = rigid wall (infinite impedance)
    let valid = true;
    for (const layer of layers) {
      if (layer.type === 'sheet') {
        // A sheet directly on the rigid wall has no effect (infinite + finite).
        if (Z !== null) Z = add(Z, layer.sheet.impedance(f, a));
        continue;
      }
      if (!(layer.thickness > 0)) continue;
      const w = layerWave(layer, f, thetaRad, a, opts);
      if (!w.valid) valid = false;
      const arg = scale(w.kx, layer.thickness);
      const s = sin(arg);
      const c = cos(arg);
      if (Z === null) {
        // Rigid backing: Z = -j Zn cot(kx d)
        Z = div(mul(w.Zn, c), mul(J, s));
      } else {
        // Z_in = Zn (Z_L cos + j Zn sin) / (Zn cos + j Z_L sin)
        const num = add(mul(Z, c), mul(J, mul(w.Zn, s)));
        const den = add(mul(w.Zn, c), mul(J, mul(Z, s)));
        Z = mul(w.Zn, div(num, den));
      }
    }
    if (Z === null) Z = C(Infinity, Infinity);
    if (facing) Z = add(Z, facing.impedance(f, a));
    return { Z, valid };
  }

  /* 2 × 2 complex transfer matrices, stored as [T11, T12, T21, T22]. */
  const matMul = (A, B) => [
    add(mul(A[0], B[0]), mul(A[1], B[2])),
    add(mul(A[0], B[1]), mul(A[1], B[3])),
    add(mul(A[2], B[0]), mul(A[3], B[2])),
    add(mul(A[2], B[1]), mul(A[3], B[3])),
  ];

  /**
   * Free-hanging construction (air on both sides): transfer-matrix method.
   * Relates (p, v_x) on the incident side to the far side:
   *   layer: [[cos k_x d, j Z_n sin k_x d], [j sin k_x d / Z_n, cos k_x d]]
   *   sheet: [[1, Z_s], [0, 1]]
   * With Z0n = ρc / cosθ on both sides:
   *   Z_in = (T11 Z0n + T12) / (T21 Z0n + T22)
   *   R = (Z_in − Z0n)/(Z_in + Z0n),  t = 2 Z0n / (T11 Z0n + T12 + Z0n (T21 Z0n + T22))
   *   α = 1 − |R|² − |t|²,  τ = |t|²
   * @param {Array} layers ordered from the far side to the incident side (same order as for a wall).
   */
  function freeLayer(f, thetaRad, a, layers, facing, opts = {}) {
    let T = [ONE, ZERO, ZERO, ONE];
    let valid = true;
    const seq = [...layers];
    if (facing) seq.push({ type: 'sheet', sheet: facing });
    // Multiply from the incident side (last element) to the far side.
    for (let i = seq.length - 1; i >= 0; i--) {
      const layer = seq[i];
      let M;
      if (layer.type === 'sheet') M = [ONE, layer.sheet.impedance(f, a), ZERO, ONE];
      else {
        if (!(layer.thickness > 0)) continue;
        const w = layerWave(layer, f, thetaRad, a, opts);
        if (!w.valid) valid = false;
        const arg = scale(w.kx, layer.thickness);
        const s = sin(arg);
        const c = cos(arg);
        M = [c, mul(J, mul(w.Zn, s)), div(mul(J, s), w.Zn), c];
      }
      T = matMul(T, M);
    }
    const Z0n = C(a.Z0 / Math.cos(thetaRad), 0);
    const num = add(mul(T[0], Z0n), T[1]);
    const den = add(mul(T[2], Z0n), T[3]);
    const Zin = div(num, den);
    const R = div(sub(Zin, Z0n), add(Zin, Z0n));
    const t = div(scale(Z0n, 2), add(num, mul(Z0n, den)));
    const r2 = abs(R) ** 2;
    const t2 = abs(t) ** 2;
    return { R, t, alpha: 1 - r2 - t2, tau: t2, Z: Zin, valid };
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
    const one = construction.free
      ? (theta) => {
          const r = freeLayer(f, theta, a, construction.layers, construction.facing, opts);
          return { alpha: r.alpha, tau: r.tau, Z: r.Z, valid: r.valid };
        }
      : (theta) => {
          const s = surfaceImpedance(f, theta, a, construction.layers, construction.facing, opts);
          return { alpha: reflection(s.Z, theta, a).alpha, Z: s.Z, valid: s.valid };
        };
    if (incidence.mode === 'diffuse') {
      // Paris formula: α_d = ∫0^{π/2} α(θ) sin(2θ) dθ  (midpoint rule, 0.5° steps by default)
      const n = incidence.steps || 180;
      const h = Math.PI / 2 / n;
      let sum = 0;
      let sumTau = 0;
      let valid = true;
      for (let i = 0; i < n; i++) {
        const th = (i + 0.5) * h;
        const r = one(th);
        if (!r.valid) valid = false;
        sum += r.alpha * Math.sin(2 * th) * h;
        if (r.tau !== undefined) sumTau += r.tau * Math.sin(2 * th) * h;
      }
      const n0 = one(0);
      return { alpha: sum, tau: construction.free ? sumTau : undefined, Z: n0.Z, valid };
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

  /**
   * Thin porous sheet (fabric, fleece, acoustic scrim).
   * R = flow resistance (Pa s/m = rayl), m = surface mass (kg/m²).
   * Limp sheet: the sheet moves with the air, so the flow resistance acts in
   * parallel with the mass reactance:  Z = jωm R / (R + jωm).
   * m = 0 means a sheet that is held still (stretched or bonded): Z = R.
   */
  function resistiveFacing({ R, m = 0 }) {
    return {
      kind: 'resistive',
      impedance(f) {
        if (!(m > 0)) return C(R, 0);
        const X = C(0, 2 * Math.PI * f * m);
        return div(scale(X, R), add(C(R, 0), X));
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Single Helmholtz resonator (bottle or box)                          */
  /* ------------------------------------------------------------------ */
  /**
   * f0 = (c/2π) √(S / (V L′)),  S = π a²,  L′ = L + end corrections.
   * End correction of one end: 0.85 a (flanged, Rayleigh), 0.61 a (unflanged, Levine & Schwinger).
   */
  function helmholtzResonator({ a: r, L, V, c, outer = 'flanged', inner = 'flanged' }) {
    const end = (k) => (k === 'unflanged' ? 0.6133 : 0.8488) * r;
    const Leff = L + end(outer) + end(inner);
    const S = Math.PI * r * r;
    const f0 = (c / (2 * Math.PI)) * Math.sqrt(S / (V * Leff));
    return { f0, Leff, S, ka: ((2 * Math.PI * f0) / c) * Math.cbrt(V) };
  }

  /* ------------------------------------------------------------------ */
  /* Schroeder diffusers                                                 */
  /* ------------------------------------------------------------------ */
  function isPrime(n) {
    if (n < 2 || n % 1) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  /** Smallest primitive root of a prime N. */
  function primitiveRoot(N) {
    const phi = N - 1;
    const factors = [];
    let x = phi;
    for (let p = 2; p * p <= x; p++)
      if (x % p === 0) {
        factors.push(p);
        while (x % p === 0) x /= p;
      }
    if (x > 1) factors.push(x);
    const powmod = (b, e, m) => {
      let r = 1;
      b %= m;
      while (e > 0) {
        if (e & 1) r = (r * b) % m;
        b = (b * b) % m;
        e >>= 1;
      }
      return r;
    };
    for (let g = 2; g < N; g++) if (factors.every((q) => powmod(g, phi / q, N) !== 1)) return g;
    return null;
  }
  /** Quadratic residue sequence s_n = n² mod N, n = 0 … N−1. */
  function qrdSequence(N) {
    return Array.from({ length: N }, (_, n) => (n * n) % N);
  }
  /** Primitive root sequence s_n = g^n mod N, n = 1 … N−1. */
  function prdSequence(N) {
    const g = primitiveRoot(N);
    const out = [];
    let v = 1;
    for (let n = 1; n < N; n++) {
      v = (v * g) % N;
      out.push(v);
    }
    return { g, seq: out };
  }
  /** 2D (skyline) quadratic residue: s_{n,m} = (n² + m²) mod N. */
  function qrd2DSequence(N) {
    return Array.from({ length: N }, (_, n) => Array.from({ length: N }, (_, m) => (n * n + m * m) % N));
  }
  /** Well depths d_n = s_n λ0 / (2N)  (Cox & D'Antonio ch. 10). */
  function diffuserDepths(seq, N, f0, c) {
    const lambda0 = c / f0;
    return seq.map((s) => (s * lambda0) / (2 * N));
  }

  /**
   * Far-field scattering of a 1D well diffuser, normal incidence
   * (Fourier / Kirchhoff approximation, Cox & D'Antonio ch. 9–10).
   * Each well n has width w, depth d_n and reflection factor R_n = exp(−2jk d_n).
   * Fins of width tf have R = 1. The pattern repeats 'periods' times.
   *   p(θ) ∝ Σ_e R_e · w_e · sinc(k w_e sinθ / 2) · exp(j k x_e sinθ)
   * @returns array of { deg, level } (energy |p|², not normalised)
   */
  function diffuserPolar({ depths, w, tf = 0, periods = 1, f, c, angles = null, flat = false }) {
    const k = (2 * Math.PI * f) / c;
    const elems = [];
    let x = 0;
    for (let p = 0; p < periods; p++)
      for (const d of depths) {
        if (tf > 0) {
          elems.push({ x: x + tf / 2, w: tf, d: 0 });
          x += tf;
        }
        elems.push({ x: x + w / 2, w, d: flat ? 0 : d });
        x += w;
      }
    const width = x;
    const degs = angles || Array.from({ length: 37 }, (_, i) => -90 + 5 * i);
    return {
      width,
      points: degs.map((deg) => {
        const st = Math.sin((deg * Math.PI) / 180);
        let re = 0;
        let im = 0;
        for (const e of elems) {
          const u = (k * e.w * st) / 2;
          const sinc = u === 0 ? 1 : Math.sin(u) / u;
          const ph = k * e.x * st - 2 * k * e.d;
          re += e.w * sinc * Math.cos(ph);
          im += e.w * sinc * Math.sin(ph);
        }
        return { deg, energy: re * re + im * im };
      }),
    };
  }

  /**
   * Plane cut (scattering in the x–z plane) of a 2D block (skyline) diffuser, normal incidence,
   * Fourier / Kirchhoff approximation. grid[n][m] = block height (m) of the block in column n, row m.
   * Each column n acts as one element with mean reflection factor  R̄_n = (1/M) Σ_m exp(−2jk h_nm).
   */
  function diffuserPolar2DCut({ grid, w, periods = 1, f, c, angles = null, flat = false }) {
    const k = (2 * Math.PI * f) / c;
    const cols = [];
    for (let p = 0; p < periods; p++)
      for (const col of grid) {
        let re = 0;
        let im = 0;
        for (const h of col) {
          const ph = flat ? 0 : -2 * k * h;
          re += Math.cos(ph);
          im += Math.sin(ph);
        }
        cols.push([re / col.length, im / col.length]);
      }
    const degs = angles || Array.from({ length: 37 }, (_, i) => -90 + 5 * i);
    return {
      width: cols.length * w,
      points: degs.map((deg) => {
        const st = Math.sin((deg * Math.PI) / 180);
        const u = (k * w * st) / 2;
        const sinc = u === 0 ? 1 : Math.sin(u) / u;
        let re = 0;
        let im = 0;
        cols.forEach(([cr, ci], i) => {
          const ph = k * (i + 0.5) * w * st;
          const cp = Math.cos(ph);
          const sp = Math.sin(ph);
          re += w * sinc * (cr * cp - ci * sp);
          im += w * sinc * (cr * sp + ci * cp);
        });
        return { deg, energy: re * re + im * im };
      }),
    };
  }

  /** Directional diffusion coefficient (ISO 17497-2 autocorrelation form) from energies. */
  function diffusionCoefficient(energies) {
    const n = energies.length;
    const s1 = energies.reduce((a, b) => a + b, 0);
    const s2 = energies.reduce((a, b) => a + b * b, 0);
    return (s1 * s1 - s2) / ((n - 1) * s2);
  }

  /* ------------------------------------------------------------------ */
  /* Build layout (for the project document)                             */
  /* ------------------------------------------------------------------ */
  /**
   * Hole layout on a panel W × H (m), hole radius r, spacing D.
   * Edge margin = D/2 (from panel edge to the first hole centre), so the
   * local open area is the same as the nominal value.
   * Triangular grid: rows at D·√3/2, every second row moved by D/2.
   */
  function holeLayout({ W, H, D, r, pattern = 'square' }) {
    const margin = D / 2;
    let rows;
    let total;
    let perRowA;
    let perRowB;
    let rowPitch;
    if (pattern === 'triangular') {
      rowPitch = (D * Math.sqrt(3)) / 2;
      rows = H >= D ? Math.floor((H - D) / rowPitch + 1e-9) + 1 : 0;
      perRowA = Math.floor(W / D + 1e-9);
      perRowB = Math.max(0, Math.floor(W / D - 0.5 + 1e-9));
      total = Math.ceil(rows / 2) * perRowA + Math.floor(rows / 2) * perRowB;
    } else {
      rowPitch = D;
      rows = Math.floor(H / D + 1e-9);
      perRowA = perRowB = Math.floor(W / D + 1e-9);
      total = rows * perRowA;
    }
    const openArea = (total * Math.PI * r * r) / (W * H);
    return { margin, rowPitch, rows, perRowA, perRowB, total, openArea, perSquareMetre: total / (W * H) };
  }

  /** Slot layout: slots parallel to H, pitch across W, margin pitch/2 at every edge. */
  function slotLayout({ W, H, pitch, w }) {
    const count = Math.floor(W / pitch + 1e-9);
    const length = Math.max(0, H - pitch);
    return { count, length, margin: pitch / 2, openArea: (count * w * length) / (W * H), slatWidth: pitch - w };
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

  /* ------------------------------------------------------------------ */
  /* Treatment advisor                                                   */
  /* ------------------------------------------------------------------ */
  /**
   * Area of one or two treatments that best gives the target absorption.
   * Minimises  Σ_b w_b (Σ_j S_j α_jb − ΔA_b)²  with S_j ≥ 0  (exact for 1 or 2 treatments:
   * the unconstrained solution if it is non-negative, otherwise the best solution on the boundary).
   * @param {number[]} dA   absorption to add per band (m²); may be negative
   * @param {number[][]} alphas  α per band for each treatment (1 or 2 treatments)
   * @param {number[]} w    weight per band
   * @returns {{ areas: number[], residual: number }}
   */
  function fitTreatmentAreas(dA, alphas, w) {
    const nb = dA.length;
    const res = (S) => {
      let r = 0;
      for (let b = 0; b < nb; b++) {
        let a = -dA[b];
        for (let j = 0; j < S.length; j++) a += S[j] * alphas[j][b];
        r += w[b] * a * a;
      }
      return r;
    };
    const single = (al) => {
      let num = 0;
      let den = 0;
      for (let b = 0; b < nb; b++) {
        num += w[b] * al[b] * dA[b];
        den += w[b] * al[b] * al[b];
      }
      return den > 0 ? Math.max(0, num / den) : 0;
    };
    if (alphas.length === 1) {
      const S = [single(alphas[0])];
      return { areas: S, residual: res(S) };
    }
    const [a1, a2] = alphas;
    let s11 = 0, s12 = 0, s22 = 0, r1 = 0, r2 = 0;
    for (let b = 0; b < nb; b++) {
      s11 += w[b] * a1[b] * a1[b];
      s12 += w[b] * a1[b] * a2[b];
      s22 += w[b] * a2[b] * a2[b];
      r1 += w[b] * a1[b] * dA[b];
      r2 += w[b] * a2[b] * dA[b];
    }
    const det = s11 * s22 - s12 * s12;
    const cands = [[0, 0], [single(a1), 0], [0, single(a2)]];
    if (Math.abs(det) > 1e-12 * (s11 * s22 + 1e-30)) {
      const x = (r1 * s22 - r2 * s12) / det;
      const y = (s11 * r2 - s12 * r1) / det;
      if (x >= 0 && y >= 0) cands.push([x, y]);
    }
    let best = null;
    for (const S of cands) {
      const r = res(S);
      if (!best || r < best.residual - 1e-15) best = { areas: S, residual: r };
    }
    return best;
  }

  /* Target reverberation times ------------------------------------------ */
  const OCT6 = [125, 250, 500, 1000, 2000, 4000];
  // DIN 18041:2016 group A1–A4 tolerance range (ratio T / T_soll) per octave band.
  const DIN_TOL = { 125: [0.65, 1.45], 250: [0.8, 1.2], 500: [0.8, 1.2], 1000: [0.8, 1.2], 2000: [0.8, 1.2], 4000: [0.65, 1.2] };
  // DIN 18041 A5 (sport): ±20 % from 250 to 2000 Hz; no requirement at 125 and 4000 Hz.
  const DIN_TOL_A5 = { 125: null, 250: [0.8, 1.2], 500: [0.8, 1.2], 1000: [0.8, 1.2], 2000: [0.8, 1.2], 4000: null };
  // A maximum only, from 250 (or 500) to 2000 Hz.
  const MAX_ONLY = (from) => Object.fromEntries(OCT6.map((o) => [o, o >= from && o <= 2000 ? [0, 1] : null]));
  const flat = (lo, hi) => Object.fromEntries(OCT6.map((o) => [o, [lo, hi]]));
  const lg = Math.log10;
  const DIN_OCCUPIED = 'DIN 18041 gives T_soll for the room in use (80 % of the places occupied). People add absorption, so the empty room can have a longer RT60.';
  // DIN 18041 group B: minimum A/V (m²/m³) from 250 to 2000 Hz; h = clear room height (m).
  const DIN_B = {
    B3: (h) => (h <= 2.5 ? 0.2 : 1 / (3.13 + 4.69 * lg(h))),
    B4: (h) => (h <= 2.5 ? 0.25 : 1 / (2.13 + 4.69 * lg(h))),
    B5: (h) => (h <= 2.5 ? 0.3 : 1 / (1.47 + 4.69 * lg(h))),
  };

  /**
   * Room uses with their target. din: DIN 18041:2016 group A formula T_soll(V) (vmax exclusive).
   * advice: placement rules (ASD-STE100 style).
   */
  const ROOM_USES = [
    { id: 'living', label: 'Living room or home office', kind: 'guide', T: 0.5, tol: flat(0.8, 1.2),
      note: 'No standard gives a target for living rooms. The advisor uses 0.5 s as a guide value.',
      advice: ['Use soft furnishings first: a rug, curtains, a sofa and a full bookshelf.', 'Then add panels on the walls at ear height, and spread them around the room.'] },
    { id: 'video', label: 'Video calls, podcast or voice recording', kind: 'guide', T: 0.3, tol: flat(0.7, 1.3),
      note: 'No standard gives a target for small voice rooms. The advisor uses 0.3 s as a guide value.',
      advice: ['Put absorbers on the wall behind you, on the wall in front of you and on the side walls at mouth height.', 'Put an absorber or a rug where the sound from your mouth reflects from the desk or floor.'] },
    { id: 'studio', label: 'Studio control room or critical listening (ITU-R BS.1116)', kind: 'bs1116',
      advice: ['Put absorbers at the first reflection points on the side walls and the ceiling between the loudspeakers and the listener.', 'Put bass absorbers in the corners, mostly behind the loudspeakers.', 'Use diffusion or thick absorbers on the rear wall.', 'Make the room symmetric from left to right.'] },
    { id: 'cinema', label: 'Home cinema', kind: 'bs1116',
      note: 'No single standard gives a target for home cinemas. The advisor uses the listening-room value of ITU-R BS.1116 as a guide.',
      advice: ['Put absorbers at the first reflection points on the side walls.', 'Put bass absorbers in the corners.', 'Treat the wall behind the seats with absorbers or diffusers.'] },
    { id: 'music', label: 'Music practice or rehearsal room (DIN 18041 A1)', kind: 'din', f: (V) => 0.45 * lg(V) + 0.07, vmin: 30, vmax: 1000, tol: DIN_TOL, src: 'DIN 18041 A1',
      advice: ['Use a mix of absorbers and diffusers. Too much absorption makes music sound dull.', 'Include bass absorbers. Thin panels do not control bass.'] },
    { id: 'lecture', label: 'Lecture or presentation room (DIN 18041 A2)', kind: 'din', f: (V) => 0.37 * lg(V) - 0.14, vmin: 50, vmax: 5000, tol: DIN_TOL, src: 'DIN 18041 A2',
      advice: ['Keep the ceiling above the speaker reflective. It sends speech to the audience.', 'Put absorbers on the rear wall to stop echoes back to the speaker.', 'Put absorbers on the ceiling over the audience.'] },
    { id: 'meeting', label: 'Meeting room or classroom (DIN 18041 A3)', kind: 'din', f: (V) => 0.32 * lg(V) - 0.17, vmin: 30, vmax: 5000, tol: DIN_TOL, src: 'DIN 18041 A3',
      advice: ['Put most of the absorption on the ceiling.', 'Add absorbers on the rear wall to stop echoes.', 'Use wall panels at head height if the ceiling cannot be treated.'] },
    { id: 'inclusive', label: 'Inclusive teaching or communication (DIN 18041 A4)', kind: 'din', f: (V) => 0.26 * lg(V) - 0.14, vmin: 30, vmax: 500, tol: DIN_TOL, src: 'DIN 18041 A4',
      advice: ['Treat the ceiling and the rear wall.', 'Include bass absorption: long low-frequency reverberation decreases speech clarity.'] },
    { id: 'classroomUS', label: 'Classroom (ANSI/ASA S12.60, USA)', kind: 'ansi',
      advice: ['Put most of the absorption on the ceiling.', 'Add absorbers on the rear wall to stop echoes.'] },
    { id: 'sport', label: 'Sports hall (DIN 18041 A5)', kind: 'din', f: (V) => (V >= 10000 ? 2.0 : 0.75 * lg(V) - 1.0), vmin: 200, vmax: Infinity, tol: DIN_TOL_A5, src: 'DIN 18041 A5',
      advice: ['Use impact-resistant absorbers or ceiling baffles.', 'Treat the ceiling and the upper walls.'] },
    { id: 'office', label: 'Office or open-plan office (DIN 18041 B4)', kind: 'dinB', grp: 'B4',
      advice: ['Put absorption on the ceiling over the whole room.', 'In open-plan offices, add absorbing screens between desks and absorbers on the walls.'] },
    { id: 'singleOffice', label: 'Single office (DIN 18041 B3)', kind: 'dinB', grp: 'B3',
      advice: ['Put absorption on the ceiling, or on the walls near the desk.'] },
    { id: 'canteen', label: 'Canteen (DIN 18041 B5)', kind: 'dinB', grp: 'B5',
      advice: ['Put absorption on the whole ceiling.', 'Add wall absorbers above head height, where they are safe from damage.'] },
  ];

  /**
   * Target RT for a room use.
   * @param {string} useId
   * @param {number} V room volume (m³)
   * @param {object} opts { h: room height (m), c: speed of sound (m/s) }
   * @returns { T, tol: {band: [lo, hi] | null} (ratio to T; null = no requirement), shape, source, note, outOfRange, maxOnly }
   */
  function targetRT(useId, V, opts = {}) {
    const u = ROOM_USES.find((x) => x.id === useId) || ROOM_USES[0];
    const c = opts.c || 343;
    let T;
    let tol;
    let source;
    let note = u.note || null;
    let outOfRange = null;
    let maxOnly = false;
    if (u.kind === 'din') {
      T = u.f(V);
      tol = u.tol;
      source = u.src;
      note = DIN_OCCUPIED;
      if (V < u.vmin || V >= u.vmax) outOfRange = `${u.src} gives this formula for ${u.vmin} m³ ≤ V < ${u.vmax} m³. The room volume is outside this range.`;
    } else if (u.kind === 'bs1116') {
      T = 0.25 * Math.cbrt(V / 100); // ITU-R BS.1116-3: Tm = 0.25 (V/V0)^(1/3), V0 = 100 m³
      // ±0.05 s from 200 Hz to 4 kHz; the upper limit increases to +0.3 s at 63 Hz (≈ +0.15 s at 125 Hz).
      const d = 0.05 / T;
      tol = { 125: [1 - d, 1 + 0.15 / T], 250: [1 - d, 1 + d], 500: [1 - d, 1 + d], 1000: [1 - d, 1 + d], 2000: [1 - d, 1 + d], 4000: [1 - d, 1 + d] };
      source = 'ITU-R BS.1116';
      if (T < 0.2 || T > 0.4) outOfRange = 'EBU Tech 3276 limits Tm to 0.2–0.4 s. This room is outside the usual size of a listening room.';
    } else if (u.kind === 'ansi') {
      T = V <= 283 ? 0.6 : 0.7;
      tol = MAX_ONLY(500);
      maxOnly = true;
      source = 'ANSI/ASA S12.60';
      note = 'ANSI/ASA S12.60 gives a maximum RT60 for the unoccupied, furnished classroom (500–2000 Hz).';
      if (V > 566) outOfRange = 'ANSI/ASA S12.60 gives these limits for classrooms up to 566 m³.';
    } else if (u.kind === 'dinB') {
      const ratio = DIN_B[u.grp](opts.h || 2.5);
      T = (24 * Math.log(10)) / (c * ratio); // A/V ≥ ratio  ⇔  T ≤ 55.26 / (c · ratio)  (Sabine)
      tol = MAX_ONLY(250);
      maxOnly = true;
      source = `DIN 18041 ${u.grp}: A/V ≥ ${ratio.toFixed(3)} m²/m³`;
      note = `DIN 18041 group ${u.grp[0]} sets a minimum absorption area per volume (A/V) from 250 to 2000 Hz, not an RT60. The advisor converts it to a maximum RT60 with the Sabine formula.`;
    } else {
      T = u.T;
      tol = u.tol;
      source = 'guide value';
    }
    // Centre of the allowed range (ratio to T), and the relative half width used to weight each band.
    const shape = {};
    const halfWidth = {};
    for (const o of OCT6) {
      if (!tol[o]) {
        shape[o] = 1;
        halfWidth[o] = null; // no requirement in this band
      } else if (maxOnly) {
        shape[o] = 0.9; // aim 10 % below the maximum (design margin)
        halfWidth[o] = 0.1;
      } else {
        shape[o] = (tol[o][0] + tol[o][1]) / 2;
        halfWidth[o] = (tol[o][1] - tol[o][0]) / 2;
      }
    }
    return { T, tol, shape, halfWidth, source, note, outOfRange, maxOnly, use: u };
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
    freeLayer,
    reflection,
    absorption,
    holeOpenArea,
    perforatedFacing,
    slottedFacing,
    microperforatedFacing,
    maaApproxImpedance,
    membraneFacing,
    resistiveFacing,
    helmholtzResonator,
    isPrime,
    primitiveRoot,
    qrdSequence,
    prdSequence,
    qrd2DSequence,
    diffuserDepths,
    diffuserPolar,
    diffuserPolar2DCut,
    diffusionCoefficient,
    holeLayout,
    slotLayout,
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
    fitTreatmentAreas,
    ROOM_USES,
    targetRT,
    schroederFrequency,
  };
});
