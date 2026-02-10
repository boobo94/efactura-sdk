/**
 * Converts a Romanian county / Bucharest / sectors to the codes required by RO e-Factura validations.
 *
 * - For BT-54 / BT-39 (CountrySubentity): returns ISO 3166-2:RO codes (RO-AB, RO-B, RO-IF, etc.)
 * - For BT-37 (CityName) when subdivision is RO-B: returns SECTOR-RO codes (SECTOR1..SECTOR6)
 *
 * Notes:
 * - Handles diacritics, casing, common prefixes: "Judetul", "Mun.", "Municipiul", "Sectorul", etc.
 * - If it cannot match, returns null (so you can decide to throw or keep original).
 */

import { DEFAULT_COUNTRY } from '../constants';
import { ISO_3166_2_COUNTRY_CODES } from './countries-list';

type SectorNumber = 1 | 2 | 3 | 4 | 5 | 6;

export function sanitizeCounty(input: string | null | undefined): string | null {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return null;
  }

  // Direct match
  const direct = RO_ISO_3166_2_RO_MAP.get(normalized);
  if (direct) {
    return direct;
  }

  // Fallback: strip admin words and try again (e.g., "judetul cluj" -> "cluj")
  const stripped = stripAdministrativeWords(normalized);
  if (stripped && stripped !== normalized) {
    const fallback = RO_ISO_3166_2_RO_MAP.get(stripped);
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

export function sanitizeBucharestSector(cityInput: string | null): string | null {
  const normalized = normalizeInput(cityInput);
  if (!normalized) {
    return null;
  }

  const sector = extractSectorNumber(normalized);
  return sector ? `SECTOR${sector}` : null;
}

/**
 * Checks if the subdivision code represents Bucharest (RO-B)
 *
 * @param countyCode
 * @returns
 */
export function isBucharest(countyCode: string | null | undefined): boolean {
  return typeof countyCode === 'string' && countyCode.trim().toUpperCase() === 'RO-B';
}

/* ----------------------- internals ----------------------- */

/**
 * Normalizes a Romanian location string for consistent processing.
 *
 * @param input
 * @returns
 */
function normalizeInput(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  const s = input.trim();
  if (!s) return null;

  return (
    s
      .toLowerCase()
      // Normalize diacritics (ș/ş, ț/ţ) and remove accents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ş/g, 's')
      .replace(/ţ/g, 't')
      // unify separators
      .replace(/[._,-]+/g, ' ')
      .replace(/\s+/g, ' ')
      // common expansions/abbreviations
      .replace(/\bmun\b/g, 'municipiul')
      .replace(/\bjude?t(ul)?\b/g, 'judetul')
      .replace(/\bsect(or(ul)?)?\b/g, 'sectorul')
      .trim()
  );
}

/**
 * Removes common administrative words from Romanian location strings
 *
 * @param s
 * @returns
 */
function stripAdministrativeWords(s: string): string {
  return s
    .replace(/\bjudetul\b/g, '')
    .replace(/\bmunicipiul\b/g, '')
    .replace(/\bcomuna\b/g, '')
    .replace(/\boras(ul)?\b/g, '')
    .replace(/\bsectorul\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts sector number from normalized city/sector string
 *
 * Normalized is already lowercase + diacritics removed + "sect" expanded to "sectorul"
 * Accepts:
 * - "sector 3", "sectorul 3", "sector 03", "sectorul03"
 * - "sector-3", "sector. 3", "sector: 3"
 * - "s3", "s 3", "s03"
 * - anywhere in the string: "sector 3 mun. bucuresti", "mun bucuresti sector 3", etc.
 *
 * @param normalized
 * @returns
 */
function extractSectorNumber(normalized: string): SectorNumber | null {
  const m = normalized.match(/\b(?:sectorul|sector|s)\s*[:.-]?\s*0?([1-6])\b/);

  if (!m) return null;

  const n = Number(m[1]);
  return n >= 1 && n <= 6 ? (n as SectorNumber) : null;
}

/**
 * Keys are normalized forms (normalizeRoOrNull + sometimes stripped words).
 * Values are ISO 3166-2:RO codes used for BT-39 / BT-54.
 *
 * Note: Bucharest is included as RO-B. We rely on stripAdministrativeWords() to handle
 * "municipiul bucuresti" etc., so only the minimal aliases are required here.
 */
const RO_ISO_3166_2_RO_MAP: Map<string, string> = new Map([
  // Bucharest
  ['bucuresti', 'RO-B'],
  ['buc', 'RO-B'], // alias

  // Counties
  ['alba', 'RO-AB'],
  ['arges', 'RO-AG'],
  ['arad', 'RO-AR'],
  ['bacau', 'RO-BC'],
  ['bihor', 'RO-BH'],
  ['bistrita nasaud', 'RO-BN'],
  ['bistrita-nasaud', 'RO-BN'],
  ['botosani', 'RO-BT'],
  ['brasov', 'RO-BV'],
  ['braila', 'RO-BR'],
  ['buzau', 'RO-BZ'],
  ['caras severin', 'RO-CS'],
  ['carasseverin', 'RO-CS'],
  ['caras-severin', 'RO-CS'],
  ['calaras', 'RO-CL'],
  ['cluj', 'RO-CJ'],
  ['constanta', 'RO-CT'],
  ['covasna', 'RO-CV'],
  ['dambovita', 'RO-DB'],
  ['dimbovita', 'RO-DB'],
  ['dolj', 'RO-DJ'],
  ['galati', 'RO-GL'],
  ['giurgiu', 'RO-GR'],
  ['gorj', 'RO-GJ'],
  ['harghita', 'RO-HR'],
  ['hunedoara', 'RO-HD'],
  ['ialomita', 'RO-IL'],
  ['iasi', 'RO-IS'],
  ['ilfov', 'RO-IF'],
  ['maramures', 'RO-MM'],
  ['mehedinti', 'RO-MH'],
  ['mures', 'RO-MS'],
  ['neamt', 'RO-NT'],
  ['olt', 'RO-OT'],
  ['prahova', 'RO-PH'],
  ['satu mare', 'RO-SM'],
  ['satu-mare', 'RO-SM'],
  ['salaj', 'RO-SJ'],
  ['sibiu', 'RO-SB'],
  ['suceava', 'RO-SV'],
  ['teleorman', 'RO-TR'],
  ['timis', 'RO-TM'],
  ['tulcea', 'RO-TL'],
  ['valcea', 'RO-VL'],
  ['vilcea', 'RO-VL'], // common typo after diacritics removal
  ['vaslui', 'RO-VS'],
  ['vrancea', 'RO-VN'],
]);

/**
 * Get country code by country name
 * - Accepts country names with or without diacritics, in any case, with common separators (space, dash, dot, underscore).
 * - If input is already a valid ISO 3166-2 alpha-2 code, it will be returned as is.
 * - Uses the same normalization as for counties, so "romania", "românia", "romania", "ro-mania" will all match to "RO".
 * - For unrecognized inputs, returns null (so you can decide to throw or keep original).
 */
export function getCountryCodeByInput(input: string): string | null {
  const normalizedInput = normalizeInput(input);
  if (!normalizedInput) {
    return null;
  }

  const upperInput = input.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upperInput)) {
    const byAlpha2 = ISO_3166_2_COUNTRY_CODES.find((country) => country.alpha2 === upperInput);
    if (byAlpha2) {
      return byAlpha2.alpha2;
    }
  }

  const country = ISO_3166_2_COUNTRY_CODES.find((country) => normalizeInput(country.name) === normalizedInput);
  if (country) {
    return country.alpha2;
  }

  return null;
}

/**
 * Checks if the invoice is internal (Romanian) based on the country name.
 *
 * Uses the same normalization as for counties, so "romania", "românia", "romania", "ro-mania" will all be recognized as internal.
 */
export function isInternalInvoice(countryName: string): boolean {
  return normalizeInput(countryName) === normalizeInput(DEFAULT_COUNTRY);
}

/**
 * Gets the country from a tax ID if it starts with a valid ISO 3166-2 alpha-2 code.
 *
 * For example, "RO12345678" will return "Romania", "DE987654321" will return "Germany".
 *
 * @param taxId
 * @returns
 */
export function getCountryFromTaxId(taxId: string): string | null {
  const countryCode = taxId.trim().substring(0, 2).toUpperCase();
  const country = ISO_3166_2_COUNTRY_CODES.find((country) => country.alpha2 === countryCode);
  if (country) {
    return country.name;
  }

  return null;
}
