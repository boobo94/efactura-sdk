import { isValidCNP, stripTaxIdPrefix, normalizeVatNumber } from '../src/utils/validators';

describe('Validators Utilities', () => {
  describe('CNP validation', () => {
    it('returns true for a valid CNP', () => {
      // Example of a valid CNP with a correct control digit
      // 1960129460018 is commonly used as a valid test CNP
      expect(isValidCNP('1960129460018')).toBe(true);
    });

    it('returns true for CNP with 13 zeros', () => {
      expect(isValidCNP('0000000000000')).toBe(true);
    });

    it('returns false if the CNP does not have exactly 13 digits', () => {
      expect(isValidCNP('123')).toBe(false);
      expect(isValidCNP('123456789012')).toBe(false); // 12 digits
      expect(isValidCNP('12345678901234')).toBe(false); // 14 digits
    });

    it('returns false if the CNP contains non-numeric characters', () => {
      expect(isValidCNP('19605234234a7')).toBe(false);
      expect(isValidCNP('19605-3423457')).toBe(false);
    });

    it('returns false if the control digit is incorrect', () => {
      // Same as a valid CNP but with the last digit altered
      expect(isValidCNP('1960523423456')).toBe(false);
    });

    it('returns false if the first digit (sex) is invalid', () => {
      // First digit 0 is invalid
      expect(isValidCNP('0960523423457')).toBe(false);
    });

    it('returns false for an otherwise well-formed CNP with an invalid control digit and valid sex digit', () => {
      // Valid format and sex digit, but invalid control digit
      expect(isValidCNP('1980101223459')).toBe(false);
    });

    it('returns true when checksum remainder is 10 and control digit is 1', () => {
      expect(isValidCNP('1000000000071')).toBe(true);
    });
  });

  describe('Stripping Tax ID', () => {
    it('stripTaxIdPrefix removes leading RO (uppercase) and ro (lowercase)', () => {
      expect(stripTaxIdPrefix('RO12345678')).toBe('12345678');
      expect(stripTaxIdPrefix('ro12345')).toBe('12345');
    });

    it('stripTaxIdPrefix only replaces first occurrence', () => {
      expect(stripTaxIdPrefix('RORO123')).toBe('RO123');
    });

    it('stripTaxIdPrefix throws when value is empty', () => {
      expect(() => stripTaxIdPrefix('')).toThrow('Company VAT number is missing.');
      expect(() => stripTaxIdPrefix(null as any)).toThrow('Company VAT number is missing.');
    });
  });

  describe('VAT Number normalization', () => {
    it('normalizes valid CIF values to RO-prefixed format', () => {
      expect(normalizeVatNumber('1000009')).toBe('RO1000009');
      expect(normalizeVatNumber('RO1000009')).toBe('RO1000009');
      expect(normalizeVatNumber('ro1000009')).toBe('RO1000009');
    });

    it('keeps invalid CIF values unchanged', () => {
      expect(normalizeVatNumber('12345678')).toBe('12345678');
      expect(normalizeVatNumber('12345678901')).toBe('12345678901');
      expect(normalizeVatNumber('RO12A34')).toBe('RO12A34');
    });

    it('handles CIF modulo-11 remainder 10 branch', () => {
      expect(normalizeVatNumber('60')).toBe('RO60');
      expect(normalizeVatNumber('RO60')).toBe('RO60');
    });

    it('normalizeVatNumber ignores CNP', () => {
      expect(normalizeVatNumber('0000000000000')).toBe('0000000000000');
      expect(normalizeVatNumber('1960129460018')).toBe('1960129460018');
    });

    it('normalizeVatNumber throws when value is empty', () => {
      expect(() => normalizeVatNumber('')).toThrow('Company VAT number is missing.');
      expect(() => normalizeVatNumber(null as any)).toThrow('Company VAT number is missing.');
    });
  });
});
