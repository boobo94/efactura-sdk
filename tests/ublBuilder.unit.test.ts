import { UblBuilder } from '../src/UblBuilder';
import { InvoiceInput } from '../src/types';
import { mockTestData, testFileUtils, testDataGenerators } from './testUtils';
import {
  sanitizeCounty,
  sanitizeBucharestSector,
  isBucharest,
  getCountryCodeByInput,
  isInternalInvoice,
  getCountryFromTaxId,
} from '../src/ubl/address-sanitizer';

describe('UblBuilder Tests', () => {
  let builder: UblBuilder;

  beforeEach(() => {
    builder = new UblBuilder();
  });

  describe('Constructor and Basic Functionality', () => {
    test('should create UblBuilder instance', () => {
      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(UblBuilder);
    });

    test('should have generateInvoiceXml method', () => {
      expect(typeof builder.generateInvoiceXml).toBe('function');
    });
  });

  describe('XML Generation with Valid Data', () => {
    test('should generate valid UBL XML for basic invoice', () => {
      const invoiceData: InvoiceInput = mockTestData.invoiceData;

      const xml = builder.generateInvoiceXml(invoiceData);

      // Check XML structure
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<Invoice');
      expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
      expect(xml).toContain('</Invoice>');

      // Check required fields
      expect(xml).toContain(invoiceData.invoiceNumber);
      expect(xml).toContain(invoiceData.supplier.registrationName);
      expect(xml).toContain(invoiceData.customer.registrationName);
      expect(xml).toContain(invoiceData.supplier.companyId);
    });

    test('should include invoice metadata', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        invoiceNumber: 'INV-2024-001',
        issueDate: new Date('2024-01-15'),
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('<cbc:ID>INV-2024-001</cbc:ID>');
      expect(xml).toContain('<cbc:IssueDate>2024-01-15</cbc:IssueDate>');
      expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    });

    test('should handle supplier information correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        supplier: {
          registrationName: 'Test Company SRL',
          companyId: 'RO12345678',
          isVatPayer: true,
          address: {
            street: 'Str. Testului 123',
            city: 'Bucharest',
            postalZone: '010203',
            country: 'Romania',
          },
        },
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Test Company SRL');
      expect(xml).toContain('RO12345678');
      expect(xml).toContain('Str. Testului 123');
      expect(xml).toContain('Bucharest');
      expect(xml).toContain('010203');
    });

    test('should handle customer information correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        customer: {
          registrationName: 'Customer Company SRL',
          companyId: 'RO87654321',
          address: {
            street: 'Str. Customer 456',
            city: 'Cluj-Napoca',
            postalZone: '400123',
            country: 'Romania',
          },
        },
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Customer Company SRL');
      expect(xml).toContain('RO87654321');
      expect(xml).toContain('Str. Customer 456');
      expect(xml).toContain('Cluj-Napoca');
      expect(xml).toContain('400123');
    });

    test('should handle single invoice line correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Test Product',
            description: 'Test Product Description',
            quantity: 2,
            unitPrice: 150.5,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Test Product');
      expect(xml).toContain('Test Product Description');
      expect(xml).toContain('2'); // quantity
      expect(xml).toContain('150.50'); // unit price
      expect(xml).toContain('19'); // tax percent

      // Check calculated values
      expect(xml).toContain('301.00'); // line total (2 * 150.50)
      expect(xml).toContain('57.19'); // tax amount (301 * 0.19)
      expect(xml).toContain('358.19'); // total with tax
    });

    test('should use provided item name when present', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Short Name',
            description: 'Longer description',
            quantity: 1,
            unitPrice: 10,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('<cbc:Name>Short Name</cbc:Name>');
      expect(xml).toContain('Longer description');
    });

    test('should handle multiple invoice lines correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Product 1',
            description: 'Product 1 Description',
            quantity: 1,
            unitPrice: 100,
            taxPercent: 19,
          },
          {
            name: 'Product 2',
            description: 'Product 2 Description',
            quantity: 2,
            unitPrice: 50,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Product 1');
      expect(xml).toContain('Product 2');

      // Check totals (100 + 100 = 200 base, 38 tax, 238 total)
      expect(xml).toContain('200.00'); // total base
      expect(xml).toContain('38.00'); // total tax
      expect(xml).toContain('238.00'); // total with tax
    });

    test('should handle VAT payer status correctly', () => {
      // Test VAT payer
      const vatPayerData: InvoiceInput = {
        ...mockTestData.invoiceData,
      };

      const vatPayerXml = builder.generateInvoiceXml(vatPayerData);
      expect(vatPayerXml).toContain('TaxScheme');
      expect(vatPayerXml).toContain('VAT');

      // Test non-VAT payer
      const nonVatPayerData: InvoiceInput = {
        ...mockTestData.invoiceData,
      };

      const nonVatPayerXml = builder.generateInvoiceXml(nonVatPayerData);
      // Should still contain tax information but structured differently
      expect(nonVatPayerXml).toBeDefined();
    });
  });

  describe('XML Validation and Structure', () => {
    test('should generate well-formed XML', () => {
      const xml = builder.generateInvoiceXml(mockTestData.invoiceData);

      // Basic XML validation
      expect(xml.startsWith('<?xml version="1.0"')).toBe(true);

      // Count opening and closing tags (basic balance check)
      const openingTags = (xml.match(/</g) || []).length;
      const closingTags = (xml.match(/>/g) || []).length;
      expect(openingTags).toBe(closingTags);

      // Check for proper namespace declarations
      expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      expect(xml).toContain('xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
      expect(xml).toContain('xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    });

    test('should generate XML with proper encoding', () => {
      const xml = builder.generateInvoiceXml(mockTestData.invoiceData);

      expect(xml).toContain('encoding="UTF-8"');

      // Test with special characters
      const specialCharsData: InvoiceInput = {
        ...mockTestData.invoiceData,
        supplier: {
          ...mockTestData.invoiceData.supplier,
          registrationName: 'Test & Company SRL "Special" <Chars>',
        },
      };

      const specialXml = builder.generateInvoiceXml(specialCharsData);

      // Should escape special XML characters
      expect(specialXml).toContain('&amp;'); // & becomes &amp;
      expect(specialXml).toContain('&lt;'); // < becomes &lt;
      expect(specialXml).toContain('&gt;'); // > becomes &gt;
      // Note: xmlbuilder2 correctly handles quotes in XML content without escaping to &quot;
      expect(specialXml).toContain('Test &amp; Company SRL "Special" &lt;Chars&gt;');
    });

    test('should maintain consistent element ordering', () => {
      const xml1 = builder.generateInvoiceXml(mockTestData.invoiceData);
      const xml2 = builder.generateInvoiceXml(mockTestData.invoiceData);

      // The XML structure should be consistent between calls
      const extractStructure = (xml: string) => {
        return xml.replace(/>[^<]+</g, '><'); // Remove content, keep only structure
      };

      expect(extractStructure(xml1)).toBe(extractStructure(xml2));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty invoice lines', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      // Should still generate valid XML without lines
      expect(xml).toContain('<Invoice');
      expect(xml).toContain('</Invoice>');

      // Should have zero totals
      expect(xml).toContain('<cbc:TaxAmount currencyID="RON">0.00</cbc:TaxAmount>');
      expect(xml).toContain('<cbc:LineExtensionAmount currencyID="RON">0.00</cbc:LineExtensionAmount>');
      expect(xml).toContain('<cbc:PayableAmount currencyID="RON">0.00</cbc:PayableAmount>');
    });

    test('should handle zero-value invoice lines', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Free Service',
            quantity: 1,
            unitPrice: 0,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Free Service');
      expect(xml).toContain('0.00');
    });

    test('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(1000);
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Long Description Item',
            description: longDescription,
            quantity: 1,
            unitPrice: 100,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      expect(xml).toContain('Long Description Item');
      expect(xml).toContain(longDescription);
      expect(xml).toBeDefined();
    });

    test('should handle various tax percentages', () => {
      const taxRates = [0, 5, 9, 19, 24];

      taxRates.forEach((taxRate) => {
        const invoiceData: InvoiceInput = {
          ...mockTestData.invoiceData,
          lines: [
            {
              name: `Item with ${taxRate}% tax`,
              description: `Item with ${taxRate}% tax`,
              quantity: 1,
              unitPrice: 100,
              taxPercent: taxRate,
            },
          ],
        };

        const xml = builder.generateInvoiceXml(invoiceData);

        expect(xml).toContain(taxRate.toString());
        expect(xml).toBeDefined();
      });
    });

    test('should handle decimal precision correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Precision Test',
            description: 'Precision Test',
            quantity: 3,
            unitPrice: 33.333333,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      // Should round to 2 decimal places
      expect(xml).toContain('33.33'); // unit price
      expect(xml).toContain('99.99'); // line total (3 * 33.33)
    });
  });

  describe('Business Logic Validation', () => {
    test('should calculate line totals correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Test Item',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 20.5,
            taxPercent: 19,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      // Line total: 5 * 20.5 = 102.5
      expect(xml).toContain('102.50');

      // Tax amount: 102.5 * 0.19 = 19.475 → 19.48
      expect(xml).toContain('19.48');

      // Total with tax: 102.5 + 19.48 = 121.98
      expect(xml).toContain('121.98');
    });

    test('should handle multiple tax rates correctly', () => {
      const invoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: [
          {
            name: 'Item with 19% VAT',
            description: 'Item with 19% VAT',
            quantity: 1,
            unitPrice: 100,
            taxPercent: 19,
          },
          {
            name: 'Item with 9% VAT',
            description: 'Item with 9% VAT',
            quantity: 1,
            unitPrice: 100,
            taxPercent: 9,
          },
        ],
      };

      const xml = builder.generateInvoiceXml(invoiceData);

      // Should contain both tax rates
      expect(xml).toContain('19');
      expect(xml).toContain('9');

      // Total base: 200
      expect(xml).toContain('200.00');

      // Total tax: 19 + 9 = 28
      expect(xml).toContain('28.00');

      // Total with tax: 228
      expect(xml).toContain('228.00');
    });

    test('should generate unique invoice numbers when requested', () => {
      const baseInvoiceData = { ...mockTestData.invoiceData };

      const xml1 = builder.generateInvoiceXml({
        ...baseInvoiceData,
        invoiceNumber: testDataGenerators.randomInvoiceNumber(),
      });

      const xml2 = builder.generateInvoiceXml({
        ...baseInvoiceData,
        invoiceNumber: testDataGenerators.randomInvoiceNumber(),
      });

      expect(xml1).not.toBe(xml2);
    });
  });

  describe('Performance Tests', () => {
    test('should generate XML quickly for simple invoices', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        builder.generateInvoiceXml(mockTestData.invoiceData);
      }

      const duration = Date.now() - start;

      // Should complete 100 generations in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large invoices efficiently', () => {
      const largeInvoiceData: InvoiceInput = {
        ...mockTestData.invoiceData,
        lines: Array.from({ length: 100 }, (_, i) => ({
          name: `Item ${i + 1}`,
          description: `Item ${i + 1}`,
          quantity: Math.floor(Math.random() * 10) + 1,
          unitPrice: Math.round(Math.random() * 1000 * 100) / 100,
          taxPercent: 19,
        })),
      };

      const start = Date.now();
      const xml = builder.generateInvoiceXml(largeInvoiceData);
      const duration = Date.now() - start;

      expect(xml).toBeDefined();
      expect(xml.length).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(500); // Should complete in reasonable time
    });
  });

  describe('Address Sanitizer', () => {
    describe('sanitizeCounty', () => {
      describe('null/undefined/empty handling', () => {
        test.each([
          [null, null],
          [undefined, null],
          ['', null],
          ['   ', null],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input as any)).toBe(expected);
        });
      });

      describe('direct county matches (basic)', () => {
        test.each([
          ['cluj', 'RO-CJ'],
          ['Alba', 'RO-AB'],
          ['IASI', 'RO-IS'],
          ['ilfov', 'RO-IF'],
          ['botosani', 'RO-BT'],
          ['buzau', 'RO-BZ'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('diacritics + casing normalization', () => {
        test.each([
          ['Iași', 'RO-IS'],
          ['Dâmbovița', 'RO-DB'],
          ['Timiș', 'RO-TM'],
          ['Vâlcea', 'RO-VL'],
          // also accepts cedilla variants / legacy forms because normalize removes accents
          ['Timiş', 'RO-TM'],
          ['Dîmboviţa', 'RO-DB'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('separator normalization', () => {
        test.each([
          ['bistrita-nasaud', 'RO-BN'],
          ['BISTRITA_NASAUD', 'RO-BN'],
          ['bistrita.nasaud', 'RO-BN'],
          ['bistrita, nasaud', 'RO-BN'],
          ['satu-mare', 'RO-SM'],
          ['satu_mare', 'RO-SM'],
          ['caras-severin', 'RO-CS'],
          ['caras_severin', 'RO-CS'],
          ['caras,severin', 'RO-CS'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('administrative-word stripping fallback', () => {
        test.each([
          ['judetul cluj', 'RO-CJ'],
          ['Județul Cluj', 'RO-CJ'],
          ['municipiul iasi', 'RO-IS'],
          ['Mun. Iasi', 'RO-IS'], // "mun" expands to "municipiul"
          ['orasul constanta', 'RO-CT'],
          ['comuna cluj', 'RO-CJ'],
          // Bucharest via stripping
          ['municipiul bucuresti', 'RO-B'],
          ['mun bucuresti', 'RO-B'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('Bucharest aliases', () => {
        test.each([
          ['bucuresti', 'RO-B'],
          ['București', 'RO-B'],
          ['buc', 'RO-B'],
          ['BUC', 'RO-B'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('common typos supported by map', () => {
        test.each([
          ['vilcea', 'RO-VL'], // mapped typo
          ['Vilcea', 'RO-VL'],
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });

      describe('unmatched inputs return null', () => {
        test.each([
          ['transilvania', null],
          ['unknown county', null],
          ['sector 1', null], // sector is not a county code
        ])('sanitizeCounty(%p) -> %p', (input, expected) => {
          expect(sanitizeCounty(input)).toBe(expected);
        });
      });
    });

    describe('sanitizeBucharestSector', () => {
      describe('null/empty handling', () => {
        test.each([
          [null, null],
          ['' as any, null],
          ['   ' as any, null],
        ])('sanitizeBucharestSector(%p) -> %p', (input, expected) => {
          expect(sanitizeBucharestSector(input as any)).toBe(expected);
        });
      });

      describe('accepted sector patterns', () => {
        test.each([
          ['sector 1', 'SECTOR1'],
          ['Sectorul 2', 'SECTOR2'],
          ['SECTOR3', 'SECTOR3'],
          ['sector 06', 'SECTOR6'],
          ['sector06', 'SECTOR6'],
          ['sectorul06', 'SECTOR6'],
          ['s1', 'SECTOR1'],
          ['S2', 'SECTOR2'],
          ['s06', 'SECTOR6'],
          ['Sector 4 Bucuresti', 'SECTOR4'], // should still extract
          ['Bucuresti sector 5', 'SECTOR5'],
          ['Sectorul_6', 'SECTOR6'], // separators normalized
          ['Sect. 3', 'SECTOR3'], // "sect" -> "sectorul" via normalizeInput
          ['Sector 3 Mun. Bucureşti', 'SECTOR3'], // extra words
        ])('sanitizeBucharestSector(%p) -> %p', (input, expected) => {
          expect(sanitizeBucharestSector(input)).toBe(expected);
        });
      });

      describe('invalid sector patterns return null', () => {
        test.each([
          ['sector 0', null],
          ['sector 7', null],
          ['sectorul 9', null],
          ['s0', null],
          ['s7', null],
          ['bucuresti', null],
          ['ilfov', null],
        ])('sanitizeBucharestSector(%p) -> %p', (input, expected) => {
          expect(sanitizeBucharestSector(input)).toBe(expected);
        });
      });
    });

    describe('isBucharest', () => {
      test.each([
        ['RO-B', true],
        ['ro-b', true],
        [' Ro-B ', true],
        ['RO-IF', false],
        ['B', false],
        [null, false],
        [undefined, false],
        ['' as any, false],
      ])('isBucharest(%p) -> %p', (input, expected) => {
        expect(isBucharest(input as any)).toBe(expected);
      });
    });

    describe('getCountryCodeByInput', () => {
      test.each([
        ['Romania', 'RO'],
        ['germany', 'DE'],
        ['United States of America', 'US'],
        ['france', 'FR'],
        ['RO', 'RO'],
      ])('getCountryCodeByInput(%p) -> %p', (input, expected) => {
        expect(getCountryCodeByInput(input)).toBe(expected);
      });

      test.each([
        ['Atlantis', null],
        ['', null],
      ])('getCountryCodeByInput(%p) -> %p', (input, expected) => {
        expect(getCountryCodeByInput(input)).toBe(expected);
      });
    });

    describe('isInternalInvoice', () => {
      test.each([
        ['Romania', true],
        ['romania', true],
        [' ROMANIA ', true],
        ['România', true],
        ['RoMaNiA', true],
      ])('isInternalInvoice(%p) -> %p', (input, expected) => {
        expect(isInternalInvoice(input)).toBe(expected);
      });

      test.each([
        ['Germany', false],
        ['France', false],
        ['RO', false],
        ['', false],
        ['   ', false],
      ])('isInternalInvoice(%p) -> %p', (input, expected) => {
        expect(isInternalInvoice(input)).toBe(expected);
      });
    });

    describe('getCountryFromTaxId', () => {
      test.each([
        ['RO123456', 'Romania'],
        ['de123456', 'Germany'],
        ['US123456', 'United States of America'],
        [' fr123456 ', 'France'],
      ])('getCountryFromTaxId(%p) -> %p', (input, expected) => {
        expect(getCountryFromTaxId(input)).toBe(expected);
      });

      test.each([
        ['RO', 'Romania'],
        ['FR', 'France'],
        ['DE', 'Germany'],
        ['US', 'United States of America'],
        ['12345678', null],
        ['R', null],
        ['', null],
        ['   ', null],
      ])('getCountryFromTaxId(%p) -> %p', (input, expected) => {
        expect(getCountryFromTaxId(input)).toBe(expected);
      });
    });
  });
});
