/*********************************************************
  
  swe_date_conversion()
  swe_revjul()
  swe_julday()

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

import { swe_julday, swe_revjul, swe_deltat_ex } from 'swisseph';

export function swe_date_conversion(y: number, m: number, d: number, uttime: number, c: string, tjd: number[]): number {
  let rday: number, rmon: number, ryear: number;
  let rut: number, jd: number;
  let gregflag = c === 'g' ? 1 : 0;
  rut = uttime;
  jd = swe_julday(y, m, d, rut, gregflag);
  swe_revjul(jd, gregflag, ryear, rmon, rday, rut);
  tjd[0] = jd;
  return rmon === m && rday === d && ryear === y ? 0 : 1;
}

export function swe_julday(year: number, month: number, day: number, hour: number, gregflag: number): number {
  let jd: number;
  let u = year;
  if (month < 3) u -= 1;
  const u0 = u + 4712.0;
  const u1 = month + 1.0 < 4 ? month + 13.0 : month + 1.0;
  jd = Math.floor(u0 * 365.25) + Math.floor(30.6 * u1 + 0.000001) + day + hour / 24.0 - 63.5;
  if (gregflag === 1) {
    const u2 = Math.floor(Math.abs(u) / 100) - Math.floor(Math.abs(u) / 400);
    jd = jd - (u < 0 ? -u2 : u2) + 2;
    if (u < 0 && u / 100 === Math.floor(u / 100) && u / 400 !== Math.floor(u / 400)) jd -= 1;
  }
  return jd;
}

export function swe_revjul(jd: number, gregflag: number, jyear: number, jmon: number, jday: number, jut: number): void {
  const u0 = jd + 32082.5;
  const u1 = gregflag === 1 ? u0 + Math.floor(u0 / 36525.0) - Math.floor(u0 / 146100.0) - 38.0 : u0;
  const u2 = Math.floor(u1 + 123.0);
  const u3 = Math.floor((u2 - 122.2) / 365.25);
  const u4 = Math.floor((u2 - Math.floor(365.25 * u3)) / 30.6001);
  jmon = u4 - 1.0 > 12 ? u4 - 13 : u4 - 1.0;
  jday = u2 - Math.floor(365.25 * u3) - Math.floor(30.6001 * u4);
  jyear = u3 + Math.floor((u4 - 2.0) / 12.0) - 4800;
  jut = (jd - Math.floor(jd + 0.5) + 0.5) * 24.0;
}

export function swe_utc_time_zone(
  iyear: number, imonth: number, iday: number,
  ihour: number, imin: number, dsec: number,
  d_timezone: number,
  iyear_out: number, imonth_out: number, iday_out: number,
  ihour_out: number, imin_out: number, dsec_out: number
): void {
  let tjd: number, d: number;
  let have_leapsec = false;
  let dhour: number;
  if (dsec >= 60.0) {
    have_leapsec = true;
    dsec -= 1.0;
  }
  dhour = ihour + imin / 60.0 + dsec / 3600.0;
  tjd = swe_julday(iyear, imonth, iday, 0, 1);
  dhour -= d_timezone;
  if (dhour < 0.0) {
    tjd -= 1.0;
    dhour += 24.0;
  }
  if (dhour >= 24.0) {
    tjd += 1.0;
    dhour -= 24.0;
  }
  swe_revjul(tjd + 0.001, 1, iyear_out, imonth_out, iday_out, d);
  ihour_out = Math.floor(dhour);
  d = (dhour - ihour_out) * 60;
  imin_out = Math.floor(d);
  dsec_out = (d - imin_out) * 60;
  if (have_leapsec) dsec_out += 1.0;
}

export function swe_utc_to_jd(
  iyear: number, imonth: number, iday: number,
  ihour: number, imin: number, dsec: number,
  gregflag: number, dret: number[], serr: string
): number {
  let tjd_ut1: number, tjd_et: number, tjd_et_1972: number, dhour: number, d: number;
  let iyear2: number, imonth2: number, iday2: number;
  let i: number, j: number, ndat: number, nleap: number, tabsiz_nleap: number;
  tjd_ut1 = swe_julday(iyear, imonth, iday, 0, gregflag);
  swe_revjul(tjd_ut1, gregflag, iyear2, imonth2, iday2, d);
  if (iyear !== iyear2 || imonth !== imonth2 || iday !== iday2) {
    serr = `invalid date: year = ${iyear}, month = ${imonth}, day = ${iday}`;
    return 1;
  }
  if (ihour < 0 || ihour > 23 || imin < 0 || imin > 59 || dsec < 0 || dsec >= 61 || (dsec >= 60 && (imin < 59 || ihour < 23 || tjd_ut1 < 2441317.5))) {
    serr = `invalid time: ${ihour}:${imin}:${dsec}`;
    return 1;
  }
  dhour = ihour + imin / 60.0 + dsec / 3600.0;
  if (tjd_ut1 < 2441317.5) {
    dret[1] = swe_julday(iyear, imonth, iday, dhour, gregflag);
    dret[0] = dret[1] + swe_deltat_ex(dret[1], -1, null);
    return 0;
  }
  if (gregflag === 0) {
    gregflag = 1;
    swe_revjul(tjd_ut1, gregflag, iyear, imonth, iday, d);
  }
  tabsiz_nleap = init_leapsec();
  nleap = 10;
  ndat = iyear * 10000 + imonth * 100 + iday;
  for (i = 0; i < tabsiz_nleap; i++) {
    if (ndat <= leap_seconds[i]) break;
    nleap++;
  }
  d = swe_deltat_ex(tjd_ut1, -1, null) * 86400.0;
  if (d - nleap - 32.184 >= 1.0) {
    dret[1] = tjd_ut1 + dhour / 24.0;
    dret[0] = dret[1] + swe_deltat_ex(dret[1], -1, null);
    return 0;
  }
  if (dsec >= 60) {
    j = 0;
    for (i = 0; i < tabsiz_nleap; i++) {
      if (ndat === leap_seconds[i]) {
        j = 1;
        break;
      }
    }
    if (j !== 1) {
      serr = `invalid time (no leap second!): ${ihour}:${imin}:${dsec}`;
      return 1;
    }
  }
  d = tjd_ut1 - 2441317.5;
  d += ihour / 24.0 + imin / 1440.0 + dsec / 86400.0;
  tjd_et_1972 = 2441317.5 + (32.184 + 10) / 86400.0;
  tjd_et = tjd_et_1972 + d + (nleap - 10) / 86400.0;
  d = swe_deltat_ex(tjd_et, -1, null);
  tjd_ut1 = tjd_et - swe_deltat_ex(tjd_et - d, -1, null);
  tjd_ut1 = tjd_et - swe_deltat_ex(tjd_ut1, -1, null);
  dret[0] = tjd_et;
  dret[1] = tjd_ut1;
  return 0;
}

export function swe_jdet_to_utc(tjd_et: number, gregflag: number, iyear: number, imonth: number, iday: number, ihour: number, imin: number, dsec: number): void {
  let i: number;
  let second_60 = 0;
  let iyear2: number, imonth2: number, iday2: number, nleap: number, ndat: number, tabsiz_nleap: number;
  let d: number, tjd: number, tjd_et_1972: number, tjd_ut: number, dret: number[] = [];
  tjd_et_1972 = 2441317.5 + (32.184 + 10) / 86400.0;
  d = swe_deltat_ex(tjd_et, -1, null);
  tjd_ut = tjd_et - swe_deltat_ex(tjd_et - d, -1, null);
  tjd_ut = tjd_et - swe_deltat_ex(tjd_ut, -1, null);
  if (tjd_et < tjd_et_1972) {
    swe_revjul(tjd_ut, gregflag, iyear, imonth, iday, d);
    ihour = Math.floor(d);
    d -= ihour;
    d *= 60;
    imin = Math.floor(d);
    dsec = (d - imin) * 60.0;
    return;
  }
  tabsiz_nleap = init_leapsec();
  swe_revjul(tjd_ut - 1, 1, iyear2, imonth2, iday2, d);
  ndat = iyear2 * 10000 + imonth2 * 100 + iday2;
  nleap = 0;
  for (i = 0; i < tabsiz_nleap; i++) {
    if (ndat <= leap_seconds[i]) break;
    nleap++;
  }
  if (nleap < tabsiz_nleap) {
    i = leap_seconds[nleap];
    iyear2 = Math.floor(i / 10000);
    imonth2 = Math.floor((i % 10000) / 100);
    iday2 = i % 100;
    tjd = swe_julday(iyear2, imonth2, iday2, 0, 1);
    swe_revjul(tjd + 1, 1, iyear2, imonth2, iday2, d);
    swe_utc_to_jd(iyear2, imonth2, iday2, 0, 0, 0, 1, dret, null);
    d = tjd_et - dret[0];
    if (d >= 0) {
      nleap++;
    } else if (d < 0 && d > -1.0 / 86400.0) {
      second_60 = 1;
    }
  }
  tjd = 2441317.5 + (tjd_et - tjd_et_1972) - (nleap + second_60) / 86400.0;
  swe_revjul(tjd, 1, iyear, imonth, iday, d);
  ihour = Math.floor(d);
  d -= ihour;
  d *= 60;
  imin = Math.floor(d);
  dsec = (d - imin) * 60.0 + second_60;
  d = swe_deltat_ex(tjd_et, -1, null);
  d = swe_deltat_ex(tjd_et - d, -1, null);
  if (d * 86400.0 - (nleap + 10) - 32.184 >= 1.0) {
    swe_revjul(tjd_et - d, 1, iyear, imonth, iday, d);
    ihour = Math.floor(d);
    d -= ihour;
    d *= 60;
    imin = Math.floor(d);
    dsec = (d - imin) * 60.0;
  }
  if (gregflag === 0) {
    tjd = swe_julday(iyear, imonth, iday, 0, 1);
    swe_revjul(tjd, gregflag, iyear, imonth, iday, d);
  }
}

export function swe_jdut1_to_utc(tjd_ut: number, gregflag: number, iyear: number, imonth: number, iday: number, ihour: number, imin: number, dsec: number): void {
  const tjd_et = tjd_ut + swe_deltat_ex(tjd_ut, -1, null);
  swe_jdet_to_utc(tjd_et, gregflag, iyear, imonth, iday, ihour, imin, dsec);
}
