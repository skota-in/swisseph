/* 
 |
 | Subroutines for reading JPL ephemerides.
 | derived from testeph.f as contained in DE403 distribution July 1995.
 | works with DE200, DE102, DE403, DE404, DE405, DE406, DE431
 | (attention, these ephemerides do not have exactly the same reference frame)

  Authors: Dieter Koch and Alois Treindl, Astrodienst Zurich

************************************************************/
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

import { readFileSync, openSync, closeSync, readSync, fstatSync, fseekSync, ftellSync } from 'fs';
import { join } from 'path';

const DEBUG_DO_SHOW = false;

interface JplSave {
  jplfname: string;
  jplfpath: string;
  jplfptr: number | null;
  do_reorder: boolean;
  eh_cval: number[];
  eh_ss: number[];
  eh_au: number;
  eh_emrat: number;
  eh_denum: number;
  eh_ncon: number;
  eh_ipt: number[];
  ch_cnam: string;
  pv: number[];
  pvsun: number[];
  buf: number[];
  pc: number[];
  vc: number[];
  ac: number[];
  jc: number[];
  do_km: boolean;
}

let js: JplSave | null = null;

function state(et: number, list: number[], do_bary: boolean, pv: number[], pvsun: number[], nut: number[], serr: string | null): number {
  let i, j, k;
  let nseg: number;
  let flen: number, nb: number;
  const buf = js!.buf;
  let aufac, s, t, intv, ts: number[] = [];
  let nrecl, ksize;
  let nr: number;
  let et_mn, et_fr;
  const ipt = js!.eh_ipt;
  const ch_ttl = new Array(252).fill(0);
  let irecsz: number;
  let nrl: number, lpt: number[] = [], ncoeffs: number;
  let nrd: number;

  if (js!.jplfptr === null) {
    ksize = fsizer(serr);
    nrecl = 4;
    if (ksize === NOT_AVAILABLE) return NOT_AVAILABLE;
    irecsz = nrecl * ksize;
    ncoeffs = ksize / 2;

    nrd = readSync(js!.jplfptr!, Buffer.from(ch_ttl), 0, 252, null);
    if (nrd !== 252) return NOT_AVAILABLE;

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.ch_cnam), 0, 2400, null);
    if (nrd !== 2400) return NOT_AVAILABLE;

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_ss), 0, 3 * 8, null);
    if (nrd !== 3 * 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_ss, 8, 3);

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_ncon), 0, 4, null);
    if (nrd !== 4) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_ncon, 4, 1);

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_au), 0, 8, null);
    if (nrd !== 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_au, 8, 1);

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_emrat), 0, 8, null);
    if (nrd !== 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_emrat, 8, 1);

    nrd = readSync(js!.jplfptr!, Buffer.from(ipt), 0, 36 * 4, null);
    if (nrd !== 36 * 4) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(ipt, 4, 36);

    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_denum), 0, 4, null);
    if (nrd !== 4) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_denum, 4, 1);

    nrd = readSync(js!.jplfptr!, Buffer.from(lpt), 0, 3 * 4, null);
    if (nrd !== 3 * 4) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(lpt, 4, 3);

    fseekSync(js!.jplfptr!, 1 * irecsz, 0);
    nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_cval), 0, 400 * 8, null);
    if (nrd !== 400 * 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(js!.eh_cval, 8, 400);

    for (i = 0; i < 3; ++i) ipt[i + 36] = lpt[i];
    nrl = 0;

    fseekSync(js!.jplfptr!, 0, 2);
    flen = ftellSync(js!.jplfptr!);

    nseg = Math.floor((js!.eh_ss[1] - js!.eh_ss[0]) / js!.eh_ss[2]);

    for (i = 0, nb = 0; i < 13; i++) {
      k = 3;
      if (i === 11) k = 2;
      nb += (ipt[i * 3 + 1] * ipt[i * 3 + 2]) * k * nseg;
    }

    nb += 2 * nseg;
    nb *= 8;
    nb += 2 * ksize * nrecl;

    if (flen !== nb && flen - nb !== ksize * nrecl) {
      if (serr !== null) {
        serr = `JPL ephemeris file is mutilated; length = ${flen} instead of ${nb}.`;
        if (serr.length + js!.jplfname.length < AS_MAXCH - 1) {
          serr = `JPL ephemeris file ${js!.jplfname} is mutilated; length = ${flen} instead of ${nb}.`;
        }
      }
      return NOT_AVAILABLE;
    }

    fseekSync(js!.jplfptr!, 2 * irecsz, 0);
    nrd = readSync(js!.jplfptr!, Buffer.from(ts), 0, 2 * 8, null);
    if (nrd !== 2 * 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(ts, 8, 2);

    fseekSync(js!.jplfptr!, (nseg + 2 - 1) * irecsz, 0);
    nrd = readSync(js!.jplfptr!, Buffer.from(ts), 2 * 8, 2 * 8, null);
    if (nrd !== 2 * 8) return NOT_AVAILABLE;
    if (js!.do_reorder) reorder(ts, 8, 2);

    if (ts[0] !== js!.eh_ss[0] || ts[3] !== js!.eh_ss[1]) {
      if (serr !== null) {
        serr = `JPL ephemeris file is corrupt; start/end date check failed. ${ts[0]} != ${js!.eh_ss[0]} || ${ts[3]} != ${js!.eh_ss[1]}`;
      }
      return NOT_AVAILABLE;
    }
  }

  if (list === null) return 0;

  s = et - 0.5;
  et_mn = Math.floor(s);
  et_fr = s - et_mn;
  et_mn += 0.5;

  if (et < js!.eh_ss[0] || et > js!.eh_ss[1]) {
    if (serr !== null) {
      serr = `jd ${et} outside JPL eph. range ${js!.eh_ss[0]} .. ${js!.eh_ss[1]};`;
    }
    return BEYOND_EPH_LIMITS;
  }

  nr = Math.floor((et_mn - js!.eh_ss[0]) / js!.eh_ss[2]) + 2;
  if (et_mn === js!.eh_ss[1]) --nr;
  t = (et_mn - ((nr - 2) * js!.eh_ss[2] + js!.eh_ss[0]) + et_fr) / js!.eh_ss[2];

  if (nr !== nrl) {
    nrl = nr;
    if (fseekSync(js!.jplfptr!, nr * irecsz, 0) !== 0) {
      if (serr !== null) {
        serr = `Read error in JPL eph. at ${et}\n`;
      }
      return NOT_AVAILABLE;
    }
    for (k = 1; k <= ncoeffs; ++k) {
      if (readSync(js!.jplfptr!, Buffer.from(buf), (k - 1) * 8, 8, null) !== 8) {
        if (serr !== null) {
          serr = `Read error in JPL eph. at ${et}\n`;
        }
        return NOT_AVAILABLE;
      }
      if (js!.do_reorder) reorder(buf, 8, 1);
    }
  }

  if (js!.do_km) {
    intv = js!.eh_ss[2] * 86400;
    aufac = 1;
  } else {
    intv = js!.eh_ss[2];
    aufac = 1 / js!.eh_au;
  }

  interp(buf.slice(ipt[30] - 1), t, intv, ipt[31], 3, ipt[32], 2, pvsun);
  for (i = 0; i < 6; ++i) {
    pvsun[i] *= aufac;
  }

  for (i = 0; i < 10; ++i) {
    if (list[i] > 0) {
      interp(buf.slice(ipt[i * 3] - 1), t, intv, ipt[i * 3 + 1], 3, ipt[i * 3 + 2], list[i], pv.slice(i * 6));
      for (j = 0; j < 6; ++j) {
        if (i < 9 && !do_bary) {
          pv[j + i * 6] = pv[j + i * 6] * aufac - pvsun[j];
        } else {
          pv[j + i * 6] *= aufac;
        }
      }
    }
  }

  if (list[10] > 0 && ipt[34] > 0) {
    interp(buf.slice(ipt[33] - 1), t, intv, ipt[34], 2, ipt[35], list[10], nut);
  }

  if (list[11] > 0 && ipt[37] > 0) {
    interp(buf.slice(ipt[36] - 1), t, intv, ipt[37], 3, ipt[38], list[1], pv.slice(60));
  }

  return OK;
}

function interp(buf: number[], t: number, intv: number, ncfin: number, ncmin: number, nain: number, ifl: number, pv: number[]): void {
  const pc = js!.pc;
  const vc = js!.vc;
  const ac = js!.ac;
  const jc = js!.jc;
  const ncf = ncfin;
  const ncm = ncmin;
  const na = nain;
  let np = 2;
  let nv = 3;
  let nac = 4;
  let njk = 5;
  let twot = 0;
  let temp: number;
  let i: number, j: number, ni: number;
  let tc: number;
  let dt1: number, bma: number;
  let bma2: number, bma3: number;

  if (t >= 0) dt1 = Math.floor(t);
  else dt1 = -Math.floor(-t);
  temp = na * t;
  ni = Math.floor(temp - dt1);
  tc = (temp % 1 + dt1) * 2 - 1;

  if (tc !== pc[1]) {
    np = 2;
    nv = 3;
    nac = 4;
    njk = 5;
    pc[1] = tc;
    twot = tc + tc;
  }

  if (np < ncf) {
    for (i = np; i < ncf; ++i) pc[i] = twot * pc[i - 1] - pc[i - 2];
    np = ncf;
  }

  for (i = 0; i < ncm; ++i) {
    pv[i] = 0;
    for (j = ncf - 1; j >= 0; --j) pv[i] += pc[j] * buf[j + (i + ni * ncm) * ncf];
  }

  if (ifl <= 1) return;

  bma = (na + na) / intv;
  vc[2] = twot + twot;
  if (nv < ncf) {
    for (i = nv; i < ncf; ++i) vc[i] = twot * vc[i - 1] + pc[i - 1] + pc[i - 1] - vc[i - 2];
    nv = ncf;
  }

  for (i = 0; i < ncm; ++i) {
    pv[i + ncm] = 0;
    for (j = ncf - 1; j >= 1; --j) pv[i + ncm] += vc[j] * buf[j + (i + ni * ncm) * ncf];
    pv[i + ncm] *= bma;
  }

  if (ifl === 2) return;

  bma2 = bma * bma;
  ac[3] = pc[1] * 24;
  if (nac < ncf) {
    nac = ncf;
    for (i = nac; i < ncf; ++i) ac[i] = twot * ac[i - 1] + vc[i - 1] * 4 - ac[i - 2];
  }

  for (i = 0; i < ncm; ++i) {
    pv[i + ncm * 2] = 0;
    for (j = ncf - 1; j >= 2; --j) pv[i + ncm * 2] += ac[j] * buf[j + (i + ni * ncm) * ncf];
    pv[i + ncm * 2] *= bma2;
  }

  if (ifl === 3) return;

  bma3 = bma * bma2;
  jc[4] = pc[1] * 192;
  if (njk < ncf) {
    njk = ncf;
    for (i = njk; i < ncf; ++i) jc[i] = twot * jc[i - 1] + ac[i - 1] * 6 - jc[i - 2];
  }

  for (i = 0; i < ncm; ++i) {
    pv[i + ncm * 3] = 0;
    for (j = ncf - 1; j >= 3; --j) pv[i + ncm * 3] += jc[j] * buf[j + (i + ni * ncm) * ncf];
    pv[i + ncm * 3] *= bma3;
  }
}

function reorder(x: number[], size: number, number: number): void {
  let i, j;
  const s = new Array(8).fill(0);
  let sp1 = x;
  let sp2 = s;
  for (i = 0; i < number; i++) {
    for (j = 0; j < size; j++) sp2[j] = sp1[size - j - 1];
    for (j = 0; j < size; j++) sp1[j] = sp2[j];
    sp1 += size;
  }
}

function fsizer(serr: string | null): number {
  let ncon: number;
  let emrat: number;
  let numde: number;
  let au: number, ss: number[] = [];
  let i, kmx, khi, nd: number;
  let ksize: number, lpt: number[] = [];
  let nrd: number;

  if ((js!.jplfptr = openSync(join(js!.jplfpath, js!.jplfname), 'r')) === null) {
    return NOT_AVAILABLE;
  }

  nrd = readSync(js!.jplfptr!, Buffer.from(ss), 0, 3 * 8, null);
  if (nrd !== 3 * 8) return NOT_AVAILABLE;

  if (ss[2] < 1 || ss[2] > 200) js!.do_reorder = true;
  else js!.do_reorder = false;

  for (i = 0; i < 3; i++) js!.eh_ss[i] = ss[i];
  if (js!.do_reorder) reorder(js!.eh_ss, 8, 3);

  if (js!.eh_ss[0] < -5583942 || js!.eh_ss[1] > 9025909 || js!.eh_ss[2] < 1 || js!.eh_ss[2] > 200) {
    if (serr !== null) {
      serr = `alleged ephemeris file has invalid format.`;
      if (serr.length + js!.jplfname.length + 3 < AS_MAXCH) {
        serr = `alleged ephemeris file (${js!.jplfname}) has invalid format.`;
      }
    }
    return NOT_AVAILABLE;
  }

  nrd = readSync(js!.jplfptr!, Buffer.from(ncon), 0, 4, null);
  if (nrd !== 4) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(ncon, 4, 1);

  nrd = readSync(js!.jplfptr!, Buffer.from(au), 0, 8, null);
  if (nrd !== 8) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(au, 8, 1);

  nrd = readSync(js!.jplfptr!, Buffer.from(emrat), 0, 8, null);
  if (nrd !== 8) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(emrat, 8, 1);

  nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_ipt), 0, 36 * 4, null);
  if (nrd !== 36 * 4) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(js!.eh_ipt, 4, 36);

  nrd = readSync(js!.jplfptr!, Buffer.from(numde), 0, 4, null);
  if (nrd !== 4) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(numde, 4, 1);

  nrd = readSync(js!.jplfptr!, Buffer.from(lpt), 0, 3 * 4, null);
  if (nrd !== 3 * 4) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(lpt, 4, 3);

  for (i = 0; i < 3; ++i) js!.eh_ipt[i + 36] = lpt[i];
  fseekSync(js!.jplfptr!, 1 * 4 * 1652, 0);
  nrd = readSync(js!.jplfptr!, Buffer.from(js!.eh_cval), 0, 400 * 8, null);
  if (nrd !== 400 * 8) return NOT_AVAILABLE;
  if (js!.do_reorder) reorder(js!.eh_cval, 8, 400);

  kmx = 0;
  khi = 0;
  for (i = 0; i < 13; i++) {
    if (js!.eh_ipt[i * 3] > kmx) {
      kmx = js!.eh_ipt[i * 3];
      khi = i + 1;
    }
  }
  if (khi === 12) nd = 2;
  else nd = 3;
  ksize = (js!.eh_ipt[khi * 3 - 3] + nd * js!.eh_ipt[khi * 3 - 2] * js!.eh_ipt[khi * 3 - 1] - 1) * 2;

  if (ksize === 1546) ksize = 1652;

  if (ksize < 1000 || ksize > 5000) {
    if (serr !== null) serr = `JPL ephemeris file does not provide valid ksize (${ksize})`;
    return NOT_AVAILABLE;
  }
  return ksize;
}

function swi_pleph(et: number, ntarg: number, ncent: number, rrd: number[], serr: string | null): number {
  let i, retc;
  const list = new Array(12).fill(0);
  const pv = js!.pv;
  const pvsun = js!.pvsun;

  for (i = 0; i < 6; ++i) rrd[i] = 0;
  if (ntarg === ncent) return 0;

  if (ntarg === J_NUT) {
    if (js!.eh_ipt[34] > 0) {
      list[10] = 2;
      return state(et, list, false, pv, pvsun, rrd, serr);
    } else {
      if (serr !== null) serr = `No nutations on the JPL ephemeris file;`;
      return NOT_AVAILABLE;
    }
  }

  if (ntarg === J_LIB) {
    if (js!.eh_ipt[37] > 0) {
      list[11] = 2;
      if ((retc = state(et, list, false, pv, pvsun, rrd, serr)) !== OK) return retc;
      for (i = 0; i < 6; ++i) rrd[i] = pv[i + 60];
      return 0;
    } else {
      if (serr !== null) serr = `No librations on the ephemeris file;`;
      return NOT_AVAILABLE;
    }
  }

  if (ntarg < J_SUN) list[ntarg] = 2;
  if (ntarg === J_MOON) list[J_EARTH] = 2;
  if (ntarg === J_EARTH) list[J_MOON] = 2;
  if (ntarg === J_EMB) list[J_EARTH] = 2;
  if (ncent < J_SUN) list[ncent] = 2;
  if (ncent === J_MOON) list[J_EARTH] = 2;
  if (ncent === J_EARTH) list[J_MOON] = 2;
  if (ncent === J_EMB) list[J_EARTH] = 2;

  if ((retc = state(et, list, true, pv, pvsun, rrd, serr)) !== OK) return retc;

  if (ntarg === J_SUN || ncent === J_SUN) {
    for (i = 0; i < 6; ++i) pv[i + 6 * J_SUN] = pvsun[i];
  }

  if (ntarg === J_SBARY || ncent === J_SBARY) {
    for (i = 0; i < 6; ++i) pv[i + 6 * J_SBARY] = 0;
  }

  if (ntarg === J_EMB || ncent === J_EMB) {
    for (i = 0; i < 6; ++i) pv[i + 6 * J_EMB] = pv[i + 6 * J_EARTH];
  }

  if ((ntarg === J_EARTH && ncent === J_MOON) || (ntarg === J_MOON && ncent === J_EARTH)) {
    for (i = 0; i < 6; ++i) pv[i + 6 * J_EARTH] = 0;
  } else {
    if (list[J_EARTH] === 2) {
      for (i = 0; i < 6; ++i) pv[i + 6 * J_EARTH] -= pv[i + 6 * J_MOON] / (js!.eh_emrat + 1);
    }
    if (list[J_MOON] === 2) {
      for (i = 0; i < 6; ++i) pv[i + 6 * J_MOON] += pv[i + 6 * J_EARTH];
    }
  }

  for (i = 0; i < 6; ++i) rrd[i] = pv[i + ntarg * 6] - pv[i + ncent * 6];
  return OK;
}

function swi_close_jpl_file(): void {
  if (js !== null) {
    if (js.jplfptr !== null) closeSync(js.jplfptr);
    if (js.jplfname !== null) free(js.jplfname);
    if (js.jplfpath !== null) free(js.jplfpath);
    free(js);
    js = null;
  }
}

function swi_open_jpl_file(ss: number[], fname: string, fpath: string, serr: string | null): number {
  let retc = OK;

  if (js !== null && js.jplfptr !== null) return OK;

  if ((js = calloc(1, sizeof(JplSave))) === null || (js.jplfname = malloc(strlen(fname) + 1)) === null || (js.jplfpath = malloc(strlen(fpath) + 1)) === null) {
    if (serr !== null) serr = `error in malloc() with JPL ephemeris.`;
    return ERR;
  }

  strcpy(js.jplfname, fname);
  strcpy(js.jplfpath, fpath);
  retc = read_const_jpl(ss, serr);
  if (retc !== OK) swi_close_jpl_file();
  else {
    js.pc[0] = 1;
    js.pc[1] = 2;
    js.vc[1] = 1;
    js.ac[2] = 4;
    js.jc[3] = 24;
  }
  return retc;
}

function read_const_jpl(ss: number[], serr: string | null): number {
  let i, retc;
  retc = state(0.0, null, false, null, null, null, serr);
  if (retc !== OK) return retc;
  for (i = 0; i < 3; i++) ss[i] = js!.eh_ss[i];

  return OK;
}

function swi_get_jpl_denum(): number {
  return js!.eh_denum;
}

export { swi_pleph, swi_close_jpl_file, swi_open_jpl_file, swi_get_jpl_denum };
