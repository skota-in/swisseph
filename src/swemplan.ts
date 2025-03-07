/* SWISSEPH
   Moshier planet routines

   modified for SWISSEPH by Dieter Koch

**************************************************************/
/* Copyright (C) 1997 - 2021 Astrodienst AG, Switzerland.  All rights reserved.

  License conditions
  ------------------

  This file is part of Swiss Ephemeris.

  Swiss Ephemeris is distributed with NO WARRANTY OF ANY KIND.  No author
  or distributor accepts any responsibility for the consequences of using it,
  or for whether it serves any particular purpose or works at all, unless he
  or she says so in writing.  

  Swiss Ephemeris is made available by its authors under a dual licensing
  system. The software developer, who uses any part of Swiss Ephemeris
  in his or her software, must choose between one of the two license models,
  which are
  a) GNU Affero General Public License (AGPL)
  b) Swiss Ephemeris Professional License

  The choice must be made before the software developer distributes software
  containing parts of Swiss Ephemeris to others, and before any public
  service using the developed software is activated.

  If the developer choses the AGPL software license, he or she must fulfill
  the conditions of that license, which includes the obligation to place his
  or her whole software project under the AGPL or a compatible license.
  See https://www.gnu.org/licenses/agpl-3.0.html

  If the developer choses the Swiss Ephemeris Professional license,
  he must follow the instructions as found in http://www.astro.com/swisseph/ 
  and purchase the Swiss Ephemeris Professional Edition from Astrodienst
  and sign the corresponding license contract.

  The License grants you the right to use, copy, modify and redistribute
  Swiss Ephemeris, but only under certain conditions described in the License.
  Among other things, the License requires that the copyright notices and
  this notice be preserved on all copies.

  Authors of the Swiss Ephemeris: Dieter Koch and Alois Treindl

  The authors of Swiss Ephemeris have no control or influence over any of
  the derived works, i.e. over software or services created by other
  programmers which use Swiss Ephemeris functions.

  The names of the authors or of the copyright holder (Astrodienst) must not
  be used for promoting any software, product or service which uses or contains
  the Swiss Ephemeris. This copyright notice is the ONLY place where the
  names of the authors can legally appear, except in cases where they have
  given special permission in writing.

  The trademarks 'Swiss Ephemeris' and 'Swiss Ephemeris inside' may be used
  for promoting such software, products or services.
*/

import { swe_degnorm, swe_kepler, swe_epsiln, swe_coortrf, swe_precess, swe_mod2PI, swi_polcart, swi_coortrf2 } from 'swisseph';
import { J2000, J1900, DEGTORAD, RADTODEG, KGAUSS, LIGHTTIME_AUNIT, PLAN_SPEED_INTV, EARTH_MOON_MRAT, SUN_EARTH_MRAT, SEI_EARTH, SEI_EMB, SEFLG_MOSEPH, AS_MAXCH, OK, ERR, FICT_GEO, SE_GREG_CAL, SE_JUL_CAL, J_TO_J2000 } from './constants';

const TIMESCALE = 3652500.0;

const mods3600 = (x: number) => (x - 1.296e6 * Math.floor(x / 1.296e6));

const KGAUSS_GEO = 0.0000298122353216; /* Earth only */

const pnoint2msh = [2, 2, 0, 1, 3, 4, 5, 6, 7, 8];

const freqs = [
  53810162868.8982,
  21066413643.3548,
  12959774228.3429,
  6890507749.3988,
  1092566037.7991,
  439960985.5372,
  154248119.3933,
  78655032.0744,
  52272245.1795
];

const phases = [
  252.25090552 * 3600.,
  181.97980085 * 3600.,
  100.46645683 * 3600.,
  355.43299958 * 3600.,
  34.35151874 * 3600.,
  50.07744430 * 3600.,
  314.05500511 * 3600.,
  304.34866548 * 3600.,
  860492.1546,
];

const planets = [
  mer404,
  ven404,
  ear404,
  mar404,
  jup404,
  sat404,
  ura404,
  nep404,
  plu404
];

const ss = Array.from({ length: 9 }, () => Array(24).fill(0));
const cc = Array.from({ length: 9 }, () => Array(24).fill(0));

function sscc(k: number, arg: number, n: number) {
  let cu = Math.cos(arg);
  let su = Math.sin(arg);
  ss[k][0] = su;
  cc[k][0] = cu;
  let sv = 2.0 * su * cu;
  let cv = cu * cu - su * su;
  ss[k][1] = sv;
  cc[k][1] = cv;
  for (let i = 2; i < n; i++) {
    let s = su * cv + cu * sv;
    cv = cu * cv - su * sv;
    sv = s;
    ss[k][i] = sv;
    cc[k][i] = cv;
  }
}

export function swi_moshplan2(J: number, iplm: number, pobj: number[]) {
  let T = (J - J2000) / TIMESCALE;
  for (let i = 0; i < 9; i++) {
    if (planets[iplm].max_harmonic[i] > 0) {
      let sr = (mods3600(freqs[i] * T) + phases[i]) * DEGTORAD;
      sscc(i, sr, planets[iplm].max_harmonic[i]);
    }
  }
  let p = planets[iplm].arg_tbl;
  let pl = planets[iplm].lon_tbl;
  let pb = planets[iplm].lat_tbl;
  let pr = planets[iplm].rad_tbl;
  let sl = 0.0;
  let sb = 0.0;
  let sr = 0.0;
  while (true) {
    let np = p.shift();
    if (np < 0) break;
    if (np === 0) {
      let nt = p.shift();
      let cu = pl.shift();
      for (let ip = 0; ip < nt; ip++) {
        cu = cu * T + pl.shift();
      }
      sl += mods3600(cu);
      cu = pb.shift();
      for (let ip = 0; ip < nt; ip++) {
        cu = cu * T + pb.shift();
      }
      sb += cu;
      cu = pr.shift();
      for (let ip = 0; ip < nt; ip++) {
        cu = cu * T + pr.shift();
      }
      sr += cu;
      continue;
    }
    let k1 = 0;
    let cv = 0.0;
    let sv = 0.0;
    for (let ip = 0; ip < np; ip++) {
      let j = p.shift();
      let m = p.shift() - 1;
      if (j) {
        let k = Math.abs(j) - 1;
        let su = ss[m][k];
        if (j < 0) su = -su;
        let cu = cc[m][k];
        if (k1 === 0) {
          sv = su;
          cv = cu;
          k1 = 1;
        } else {
          let t = su * cv + cu * sv;
          cv = cu * cv - su * sv;
          sv = t;
        }
      }
    }
    let nt = p.shift();
    let cu = pl.shift();
    let su = pl.shift();
    for (let ip = 0; ip < nt; ip++) {
      cu = cu * T + pl.shift();
      su = su * T + pl.shift();
    }
    sl += cu * cv + su * sv;
    cu = pb.shift();
    su = pb.shift();
    for (let ip = 0; ip < nt; ip++) {
      cu = cu * T + pb.shift();
      su = su * T + pb.shift();
    }
    sb += cu * cv + su * sv;
    cu = pr.shift();
    su = pr.shift();
    for (let ip = 0; ip < nt; ip++) {
      cu = cu * T + pr.shift();
      su = su * T + pr.shift();
    }
    sr += cu * cv + su * sv;
  }
  pobj[0] = DEGTORAD * sl;
  pobj[1] = DEGTORAD * sb;
  pobj[2] = DEGTORAD * planets[iplm].distance * sr + planets[iplm].distance;
  return OK;
}

export function swi_moshplan(tjd: number, ipli: number, do_save: boolean, xpret: number[], xeret: number[], serr: string) {
  let i;
  let do_earth = false;
  let dx = [0, 0, 0];
  let x2 = [0, 0, 0];
  let xxe = [0, 0, 0, 0, 0, 0];
  let xxp = [0, 0, 0, 0, 0, 0];
  let xp, xe;
  let dt;
  let s = '';
  let iplm = pnoint2msh[ipli];
  let pdp = swed.pldat[ipli];
  let pedp = swed.pldat[SEI_EARTH];
  let seps2000 = swed.oec2000.seps;
  let ceps2000 = swed.oec2000.ceps;
  if (do_save) {
    xp = pdp.x;
    xe = pedp.x;
  } else {
    xp = xxp;
    xe = xxe;
  }
  if (do_save || ipli === SEI_EARTH || xeret !== null) do_earth = true;
  if (tjd < MOSHPLEPH_START - 0.3 || tjd > MOSHPLEPH_END + 0.3) {
    if (serr !== null) {
      s = `jd ${tjd} outside Moshier planet range ${MOSHPLEPH_START} .. ${MOSHPLEPH_END} `;
      if (serr.length + s.length < AS_MAXCH) serr += s;
    }
    return ERR;
  }
  if (do_earth) {
    if (tjd === pedp.teval && pedp.iephe === SEFLG_MOSEPH) {
      xe = pedp.x;
    } else {
      swi_moshplan2(tjd, pnoint2msh[SEI_EMB], xe);
      swi_polcart(xe, xe);
      swi_coortrf2(xe, xe, -seps2000, ceps2000);
      embofs_mosh(tjd, xe);
      if (do_save) {
        pedp.teval = tjd;
        pedp.xflgs = -1;
        pedp.iephe = SEFLG_MOSEPH;
      }
      swi_moshplan2(tjd - PLAN_SPEED_INTV, pnoint2msh[SEI_EMB], x2);
      swi_polcart(x2, x2);
      swi_coortrf2(x2, x2, -seps2000, ceps2000);
      embofs_mosh(tjd - PLAN_SPEED_INTV, x2);
      for (i = 0; i <= 2; i++) dx[i] = (xe[i] - x2[i]) / PLAN_SPEED_INTV;
      for (i = 0; i <= 2; i++) xe[i + 3] = dx[i];
    }
    if (xeret !== null) for (i = 0; i <= 5; i++) xeret[i] = xe[i];
  }
  if (ipli === SEI_EARTH) {
    xp = xe;
  } else {
    if (tjd === pdp.teval && pdp.iephe === SEFLG_MOSEPH) {
      xp = pdp.x;
    } else {
      swi_moshplan2(tjd, iplm, xp);
      swi_polcart(xp, xp);
      swi_coortrf2(xp, xp, -seps2000, ceps2000);
      if (do_save) {
        pdp.teval = tjd;
        pdp.xflgs = -1;
        pdp.iephe = SEFLG_MOSEPH;
      }
      dt = PLAN_SPEED_INTV;
      swi_moshplan2(tjd - dt, iplm, x2);
      swi_polcart(x2, x2);
      swi_coortrf2(x2, x2, -seps2000, ceps2000);
      for (i = 0; i <= 2; i++) dx[i] = (xp[i] - x2[i]) / dt;
      for (i = 0; i <= 2; i++) xp[i + 3] = dx[i];
    }
    if (xpret !== null) for (i = 0; i <= 5; i++) xpret[i] = xp[i];
  }
  return OK;
}

function embofs_mosh(tjd: number, xemb: number[]) {
  let T = (tjd - J1900) / 36525.0;
  let a = swe_degnorm(((1.44e-5 * T + 0.009192) * T + 477198.8491) * T + 296.104608) * DEGTORAD;
  let smp = Math.sin(a);
  let cmp = Math.cos(a);
  let s2mp = 2.0 * smp * cmp;
  let c2mp = cmp * cmp - smp * smp;
  a = swe_degnorm(((1.9e-6 * T - 0.001436) * T + 445267.1142) * T + 350.737486) * 2.0 * DEGTORAD;
  let s2d = Math.sin(a);
  let c2d = Math.cos(a);
  a = swe_degnorm(((-3.e-7 * T - 0.003211) * T + 483202.0251) * T + 11.250889) * DEGTORAD;
  let sf = Math.sin(a);
  let cf = Math.cos(a);
  let s2f = 2.0 * sf * cf;
  let sx = s2d * cmp - c2d * smp;
  let cx = c2d * cmp + s2d * smp;
  let L = ((1.9e-6 * T - 0.001133) * T + 481267.8831) * T + 270.434164;
  let M = swe_degnorm(((-3.3e-6 * T - 1.50e-4) * T + 35999.0498) * T + 358.475833);
  L = L + 6.288750 * smp + 1.274018 * sx + 0.658309 * s2d + 0.213616 * s2mp - 0.185596 * Math.sin(DEGTORAD * M) - 0.114336 * s2f;
  a = smp * cf;
  sx = cmp * sf;
  let B = 5.128189 * sf + 0.280606 * (a + sx) + 0.277693 * (a - sx) + 0.173238 * (s2d * cf - c2d * sf);
  B *= DEGTORAD;
  let p = 0.950724 + 0.051818 * cmp + 0.009531 * cx + 0.007843 * c2d + 0.002824 * c2mp;
  p *= DEGTORAD;
  L = swe_degnorm(L) * DEGTORAD;
  a = 4.263523e-5 / Math.sin(p);
  let xyz = [L, B, a];
  swi_polcart(xyz, xyz);
  swi_coortrf2(xyz, xyz, -swed.oec.seps, swed.oec.ceps);
  swi_precess(xyz, tjd, 0, J_TO_J2000);
  for (let i = 0; i <= 2; i++) xemb[i] -= xyz[i] / (EARTH_MOON_MRAT + 1.0);
}

const plan_fict_nam = [
  "Cupido", "Hades", "Zeus", "Kronos",
  "Apollon", "Admetos", "Vulkanus", "Poseidon",
  "Isis-Transpluto", "Nibiru", "Harrington",
  "Leverrier", "Adams",
  "Lowell", "Pickering",
];

export function swi_get_fict_name(ipl: number, snam: string) {
  if (read_elements_file(ipl, 0, null, null, null, null, null, null, null, null, snam, null, null) === ERR) {
    snam = "name not found";
  }
  return snam;
}

const plan_oscu_elem = [
  [J1900, J1900, 163.7409, 40.99837, 0.00460, 171.4333, 129.8325, 1.0833],
  [J1900, J1900, 27.6496, 50.66744, 0.00245, 148.1796, 161.3339, 1.0500],
  [J1900, J1900, 165.1232, 59.21436, 0.00120, 299.0440, 0.0000, 0.0000],
  [J1900, J1900, 169.0193, 64.81960, 0.00305, 208.8801, 0.0000, 0.0000],
  [J1900, J1900, 138.0533, 70.29949, 0.00000, 0.0000, 0.0000, 0.0000],
  [J1900, J1900, 351.3350, 73.62765, 0.00000, 0.0000, 0.0000, 0.0000],
  [J1900, J1900, 55.8983, 77.25568, 0.00000, 0.0000, 0.0000, 0.0000],
  [J1900, J1900, 165.5163, 83.66907, 0.00000, 0.0000, 0.0000, 0.0000],
  [2368547.66, 2431456.5, 0.0, 77.775, 0.3, 0.7, 0, 0],
  [1856113.380954, 1856113.380954, 0.0, 234.8921, 0.981092, 103.966, -44.567, 158.708],
  [2374696.5, J2000, 0.0, 101.2, 0.411, 208.5, 275.4, 32.4],
  [2395662.5, 2395662.5, 34.05, 36.15, 0.10761, 284.75, 0, 0],
  [2395662.5, 2395662.5, 24.28, 37.25, 0.12062, 299.11, 0, 0],
  [2425977.5, 2425977.5, 281, 43.0, 0.202, 204.9, 0, 0],
  [2425977.5, 2425977.5, 48.95, 55.1, 0.31, 280.1, 100, 15],
];

export function swi_osc_el_plan(tjd: number, xp: number[], ipl: number, ipli: number, xearth: number[], xsun: number[], serr: string) {
  let pqr = Array(9).fill(0);
  let x = Array(6).fill(0);
  let eps, K, fac, rho, cose, sine;
  let alpha, beta, zeta, sigma, M2, Msgn, M_180_or_0;
  let tjd0, tequ, mano, sema, ecce, parg, node, incl, dmot;
  let cosnode, sinnode, cosincl, sinincl, cosparg, sinparg;
  let M, E;
  let pedp = swed.pldat[SEI_EARTH];
  let pdp = swed.pldat[ipli];
  let fict_ifl = 0;
  let i;
  if (read_elements_file(ipl, tjd, tjd0, tequ, mano, sema, ecce, parg, node, incl, null, fict_ifl, serr) === ERR) return ERR;
  dmot = 0.9856076686 * DEGTORAD / sema / Math.sqrt(sema);
  if (fict_ifl & FICT_GEO) dmot /= Math.sqrt(SUN_EARTH_MRAT);
  cosnode = Math.cos(node);
  sinnode = Math.sin(node);
  cosincl = Math.cos(incl);
  sinincl = Math.sin(incl);
  cosparg = Math.cos(parg);
  sinparg = Math.sin(parg);
  pqr[0] = cosparg * cosnode - sinparg * cosincl * sinnode;
  pqr[1] = -sinparg * cosnode - cosparg * cosincl * sinnode;
  pqr[2] = sinincl * sinnode;
  pqr[3] = cosparg * sinnode + sinparg * cosincl * cosnode;
  pqr[4] = -sinparg * sinnode + cosparg * cosincl * cosnode;
  pqr[5] = -sinincl * cosnode;
  pqr[6] = sinparg * sinincl;
  pqr[7] = cosparg * sinincl;
  pqr[8] = cosincl;
  E = M = swe_mod2PI(mano + (tjd - tjd0) * dmot);
  if (ecce > 0.975) {
    M2 = M * RADTODEG;
    if (M2 > 150 && M2 < 210) {
      M2 -= 180;
      M_180_or_0 = 180;
    } else M_180_or_0 = 0;
    if (M2 > 330) M2 -= 360;
    if (M2 < 0) {
      M2 = -M2;
      Msgn = -1;
    } else Msgn = 1;
    if (M2 < 30) {
      M2 *= DEGTORAD;
      alpha = (1 - ecce) / (4 * ecce + 0.5);
      beta = M2 / (8 * ecce + 1);
      zeta = Math.pow(beta + Math.sqrt(beta * beta + alpha * alpha), 1 / 3);
      sigma = zeta - alpha / 2;
      sigma = sigma - 0.078 * sigma * sigma * sigma * sigma * sigma / (1 + ecce);
      E = Msgn * (M2 + ecce * (3 * sigma - 4 * sigma * sigma * sigma)) + M_180_or_0;
    }
  }
  E = swe_kepler(E, M, ecce);
  if (fict_ifl & FICT_GEO) K = KGAUSS_GEO / Math.sqrt(sema);
  else K = KGAUSS / Math.sqrt(sema);
  cose = Math.cos(E);
  sine = Math.sin(E);
  fac = Math.sqrt((1 - ecce) * (1 + ecce));
  rho = 1 - ecce * cose;
  x[0] = sema * (cose - ecce);
  x[1] = sema * fac * sine;
  x[3] = -K * sine / rho;
  x[4] = K * fac * cose / rho;
  xp[0] = pqr[0] * x[0] + pqr[1] * x[1];
  xp[1] = pqr[3] * x[0] + pqr[4] * x[1];
  xp[2] = pqr[6] * x[0] + pqr[7] * x[1];
  xp[3] = pqr[0] * x[3] + pqr[1] * x[4];
  xp[4] = pqr[3] * x[3] + pqr[4] * x[4];
  xp[5] = pqr[6] * x[3] + pqr[7] * x[4];
  eps = swe_epsiln(tequ, 0);
  swe_coortrf(xp, xp, -eps);
  swe_coortrf(xp + 3, xp + 3, -eps);
  if (tequ !== J2000) {
    swe_precess(xp, tequ, 0, J_TO_J2000);
    swe_precess(xp + 3, tequ, 0, J_TO_J2000);
  }
  if (fict_ifl & FICT_GEO) {
    for (i = 0; i <= 5; i++) xp[i] += xearth[i];
  } else {
    for (i = 0; i <= 5; i++) xp[i] += xsun[i];
  }
  if (pdp.x === xp) {
    pdp.teval = tjd;
    pdp.iephe = pedp.iephe;
  }
  return OK;
}

function read_elements_file(ipl: number, tjd: number, tjd0: number, tequ: number, mano: number, sema: number, ecce: number, parg: number, node: number, incl: number, pname: string, fict_ifl: number, serr: string) {
  let i, iline, iplan, retc, ncpos;
  let fp = null;
  let s = '';
  let sp;
  let cpos = [];
  let serri = '';
  let elem_found = false;
  let tt = 0;
  if ((fp = swi_fopen(-1, SE_FICTFILE, swed.ephepath, serr)) === null) {
    if (ipl >= SE_NFICT_ELEM) {
      if (serr !== null) serr = `error no elements for fictitious body no ${ipl}`;
      return ERR;
    }
    if (tjd0 !== null) tjd0 = plan_oscu_elem[ipl][0];
    if (tequ !== null) tequ = plan_oscu_elem[ipl][1];
    if (mano !== null) mano = plan_oscu_elem[ipl][2] * DEGTORAD;
    if (sema !== null) sema = plan_oscu_elem[ipl][3];
    if (ecce !== null) ecce = plan_oscu_elem[ipl][4];
    if (parg !== null) parg = plan_oscu_elem[ipl][5] * DEGTORAD;
    if (node !== null) node = plan_oscu_elem[ipl][6] * DEGTORAD;
    if (incl !== null) incl = plan_oscu_elem[ipl][7] * DEGTORAD;
    if (pname !== null) pname = plan_fict_nam[ipl];
    return OK;
  }
  iline = 0;
  iplan = -1;
  while ((s = fp.readLine()) !== null) {
    iline++;
    sp = s.trim();
    if (sp.startsWith('#') || sp === '') continue;
    if ((sp = sp.split('#')[0]) !== null) sp = sp.trim();
    cpos = sp.split(',');
    serri = `error in file ${SE_FICTFILE}, line ${iline}:`;
    if (cpos.length < 9) {
      if (serr !== null) serr = `${serri} nine elements required`;
      return ERR;
    }
    iplan++;
    if (iplan !== ipl) continue;
    elem_found = true;
    if (tjd0 !== null) {
      sp = cpos[0].toLowerCase();
      if (sp.startsWith('j2000')) tjd0 = J2000;
      else if (sp.startsWith('b1950')) tjd0 = B1950;
      else if (sp.startsWith('j1900')) tjd0 = J1900;
      else if (sp.startsWith('j') || sp.startsWith('b')) {
        if (serr !== null) serr = `${serri} invalid epoch`;
        return ERR;
      } else tjd0 = parseFloat(sp);
      tt = tjd - tjd0;
    }
    if (tequ !== null) {
      sp = cpos[1].trim().toLowerCase();
      if (sp.startsWith('j2000')) tequ = J2000;
      else if (sp.startsWith('b1950')) tequ = B1950;
      else if (sp.startsWith('j1900')) tequ = J1900;
      else if (sp.startsWith('jdate')) tequ = tjd;
      else if (sp.startsWith('j') || sp.startsWith('b')) {
        if (serr !== null) serr = `${serri} invalid equinox`;
        return ERR;
      } else tequ = parseFloat(sp);
    }
    if (mano !== null) {
      retc = check_t_terms(tt, cpos[2], mano);
      mano = swe_degnorm(mano);
      if (retc === ERR) {
        if (serr !== null) serr = `${serri} mean anomaly value invalid`;
        return ERR;
      }
      if (retc === 1) tjd0 = tjd;
      mano *= DEGTORAD;
    }
    if (sema !== null) {
      retc = check_t_terms(tt, cpos[3], sema);
      if (sema <= 0 || retc === ERR) {
        if (serr !== null) serr = `${serri} semi-axis value invalid`;
        return ERR;
      }
    }
    if (ecce !== null) {
      retc = check_t_terms(tt, cpos[4], ecce);
      if (ecce >= 1 || ecce < 0 || retc === ERR) {
        if (serr !== null) serr = `${serri} eccentricity invalid (no parabolic or hyperbolic orbits allowed)`;
        return ERR;
      }
    }
    if (parg !== null) {
      retc = check_t_terms(tt, cpos[5], parg);
      parg = swe_degnorm(parg);
      if (retc === ERR) {
        if (serr !== null) serr = `${serri} perihelion argument value invalid`;
        return ERR;
      }
      parg *= DEGTORAD;
    }
    if (node !== null) {
      retc = check_t_terms(tt, cpos[6], node);
      node = swe_degnorm(node);
      if (retc === ERR) {
        if (serr !== null) serr = `${serri} node value invalid`;
        return ERR;
      }
      node *= DEGTORAD;
    }
    if (incl !== null) {
      retc = check_t_terms(tt, cpos[7], incl);
      incl = swe_degnorm(incl);
      if (retc === ERR) {
        if (serr !== null) serr = `${serri} inclination value invalid`;
        return ERR;
      }
      incl *= DEGTORAD;
    }
    if (pname !== null) {
      sp = cpos[8].trim();
      pname = sp;
    }
    if (fict_ifl !== null && cpos.length > 9) {
      sp = cpos[9].toLowerCase();
      if (sp.includes('geo')) fict_ifl |= FICT_GEO;
    }
    break;
  }
  if (!elem_found) {
    if (serr !== null) serr = `${serri} elements for planet ${ipl} not found`;
    return ERR;
  }
  fp.close();
  return OK;
}

function check_t_terms(t: number, sinp: string, doutp: number) {
  let i, isgn = 1, z;
  let retc = 0;
  let sp;
  let tt = [t / 36525, t / 36525, t / 36525 * t / 36525, t / 36525 * t / 36525 * t / 36525, t / 36525 * t / 36525 * t / 36525 * t / 36525];
  if ((sp = sinp.match(/[+-]/)) !== null) retc = 1;
  sp = sinp;
  doutp = 0;
  let fac = 1;
  z = 0;
  while (true) {
    while (sp !== '' && sp.match(/[ \t]/)) sp = sp.slice(1);
    if (sp.match(/[+-]/) || sp === '') {
      if (z > 0) doutp += fac;
      isgn = 1;
      if (sp.startsWith('-')) isgn = -1;
      fac = 1 * isgn;
      if (sp === '') return retc;
      sp = sp.slice(1);
    } else {
      while (sp !== '' && sp.match(/[* \t]/)) sp = sp.slice(1);
      if (sp !== '' && sp.match(/[tT]/)) {
        sp = sp.slice(1);
        if (sp !== '' && sp.match(/[+-]/)) fac *= tt[0];
        else if ((i = parseInt(sp)) <= 4 && i >= 0) fac *= tt[i];
      } else {
        if (parseFloat(sp) !== 0 || sp.startsWith('0')) fac *= parseFloat(sp);
      }
      while (sp !== '' && sp.match(/[0123456789.]/)) sp = sp.slice(1);
    }
    z++;
  }
  return retc;
}
