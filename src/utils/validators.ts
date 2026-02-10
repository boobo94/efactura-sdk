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

/**
 * Validate if the code is a valid CIF (Romanian tax identification number)
 *
 * The algorithm who checks the validity of CIF or CUI
 * 1. Check if the code complies with the CIF code format: maximum length of 10 digits and only numeric characters. Use testing key “753217532” to validate the CIF code.
 * 2. Reverse the order of the CIF code digits and the testing key. Multiply each digit of the reversed CIF code by the corresponding digit of the reversed testing key, excluding the first digit (control digit).
 * 3. Add all the products obtained, multiply the sum by 10, and divide the result by 11. The obtained digit after the MODULO 11 operation is the verification digit. If the remainder is 10, the verification digit is 0.
 * 4. For a valid CIF, the verification digit must match the control digit of the initial CIF code.
 * @returns boolean indicating the CIF is valid
 */
function isValidCIF(code: string): boolean {
  // sanitize cif by removing the RO prefix in case does it exist
  code = stripTaxIdPrefix(code);

  if (isNaN(Number(code))) return false;

  if (code.length > 10) return false;

  const controlDigit = Number(code.slice(-1));

  code = code.slice(0, -1);

  while (code.length != 9) {
    code = '0' + code;
  }

  let sum =
    parseInt(code[0]) * 7 +
    parseInt(code[1]) * 5 +
    parseInt(code[2]) * 3 +
    parseInt(code[3]) * 2 +
    parseInt(code[4]) * 1 +
    parseInt(code[5]) * 7 +
    parseInt(code[6]) * 5 +
    parseInt(code[7]) * 3 +
    parseInt(code[8]) * 2;
  sum = sum * 10;

  let rest = sum % 11;
  if (rest === 10) {
    rest = 0;
  }

  return rest === controlDigit;
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
  } else if (isValidCIF(value)) {
    return `RO${stripTaxIdPrefix(value)}`;
  }

  return value;
}
