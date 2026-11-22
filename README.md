# Acoustic Calculator

Web calculators for the design of acoustic absorber panels. The calculators are static HTML pages. They do not need a server, a build step or an internet connection.

## Calculators

| Page | What it calculates |
| --- | --- |
| `porous.html` | Absorption of a porous layer on a wall, with or without an air gap |
| `perforated.html` | Absorption of a panel with round holes over a cavity |
| `slotted.html` | Absorption of a slotted panel or a slat wall over a cavity |
| `microperforated.html` | Absorption of a microperforated panel (Maa exact model) |
| `membrane.html` | Absorption and resonance of a limp sheet over a cavity |
| `resonance.html` | Resonance frequency, or cavity depth for a target frequency |
| `flow-resistivity.html` | Flow resistivity from a measurement or from fibre data |
| `ratings.html` | NRC, SAA (ASTM C423), αw and absorption class (ISO 11654) |
| `reverberation.html` | RT60 before and after you add panels (Sabine, Eyring) |
| `room-modes.html` | Room modes and Schroeder frequency |
| `sound-in-air.html` | Speed of sound, air properties, wavelength |

The absorber pages calculate for normal incidence, one angle, or a diffuse field (Paris integral). They show the absorption by 1/3-octave and octave band, NRC, SAA and αw. You can keep curves to compare them, download a CSV file, and copy a link that contains the inputs.

## How to use

1. Open `index.html` in a web browser.
2. Select a calculator.

To publish the pages with GitHub Pages, set the source to the root of the branch. No build is necessary.

## How to test

```
npm test        # or: node --test
```

The tests need Node.js 18 or later. They check `js/core.js` against these references:

- The "Porous Absorber Calculator V1.60" spreadsheet (C. Whealy). The porous (with and without air gap) and perforated-panel absorption rows agree to ±0.006. The fibre flow-resistivity values agree to ±1 rayl/m.
- SciPy for the complex Bessel functions (12 decimal places).
- An independent NumPy calculation for oblique incidence.
- Physical limits: Poiseuille flow for holes and slits, the high-frequency limit of the Maa model, and Maa's approximate formula.
- Rounding rules of ASTM C423 and ISO 11654.

## Differences from the reference spreadsheet

The spreadsheet has some errors. This calculator does not copy them.

| Spreadsheet item | Problem | This calculator |
| --- | --- | --- |
| Slotted panel sheet | Adds −jρ₀c₀·cot(k·t′) to the panel impedance. This is a closed-tube term. With the sheet's default inputs, the sheet puts the peak at approximately 1.8 kHz. This calculator puts it at approximately 780 Hz (the empty-cavity Helmholtz formula gives 971 Hz). | Helmholtz model: slot mass with end correction, plus exact viscous slit impedance. |
| Microperforated sheet | Shows `#NAME?` in Office 365 (VBA Bessel functions do not run). | Exact Maa model with a complex Bessel ratio. |
| Perforated sheet, cavity filled | Leaves out the resistance r_m in this one arrangement. | Includes r_m (difference less than 0.01 in α). |
| Thermal boundary layer | Uses c_p = 1.01 J/(kg·K) instead of 1010. | Not used. |
| Random-fibre flow resistivity | Uses exponent 1.333 instead of 4/3 (7 075 against 7 065 rayl/m). | Uses 4/3. |

## Files

```
index.html, *.html   calculator pages
css/style.css        styles (light and dark theme)
js/core.js           physics (browser and Node.js)
js/ui.js             forms, charts, tables
js/absorber.js       shared logic of the absorber pages
test/core.test.js    tests
```

## Limits

All results are predictions from published models. Real panels can be different because of panel size, mounting, panel vibration and material quality. Each page shows its limits. For a final design, use data measured in a laboratory.

## References

- T. J. Cox and P. D'Antonio, *Acoustic Absorbers and Diffusers: Theory, Design and Application*.
- M. E. Delany and E. N. Bazley, Applied Acoustics 3 (1970) 105–116.
- Y. Miki, J. Acoust. Soc. Jpn (E) 11 (1990) 19–24.
- D.-Y. Maa, J. Acoust. Soc. Am. 104 (1998) 2861–2866.
- ISO 11654:1997, ASTM C423, ISO 354, ISO 9053.
