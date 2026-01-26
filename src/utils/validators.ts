/**
 * Validate if the code is a valid CNP
 *
 * @param code - The CNP code to validate
 * @returns boolean indicating the CNP is valid
 *
 * ```typescript
 * const isValid = await client.isValidCNP('1234567890');
 * console.log('Valid format:', isValid);
 */
export function isValidCNP(code: string): boolean {
  // CNP should have exactly 13 digits
  if (!/^\d{13}$/.test(code)) {
    return false;
  }

  // ANAF allows 13 of 0 as valid cnp for efactura
  if (code === '0000000000000') {
    return true;
  }

  const controlKey = '279146358279';
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * parseInt(controlKey[i]);
  }

  let remainder = sum % 11;
  let controlDigit = remainder === 10 ? 1 : remainder;

  // CNP invalid (control digit is incorect)
  if (parseInt(code[12]) !== controlDigit) {
    return false;
  }

  const sex = parseInt(code[0]);
  // CNP invalid (first digit is invalid)
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(sex)) {
    return false;
  }

  return true;
}

export function stripTaxIdPrefix(value: string): string {
  if (!value) {
    throw new Error('Company VAT number is missing.');
  }

  return value.replace(/ro/i, '');
}

export function normalizeVatNumber(value: string): string {
  if (!value) {
    throw new Error('Company VAT number is missing.');
  }

  // if the code is cnp return it
  if (isValidCNP(value)) {
    return value;
  }

  return value.startsWith('RO') ? value : `RO${value}`;
}
