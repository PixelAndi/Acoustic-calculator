/*
 * Acoustic Calculator – reference entries.
 * Each entry was checked against the publisher, Crossref (DOI), the AES
 * E-Library index or the standards body during the source review.
 */
(function () {
  'use strict';
  REFERENCES.add({
    /* ---------------- Rooms ---------------- */
    sabine1922: {
      group: 'Rooms and reverberation',
      text: 'W. C. Sabine, Collected Papers on Acoustics. Cambridge, MA: Harvard University Press, 1922.',
      url: 'https://catalog.crl.edu/Record/e937a69e-7165-5b07-b7ea-b3983fc1a042',
    },
    eyring1930: {
      group: 'Rooms and reverberation',
      text: 'C. F. Eyring, "Reverberation time in “dead” rooms," J. Acoust. Soc. Am., vol. 1, no. 2A, pp. 217–241, 1930.',
      doi: '10.1121/1.1915175',
      note: 'The calculator uses the metric form (24 ln 10 / c ≈ 0.161 s/m).',
    },
    kuttruff2016: {
      group: 'Textbooks',
      text: 'H. Kuttruff, Room Acoustics, 6th ed. Boca Raton, FL: CRC Press, 2016.',
      doi: '10.1201/9781315372150',
    },
    everest2022: {
      group: 'Textbooks',
      text: 'F. A. Everest and K. C. Pohlmann, Master Handbook of Acoustics, 7th ed. New York: McGraw-Hill, 2022. ISBN 978-1-260-47359-9.',
    },
    long2014: {
      group: 'Textbooks',
      text: 'M. Long, Architectural Acoustics, 2nd ed. Oxford: Academic Press (Elsevier), 2014. ISBN 978-0-12-398258-2.',
      doi: '10.1016/b978-0-12-398258-2.00002-7',
      note: 'DOI of the chapter "Fundamentals of Acoustics".',
    },
    kinsler2000: {
      group: 'Textbooks',
      text: 'L. E. Kinsler, A. R. Frey, A. B. Coppens and J. V. Sanders, Fundamentals of Acoustics, 4th ed. New York: Wiley, 2000. ISBN 978-0-471-84789-2.',
    },
    toole2025: {
      group: 'Textbooks',
      text: 'F. E. Toole, S. E. Olive and T. Welti, Sound Reproduction: The Acoustics and Psychoacoustics of Loudspeakers and Rooms, 4th ed. New York: Focal Press (Routledge), 2025.',
      doi: '10.4324/9781003477495',
    },
    bolt1946: {
      group: 'Rooms and reverberation',
      text: 'R. H. Bolt, "Note on normal frequency statistics for rectangular rooms," J. Acoust. Soc. Am., vol. 18, no. 1, pp. 130–133, 1946.',
      doi: '10.1121/1.1916349',
    },
    bonello1981: {
      group: 'Rooms and reverberation',
      text: 'O. J. Bonello, "A new criterion for the distribution of normal room modes," J. Audio Eng. Soc., vol. 29, no. 9, pp. 597–606, 1981.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=3889',
    },
    cox2004rooms: {
      group: 'Rooms and reverberation',
      text: 'T. J. Cox, P. D’Antonio and M. R. Avis, "Room sizing and optimization at low frequencies," J. Audio Eng. Soc., vol. 52, no. 6, pp. 640–651, 2004.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=13011',
    },
    schroeder1962: {
      group: 'Rooms and reverberation',
      text: 'M. R. Schroeder and K. H. Kuttruff, "On frequency response curves in rooms. Comparison of experimental, theoretical, and Monte Carlo results for the average frequency spacing between maxima," J. Acoust. Soc. Am., vol. 34, no. 1, pp. 76–80, 1962.',
      doi: '10.1121/1.1909022',
    },
    schroeder1996: {
      group: 'Rooms and reverberation',
      text: 'M. R. Schroeder, "The “Schroeder frequency” revisited," J. Acoust. Soc. Am., vol. 99, no. 5, pp. 3240–3241, 1996.',
      doi: '10.1121/1.414868',
    },
    olive1989: {
      group: 'Rooms and reverberation',
      text: 'S. E. Olive and F. E. Toole, "The detection of reflections in typical rooms," J. Audio Eng. Soc., vol. 37, no. 7/8, pp. 539–553, 1989.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=6079',
    },
    halmrast2015: {
      group: 'Rooms and reverberation',
      text: 'T. Halmrast, "Why do flutter echoes always end up around 1–2 kHz?" Proc. Institute of Acoustics, Auditorium Acoustics, 2015.',
      doi: '10.25144/16176',
    },

    /* ---------------- Standards ---------------- */
    din18041: {
      group: 'Standards and guidelines',
      text: 'DIN 18041:2016-03, Hörsamkeit in Räumen – Anforderungen, Empfehlungen und Hinweise für die Planung (Acoustic quality in rooms). Berlin: DIN, 2016.',
      url: 'https://www.dinmedia.de/de/norm/din-18041/245356770',
      note: 'Formulas and tolerance values were read from a manufacturer summary of the standard (OWA, "Raumakustik", DS 9558).',
    },
    owa: {
      group: 'Standards and guidelines',
      text: 'OWA, "Raumakustik" (brochure DS 9558, summary of DIN 18041:2016).',
      url: 'https://www.owa.de/wp-content/uploads/2018/12/DS_9558.pdf',
    },
    bs1116: {
      group: 'Standards and guidelines',
      text: 'ITU-R Recommendation BS.1116-3, Methods for the subjective assessment of small impairments in audio systems, §8.2.3. Geneva: ITU, 2015.',
      url: 'https://www.itu.int/rec/R-REC-BS.1116',
    },
    ebu3276: {
      group: 'Standards and guidelines',
      text: 'EBU Tech 3276, Listening conditions for the assessment of sound programme material: monophonic and two-channel stereophonic, 2nd ed. Geneva: EBU, 1998.',
      url: 'https://tech-qual.ebu.ch/publications/tech3276',
    },
    ansi1260: {
      group: 'Standards and guidelines',
      text: 'ANSI/ASA S12.60-2010/Part 1, Acoustical performance criteria, design requirements, and guidelines for schools, Part 1: Permanent schools. Melville, NY: Acoustical Society of America, 2010.',
    },
    asra37: {
      group: 'Standards and guidelines',
      text: 'ASR A3.7 Lärm (Technical Rules for Workplaces: Noise), edition 2021. Dortmund: BAuA, 2021.',
      url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A3-7',
    },
    iso354: {
      group: 'Standards and guidelines',
      text: 'ISO 354:2003, Acoustics – Measurement of sound absorption in a reverberation room. Geneva: ISO, 2003.',
      url: 'https://www.iso.org/standard/34545.html',
    },
    iso11654: {
      group: 'Standards and guidelines',
      text: 'ISO 11654:1997, Acoustics – Sound absorbers for use in buildings – Rating of sound absorption. Geneva: ISO, 1997.',
      url: 'https://www.iso.org/search.html?q=ISO%2011654',
    },
    iso3382: {
      group: 'Standards and guidelines',
      text: 'ISO 3382-2:2008, Acoustics – Measurement of room acoustic parameters – Part 2: Reverberation time in ordinary rooms. Geneva: ISO, 2008.',
      url: 'https://www.iso.org/search.html?q=ISO%203382-2',
    },
    astmc423: {
      group: 'Standards and guidelines',
      text: 'ASTM C423-23e1, Standard test method for sound absorption and sound absorption coefficients by the reverberation room method. West Conshohocken, PA: ASTM International, 2023.',
      url: 'https://store.astm.org/c0423-23e01.html',
      note: 'SAA is defined in this edition. The 2023 edition states that NRC was defined in previous versions of the method.',
    },

    /* ---------------- Air ---------------- */
    ussa1976: {
      group: 'Air properties',
      text: 'NOAA, NASA and USAF, U.S. Standard Atmosphere, 1976. Washington, DC: U.S. Government Printing Office, 1976 (Sutherland constants β = 1.458×10⁻⁶ kg/(m·s·K^½), S = 110.4 K).',
      url: 'https://ntrs.nasa.gov/citations/19770009539',
    },
    sutherland1893: {
      group: 'Air properties',
      text: 'W. Sutherland, "The viscosity of gases and molecular force," Philosophical Magazine, ser. 5, vol. 36, no. 223, pp. 507–531, 1893.',
      doi: '10.1080/14786449308620508',
    },
    iso9613: {
      group: 'Air properties',
      text: 'ISO 9613-1:1993, Acoustics – Attenuation of sound during propagation outdoors – Part 1: Calculation of the absorption of sound by the atmosphere (reference conditions 101.325 kPa, 293.15 K). Geneva: ISO, 1993.',
      url: 'https://www.iso.org/search.html?q=ISO%209613-1',
    },

    /* ---------------- Diffusers ---------------- */
    schroeder1975: {
      group: 'Diffusers',
      text: 'M. R. Schroeder, "Diffuse sound reflection by maximum-length sequences," J. Acoust. Soc. Am., vol. 57, no. 1, pp. 149–150, 1975.',
      doi: '10.1121/1.380425',
    },
    schroeder1979: {
      group: 'Diffusers',
      text: 'M. R. Schroeder, "Binaural dissimilarity and optimum ceilings for concert halls: More lateral sound diffusion," J. Acoust. Soc. Am., vol. 65, no. 4, pp. 958–963, 1979.',
      doi: '10.1121/1.382601',
      note: 'Quadratic residue diffuser.',
    },
    schroeder1980: {
      group: 'Diffusers',
      text: 'M. R. Schroeder, "Toward better acoustics for concert halls," Physics Today, vol. 33, no. 10, pp. 24–30, 1980.',
      doi: '10.1063/1.2913787',
      note: 'Primitive root diffuser.',
    },
    dantonio1984: {
      group: 'Diffusers',
      text: 'P. D\u2019Antonio and J. H. Konnert, "The reflection phase grating diffusor: Design theory and application," J. Audio Eng. Soc., vol. 32, no. 4, pp. 228–238, 1984.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=4512',
    },
    dantonio1992: {
      group: 'Diffusers',
      text: 'P. D\u2019Antonio and J. Konnert, "The QRD Diffractal: A new one- or two-dimensional fractal sound diffusor," J. Audio Eng. Soc., vol. 40, no. 3, 1992.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=7057',
    },
    dantonio1998: {
      group: 'Diffusers',
      text: 'P. D\u2019Antonio and T. J. Cox, "Two decades of sound diffusor design and development, Part 1: Applications and design," J. Audio Eng. Soc., vol. 46, no. 11, pp. 955–976, 1998.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=7652',
    },
    cox2006history: {
      group: 'Diffusers',
      text: 'T. J. Cox and P. D\u2019Antonio, "A brief history of room acoustic diffusers," Acoustics Today, vol. 2, no. 3, 2006.',
      url: 'https://acousticstoday.org/wp-content/uploads/2019/10/A-BRIEF-HISTORY-OF-ROOM-ACOUSTIC-DIFFUSERS-Trevor-J.-Cox.pdf',
      note: 'Open access. Gives the QRD sequence n² mod N (N = 7: 0, 1, 4, 2, 2, 4, 1) and the Fourier far-field principle.',
    },
    dadiotis2008: {
      group: 'Diffusers',
      text: 'K. Dadiotis, J. A. S. Angus and T. J. Cox, "Lüke and power residue sequence diffusers," J. Acoust. Soc. Am., vol. 123, no. 4, pp. 2035–2042, 2008.',
      doi: '10.1121/1.2885761',
      note: 'Flat-plate frequencies at multiples of N·f₀.',
    },
    hargreaves2000: {
      group: 'Diffusers',
      text: 'T. J. Hargreaves, T. J. Cox, Y. W. Lam and P. D\u2019Antonio, "Surface diffusion coefficients for room acoustics: Free-field measures," J. Acoust. Soc. Am., vol. 108, no. 4, pp. 1710–1720, 2000.',
      doi: '10.1121/1.1310192',
      note: 'Autocorrelation diffusion coefficient.',
    },
    iso17497: {
      group: 'Standards and guidelines',
      text: 'ISO 17497-2:2012, Acoustics – Sound-scattering properties of surfaces – Part 2: Measurement of the directional diffusion coefficient in a free field. Geneva: ISO, 2012.',
      url: 'https://www.iso.org/standard/55293.html',
    },
    aes4id: {
      group: 'Standards and guidelines',
      text: 'AES-4id-2001 (r2007), AES information document for room acoustics and sound reinforcement systems – Characterization and measurement of surface scattering uniformity. New York: Audio Engineering Society, 2001.',
      url: 'https://aes.org/publications/standards/preview.cfm?ID=4',
    },
    coxCh9: {
      group: 'Textbooks',
      text: 'T. J. Cox and P. D\u2019Antonio, "Prediction of reflection including diffraction," ch. 9 in Acoustic Absorbers and Diffusers, 3rd ed. Boca Raton, FL: CRC Press, 2016, pp. 347–386.',
      doi: '10.1201/9781315369211-22',
    },
    coxCh10: {
      group: 'Textbooks',
      text: 'T. J. Cox and P. D\u2019Antonio, "Schroeder diffusers," ch. 10 in Acoustic Absorbers and Diffusers, 3rd ed. Boca Raton, FL: CRC Press, 2016, pp. 387–428.',
      doi: '10.1201/9781315369211-23',
    },

    /* ---------------- Hanging objects ---------------- */
    davy2025: {
      group: 'Absorbers',
      text: 'J. L. Davy, M. Debevc, D. Truett, J. Payne and J. Watson, "The measurement of the sound absorption of an array of baffles," in Proc. Forum Acusticum 2025, Málaga, pp. 2557–2562.',
      doi: '10.61782/fa.2025.0875',
      note: 'Open access. Explains the ISO 354 method for discrete objects and baffle arrays.',
    },
    kawakami1998: {
      group: 'Absorbers',
      text: 'F. Kawakami and T. Sakai, "Deep-well approach for canceling the edge effect in random incident absorption measurement," J. Acoust. Soc. Jpn. (E), vol. 19, no. 5, pp. 327–338, 1998.',
      doi: '10.1250/ast.19.327',
      note: 'Edge effect of finite absorber samples.',
    },
    openstaxReflection: {
      group: 'Rooms and reverberation',
      text: 'OpenStax, College Physics, §25.2 "The law of reflection" (a reflected ray turns by 2θ when the reflector turns by θ). Houston, TX: OpenStax, Rice University.',
      url: 'https://courses.lumenlearning.com/suny-physics/chapter/25-2-the-law-of-reflection',
    },
    hyperphysicsRT: {
      group: 'Rooms and reverberation',
      text: 'C. R. Nave, "Reverberation time," HyperPhysics, Georgia State University.',
      url: 'https://hyperphysics.gsu.edu/hbase/Acoustic/revmod.html',
      note: 'Open educational page on the Sabine formula.',
    },

    /* ---------------- Absorbers ---------------- */
    delany1970: {
      group: 'Absorbers',
      text: 'M. E. Delany and E. N. Bazley, "Acoustical properties of fibrous absorbent materials," Applied Acoustics, vol. 3, no. 2, pp. 105–116, 1970.',
      doi: '10.1016/0003-682X(70)90031-9',
    },
    miki1990: {
      group: 'Absorbers',
      text: 'Y. Miki, "Acoustical properties of porous materials – Modifications of Delany-Bazley models," J. Acoust. Soc. Jpn. (E), vol. 11, no. 1, pp. 19–24, 1990.',
      doi: '10.1250/ast.11.19',
    },
    apmr: {
      group: 'Absorbers',
      text: 'Matelys, "Delany-Bazley-Miki model," APMR – Acoustical Porous Material Recipes.',
      url: 'https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/DelanyBazleyMikiModel.html',
      note: 'Open reference page; the coefficients agree with the calculator.',
    },
    allard2009: {
      group: 'Textbooks',
      text: 'J.-F. Allard and N. Atalla, Propagation of Sound in Porous Media: Modelling Sound Absorbing Materials, 2nd ed. Chichester: Wiley, 2009. ISBN 978-0-470-74661-5.',
      doi: '10.1002/9780470747339',
    },
    cox2016: {
      group: 'Textbooks',
      text: 'T. J. Cox and P. D\u2019Antonio, Acoustic Absorbers and Diffusers: Theory, Design and Application, 3rd ed. Boca Raton, FL: CRC Press, 2016. ISBN 978-1-4987-4099-9.',
      doi: '10.1201/9781315369211',
    },
    mechel2008: {
      group: 'Textbooks',
      text: 'F. P. Mechel (ed.), Formulas of Acoustics, 2nd ed. Berlin: Springer, 2008. ISBN 978-3-540-76832-6.',
      doi: '10.1007/978-3-540-76833-3',
    },
    paris1928: {
      group: 'Absorbers',
      text: 'E. T. Paris, "On the coefficient of sound-absorption measured by the reverberation method," Philosophical Magazine, ser. 7, vol. 5, pp. 489–497, 1928.',
      doi: '10.1080/14786440308565092',
    },
    ingard1953: {
      group: 'Absorbers',
      text: 'U. Ingard, "On the theory and design of acoustic resonators," J. Acoust. Soc. Am., vol. 25, no. 6, pp. 1037–1061, 1953.',
      doi: '10.1121/1.1907235',
    },
    jaouen2018: {
      group: 'Absorbers',
      text: 'L. Jaouen and F. Chevillotte, "Length correction of 2D discontinuities or perforations at large wavelengths and for linear acoustics," Acta Acustica united with Acustica, vol. 104, pp. 243–250, 2018.',
      doi: '10.3813/AAA.919166',
      note: 'The interaction term 1 − 1.47√ε + 0.47ε^{3/2} is Nesterov\u2019s (1941) fit, stated for √ε ≤ 0.9; the flanged end correction is 8a/(3π) ≈ 0.85a.',
    },
    smits1951: {
      group: 'Absorbers',
      text: 'J. M. A. Smits and C. W. Kosten, "Sound absorption by slit resonators," Acustica, vol. 1, 1951.',
      note: 'Page numbers not verified. The ln-sin end correction is also given in Mechel (2008), pp. 316–327, for open areas 0.1–0.7.',
    },
    stinson1991: {
      group: 'Absorbers',
      text: 'M. R. Stinson, "The propagation of plane sound waves in narrow and wide circular tubes, and generalization to uniform tubes of arbitrary cross-sectional shape," J. Acoust. Soc. Am., vol. 89, no. 2, pp. 550–558, 1991.',
      doi: '10.1121/1.400379',
    },
    maa1975: {
      group: 'Absorbers',
      text: 'D.-Y. Maa, "Theory and design of microperforated panel sound-absorbing constructions," Scientia Sinica, vol. 18, 1975.',
      note: 'Page numbers differ between sources.',
    },
    maa1998: {
      group: 'Absorbers',
      text: 'D.-Y. Maa, "Potential of microperforated panel absorber," J. Acoust. Soc. Am., vol. 104, no. 5, pp. 2861–2866, 1998.',
      doi: '10.1121/1.423870',
    },
    ford1969: {
      group: 'Absorbers',
      text: 'R. D. Ford and M. A. McCormick, "Panel sound absorbers," J. Sound Vib., vol. 10, no. 3, pp. 411–423, 1969.',
      doi: '10.1016/0022-460X(69)90219-3',
    },
    calder2017: {
      group: 'Absorbers',
      text: 'R. Calder, "New research on low-frequency absorption using membranes," Audio Engineering Society 143rd Convention, paper 9886, 2017.',
      url: 'https://www.aes.org/e-lib/browse.cfm?elib=19283',
    },
    levine1948: {
      group: 'Absorbers',
      text: 'H. Levine and J. Schwinger, "On the radiation of sound from an unflanged circular pipe," Physical Review, vol. 73, no. 4, pp. 383–406, 1948.',
      doi: '10.1103/PhysRev.73.383',
      note: 'End correction 0.6133a of an unflanged pipe.',
    },
    thomasson1980: {
      group: 'Absorbers',
      text: 'S.-I. Thomasson, "On the absorption coefficient," Acustica, vol. 44, pp. 265–273, 1980.',
      note: 'Edge effect of finite absorbers. No DOI.',
    },
    iso9053: {
      group: 'Standards and guidelines',
      text: 'ISO 9053-1:2018, Acoustics – Determination of airflow resistance – Part 1: Static airflow method. Geneva: ISO, 2018.',
      url: 'https://www.iso.org/standard/69869.html',
    },
    bies1980: {
      group: 'Absorbers',
      text: 'D. A. Bies and C. H. Hansen, "Flow resistance information for acoustical design," Applied Acoustics, vol. 13, no. 5, pp. 357–391, 1980.',
      doi: '10.1016/0003-682X(80)90002-X',
    },
    tarnow1996: {
      group: 'Absorbers',
      text: 'V. Tarnow, "Airflow resistivity of models of fibrous acoustic materials," J. Acoust. Soc. Am., vol. 100, no. 6, pp. 3706–3713, 1996.',
      doi: '10.1121/1.417233',
    },
    whealy2020: {
      group: 'Validation',
      text: 'C. Whealy, Porous Absorber Calculator V1.60 (spreadsheet, re-implementation of the MATLAB scripts in Cox & D\u2019Antonio, appendix B), 2020.',
      note: 'Used as test data for the porous and perforated models.',
    },

    /* ---------------- Product data ---------------- */
    lundbergs: {
      group: 'Product data (advisor)',
      text: 'Lundbergs, "Akustikpanel" (product guide: slat panels on PET felt; class A− on 45 mm battens with insulation, class D− directly on wall).',
      url: 'https://www.lundbergs.com/guider/akustikpanel/',
    },
    rusta: {
      group: 'Product data (advisor)',
      text: 'Rusta, acoustic slat panel 1175 × 360 mm, 15 mm (product page: "klass C"); Hexagon felt wall panels (no absorption data published).',
    },
    peutz2024: {
      group: 'Product data (advisor)',
      text: 'Peutz, Test report A 4576-2E-RA-001: sound absorption of 9 mm and 18 mm PET felt (ISO 354, ISO 11654), 2024.',
      url: 'https://chameleonwriting.com/wp-content/uploads/2024/05/Acoustic-test-report_9-18-mm-PET-felt_EN.pdf',
    },
    benjo: {
      group: 'Product data (advisor)',
      text: 'Benjo, PET Felt Acoustic Panels – Technical data sheet (12 mm, ISO 354: 0.00, 0.05, 0.22, 0.49, 0.71, 0.94; αw 0.25).',
      url: 'https://www.benjo-seating.es/wp-content/uploads/2022/06/PET-Felt-Acoustic-Panels_Technical-Data-Sheet.pdf',
    },
    ikeaSkadis: {
      group: 'Product data (advisor)',
      text: 'IKEA, SKÅDIS pegboard (fibreboard, acrylic paint, 76 × 56 cm; hole size and spacing not published).',
      url: 'https://www.ikea.com/se/en/p/skadis-pegboard-white-10321618',
    },
    dpiPegboard: {
      group: 'Product data (advisor)',
      text: 'DPI hardboard pegboard product data: 1/4 in board with 9/32 in holes on 1 in centres; 1/8 in board with 3/16 in holes on 1 in centres (retailer listing, doitbest.com).',
    },
  });
})();
