# Acoustic Calculator

Web calculators for the design of acoustic absorber panels. The calculators are static HTML pages. They do not need a server, a build step or an internet connection.

## Calculators

| Page | What it calculates |
| --- | --- |
| `advisor.html` | Room treatment advisor: target RT60 for the room use, absorption needed, ranked solutions (panels, shop product types, your own products from data sheets), furniture tips |
| `panels.html` | Visual guide to all panel types, with a link to the correct calculator |
| `porous.html` | Absorption of a porous layer on a wall, with or without an air gap |
| `perforated.html` | Absorption of a panel with round holes over a cavity |
| `slotted.html` | Absorption of a slotted panel or a slat wall over a cavity |
| `microperforated.html` | Absorption of a microperforated panel (Maa exact model) |
| `membrane.html` | Absorption and resonance of a limp sheet over a cavity |
| `multilayer.html` | Broadband / multilayer builder: fabric, porous layers, air gaps, perforated, slotted, microperforated and membrane sheets; wall or open back |
| `clouds.html` | Horizontal clouds, tilted clouds and vertical baffles: equivalent absorption area per object |
| `diffuser.html` | QRD, PRD and 2D skyline diffusers: depths, frequency limits, polar plot, diffusion coefficient |
| `helmholtz-resonator.html` | Single Helmholtz resonator (box with a neck) |
| `resonance.html` | Resonance frequency, or cavity depth for a target frequency |
| `flow-resistivity.html` | Flow resistivity from a measurement or from fibre data |
| `ratings.html` | NRC, SAA (ASTM C423), αw and absorption class (ISO 11654) |
| `reverberation.html` | RT60 before and after you add panels (Sabine, Eyring) |
| `room-modes.html` | Room modes and Schroeder frequency |
| `sound-in-air.html` | Speed of sound, air properties, wavelength |
| `project.html` | Project document: build data, procedure, inspection list and results of saved designs |
| `learn.html` | Introduction to acoustics: the 7 ways sound interacts with the environment, decibels, absorbers, placement, safety |

Each calculator shows a drawing of the panel that changes with the inputs: the real hole or slot layout, slats, fabric, cloud side view with the reflection direction, diffuser wells and blocks.

The absorber pages calculate for normal incidence, one angle, or a diffuse field (Paris integral). They show the absorption by 1/3-octave and octave band, NRC, SAA and αw. You can keep curves to compare them, download a CSV file, and copy a link that contains the inputs.

## How to use

1. Open `index.html` in a web browser.
2. Select a calculator.

### Project document

1. On a panel page, make a design.
2. In "Add to project document", type a panel name, the panel size and the quantity. Click "Add to project".
3. Do steps 1 and 2 again for all panel types in the project.
4. Open `project.html`. Type the project name, room, author and notes.
5. Click "Print or save as PDF". To get a PDF, select "Save as PDF" as the printer.

The document has a summary, a bill of quantities, and for each design: a cross-section, build data (hole or slot layout, frame depth, absorber volume), safety warnings, a build procedure, an inspection check list, the predicted curve and the design inputs.

The project is kept in the browser (local storage). Use "Download project file" to keep a copy, and "Open project file" to use it again on a different computer.

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
- Transfer-matrix checks: oblique mass law of a limp sheet, a resistive sheet R = 2ρc (α = 0.5), a very thick free layer equal to the same layer on a wall.
- Diffusers: QRD/PRD sequences, a QRD at N·f₀ equal to a flat surface, and the 2D plane cut equal to the 1D result for one row.

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
js/project.js        project document
js/visual.js         panel drawings (SVG)
js/treatments.js     treatment catalogue for the advisor
test/core.test.js    tests
```

## Room advisor: sources and assumptions

- Target RT60: DIN 18041:2016 group A formulas (music, presentation, communication, inclusive, sport), ITU-R BS.1116 for listening rooms, and guide values (marked as such) where no standard applies.
- Shop products are shown as product types with assumed dimensions and assumed felt flow resistivity. The advisor does not contain product data, prices or offers. Type data-sheet values in "My products" for a reliable result.
- Furniture (bookshelves, sofas, rugs, curtains) is recommended, but not counted in the numbers.

## Limits

All results are predictions from published models. Real panels can be different because of panel size, mounting, panel vibration and material quality. Each page shows its limits. For a final design, use data measured in a laboratory.

## References

Every calculator page cites its sources in the text (numbered, with a reference list at the end). `references.html` lists all sources (71 entries) with DOIs or official links: peer-reviewed papers (J. Acoust. Soc. Am., J. Audio Eng. Soc., Applied Acoustics, J. Sound Vib.), standards (ISO, ITU-R, ASTM, DIN, EBU, ANSI/ASA, AES information documents) and textbooks (Cox & D'Antonio, Kuttruff, Allard & Atalla, Kinsler et al., Long, Everest & Pohlmann, Mechel).

Each entry was checked against Crossref, the publisher, the AES E-Library index or the standards body. Where a formula could not be confirmed in a source that we could read, the page says so (for example the diffuser upper limit c/(2w) and the limp-fabric impedance). SAE Institute was searched; its public pages have no citable technical content, so it is not cited.
