import { isEmpty, isBlank, copyString, trimSpace, trimTrailingSpace, endsWith, equalsWithEscapedNewlines, trimmedEquals, equals } from './globals';

export const ALL = 0;
export const DEFAULT_PRECISION = 1.e-9;

export const SECTION_KEYWORDS = [
  "GENERAL",
  "TESTSUITE",
  "TESTCASE",
  "ITERATION",
  ""
];

export const PARAMETER_SECTIONS = [
  "GENERAL",
  ""
];

export const DEFAULT_TEST_COLLECTION = "test";

export const PREPARE_FIXTURE_COMMAND = "m4 prepare_fix.m4";

export const SEFLG = [
  "SEFLG_JPLEPH",
  "SEFLG_SWIEPH",
  "SEFLG_MOSEPH",
  "SEFLG_HELCTR",
  "SEFLG_TRUEPOS",
  "SEFLG_J2000",
  "SEFLG_NONUT",
  "SEFLG_SPEED3",
  "SEFLG_SPEED",
  "SEFLG_NOGDEFL",
  "SEFLG_NOABERR",
  "SEFLG_EQUATORIAL",
  "SEFLG_XYZ",
  "SEFLG_RADIANS",
  "SEFLG_BARYCTR",
  "SEFLG_TOPOCTR",
  "SEFLG_SIDEREAL",
  "SEFLG_ICRS",
  "SEFLG_JPLHOR",
  "SEFLG_JPLHOR_APPROX",
  "SEFLG_CENTER_BODY",
  ""
];

export const HELPFILE = "setest.help";

export function equals(act: string, exp: string): boolean {
  return act === exp;
}

export function trimmedEquals(string: string, sub: string): boolean {
  const p = string.indexOf(sub);
  if (p !== -1) {
    // Non-whitespace before the substring -> fail
    for (let i = p - 1; i >= 0; i--) {
      if (!/\s/.test(string[i])) return false;
    }
    // Non-whitespace after the substring -> fail
    const end = string.length;
    for (let i = p + sub.length; i < end; i++) {
      if (!/\s/.test(string[i])) return false;
    }
    // -> string equals sub, save leading and trailing whitespace
    return true;
  }
  return false;
}

export function equalsWithEscapedNewlines(exp: string, act: string): boolean {
  // Compare \n in act against "\\n" in exp
  // But ignore leading and trailing whitespace, like in trimmedEquals
  let pe = 0, pa = 0;
  const peEnd = exp.length, paEnd = act.length;
  // Put pa, pe to first non-white character
  while (/\s/.test(act[pa]) && pa < paEnd) pa++;
  while (/\s/.test(exp[pe]) && pe < peEnd) pe++;
  // Put paEnd, peEnd to first trailing white character or \0
  while (paEnd > pa && /\s/.test(act[paEnd - 1])) paEnd--;
  while (peEnd > pe && /\s/.test(exp[peEnd - 1])) peEnd--;
  // Compare non-white characters
  while (pa < paEnd && pe < peEnd) {
    if (act[pa] === '\n' && exp[pe] === '\\' && exp[pe + 1] === 'n') {
      pe++;
    } else if (act[pa] !== exp[pe]) {
      return false;
    }
    pa++;
    pe++;
  }
  // Strings are equal, if they end at the same point
  return pa === paEnd && pe === peEnd;
}

export function endsWith(string: string, sub: string): boolean {
  const len = string.length;
  const subStart = len - sub.length;
  for (let i = len - 1; i >= subStart; i--) {
    if (string[i] !== sub[i - subStart]) return false;
  }
  return true;
}

export function trimTrailingSpace(s: string): string {
  let sp = s.length - 1;
  while (sp >= 0 && /\s/.test(s[sp])) sp--;
  return s.substring(0, sp + 1);
}

export function trimSpace(s: string): string {
  return trimTrailingSpace(s).trimStart();
}

export function copyString(s: string): string {
  return s ? s.slice() : '';
}

export function isEmpty(s: string): boolean {
  return !s || s.length === 0;
}

export function isBlank(s: string): boolean {
  return !s || /^\s*$/.test(s);
}
