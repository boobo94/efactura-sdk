import { buildInvoiceXml } from '../src/ubl/InvoiceBuilder';
import { InvoiceInput, InvoiceTypeCode } from '../src/types';
import { AnafValidationError } from '../src/errors';
import { DEFAULT_CURRENCY, DEFAULT_UNIT_CODE, UBL_CUSTOMIZATION_ID } from '../src/constants';

const compactXml = (xml: string) => xml.replace(/\s+/g, '');

const createBaseInvoice = (): InvoiceInput => ({
  invoiceNumber: 'INV-001',
  issueDate: '2024-01-15',
  supplier: {
    registrationName: 'Supplier SRL',
    companyId: '160796', // normalized to RO160796
    isVatPayer: true,
    address: {
      street: 'Str. Supplier',
      city: 'Sector 3',
      county: 'Bucuresti',
      postalZone: '010101',
      country: 'Romania',
    },
  },
  customer: {
    registrationName: 'Customer SRL',
    companyId: 'RO87654321',
    address: {
      street: 'Str. Customer',
      city: 'Cluj-Napoca',
      county: 'Cluj',
      postalZone: '400000',
      country: 'Romania',
    },
  },
  lines: [
    {
      id: 'custom-line',
      name: 'Product with tax',
      description: 'First product',
      quantity: 2,
      unitCode: 'HUR',
      unitPrice: 50,
      taxPercent: 19,
    },
    {
      name: 'Service without tax',
      quantity: 1,
      unitPrice: 10,
    },
  ],
});

describe('InvoiceBuilder', () => {
  describe('buildInvoiceXml', () => {
    test('builds invoice xml with defaults, sanitized parties, and payment info', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        invoiceTypeCode: InvoiceTypeCode.CREDIT_NOTE,
        paymentIban: 'RO49AAAA1B31007593840000',
      };

      const xml = buildInvoiceXml(invoiceData);

      expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
      expect(xml).toContain(`<cbc:CustomizationID>${UBL_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
      expect(xml).toContain(`<cbc:ID>${invoiceData.invoiceNumber}</cbc:ID>`);
      expect(xml).toContain(`<cbc:IssueDate>${invoiceData.issueDate}</cbc:IssueDate>`);
      expect(xml).toContain(`<cbc:DueDate>${invoiceData.issueDate}</cbc:DueDate>`); // defaults to issue date
      expect(xml).toContain(`<cbc:InvoiceTypeCode>${InvoiceTypeCode.CREDIT_NOTE}</cbc:InvoiceTypeCode>`);
      expect(xml).toContain(`<cbc:DocumentCurrencyCode>${DEFAULT_CURRENCY}</cbc:DocumentCurrencyCode>`);

      // Parties
      expect(xml).toContain('<cbc:CountrySubentity>RO-B</cbc:CountrySubentity>'); // Bucharest sanitized
      expect(xml).toContain('<cbc:CityName>SECTOR3</cbc:CityName>'); // Bucharest sector normalized
      expect(xml).toContain('<cbc:CountrySubentity>RO-CJ</cbc:CountrySubentity>'); // Non-Bucharest county
      expect(xml).toContain('RO160796'); // VAT normalized for VAT payer

      // Payment and line defaults
      expect(xml).toContain('<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>');
      expect(xml).toContain(invoiceData.paymentIban!);
      expect(xml).toContain(`unitCode="${DEFAULT_UNIT_CODE}"`); // default unit code applied
      expect(xml).toContain('unitCode="HUR"'); // custom unit code retained
      expect(xml).toContain('<cbc:Description>First product</cbc:Description>'); // description branch
      expect(xml).toContain('<cbc:ID>custom-line</cbc:ID>'); // custom line id
      expect(xml).toContain('<cbc:ID>2</cbc:ID>'); // auto-generated line id
    });

    test('calculates totals and groups taxes for VAT payer', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        lines: [
          {
            name: 'Rounded item',
            quantity: 2,
            unitPrice: 10.345,
            taxPercent: 19,
          },
          {
            name: 'Second item',
            quantity: 1,
            unitPrice: 50,
            taxPercent: 19,
          },
          {
            name: 'Zero VAT item',
            quantity: 3,
            unitPrice: 0,
            taxPercent: 0,
          },
        ],
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      // Line rounding and tax categories
      expect(xml).toContain('<cbc:LineExtensionAmount currencyID="RON">20.70</cbc:LineExtensionAmount>');
      expect(xml).toContain('<cbc:LineExtensionAmount currencyID="RON">50.00</cbc:LineExtensionAmount>');
      expect(normalizedXml).toContain(
        '<cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>'
      );
      expect(normalizedXml).toContain(
        '<cac:ClassifiedTaxCategory><cbc:ID>Z</cbc:ID><cbc:Percent>0.00</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>'
      );
      expect(xml).toContain('<cbc:ID>S</cbc:ID>'); // standard rated
      expect(xml).toContain('<cbc:ID>Z</cbc:ID>'); // zero rated

      // Totals
      expect(xml).toContain('<cbc:TaxableAmount currencyID="RON">70.70</cbc:TaxableAmount>');
      expect(xml).toContain('<cbc:TaxAmount currencyID="RON">13.43</cbc:TaxAmount>');
      expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="RON">84.13</cbc:TaxInclusiveAmount>');
      expect(xml).toContain('<cbc:PayableAmount currencyID="RON">84.13</cbc:PayableAmount>');
    });

    test('handles non-VAT suppliers with exemption reason and category O', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          isVatPayer: false,
        },
        lines: [
          {
            name: 'Non VAT item',
            quantity: 1,
            unitPrice: 100,
            taxPercent: 19,
          },
        ],
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(xml).toContain('<cbc:ID>O</cbc:ID>'); // exemption category
      expect(xml).toContain('<cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode>');
      // remove cbc:Percent for O tax category
      expect(normalizedXml).toContain(
        '<cac:ClassifiedTaxCategory><cbc:ID>O</cbc:ID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>'
      );
      expect(normalizedXml).toContain(
        '<cac:TaxCategory><cbc:ID>O</cbc:ID><cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>'
      );
    });

    test('adds zero tax subtotal when invoice has no lines and formats dates', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        issueDate: new Date('2024-02-01'),
        dueDate: new Date('2024-02-10'),
        invoiceTypeCode: undefined, // use default
        lines: [],
      };

      const xml = buildInvoiceXml(invoiceData);

      expect(xml).toContain('<cbc:IssueDate>2024-02-01</cbc:IssueDate>');
      expect(xml).toContain('<cbc:DueDate>2024-02-10</cbc:DueDate>');
      expect(xml).toContain(`<cbc:InvoiceTypeCode>${InvoiceTypeCode.COMMERCIAL_INVOICE}</cbc:InvoiceTypeCode>`);
      expect(xml).toContain('<cbc:TaxAmount currencyID="RON">0.00</cbc:TaxAmount>');
      expect(xml).toContain('<cbc:TaxableAmount currencyID="RON">0.00</cbc:TaxableAmount>');
      expect(xml).toContain('<cbc:PayableAmount currencyID="RON">0.00</cbc:PayableAmount>');
    });

    test('omits party tax schemes when supplier is not VAT payer even if customer is', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          isVatPayer: false,
        },
        customer: {
          ...createBaseInvoice().customer,
          isVatPayer: true,
        },
      };

      const xml = buildInvoiceXml(invoiceData);

      expect(xml).not.toContain('<cac:PartyTaxScheme>');
    });

    test('adds party tax schemes for both parties when supplier is VAT payer', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        customer: {
          ...createBaseInvoice().customer,
          isVatPayer: true,
        },
      };

      const xml = buildInvoiceXml(invoiceData);

      const partyTaxSchemeCount = (xml.match(/<cac:PartyTaxScheme>/g) || []).length;
      expect(partyTaxSchemeCount).toBe(2);
    });

    test('uses address country and skips RO county/city sanitization for foreign parties', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          companyId: 'DE1607969',
          address: {
            ...createBaseInvoice().supplier.address,
            country: 'Germany',
            city: 'Sector 3',
            county: 'Bucuresti',
          },
        },
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(normalizedXml).toContain('<cbc:IdentificationCode>DE</cbc:IdentificationCode>');
      expect(normalizedXml).toContain('<cbc:CityName>Sector3</cbc:CityName>');
      expect(normalizedXml).toContain('<cbc:CountrySubentity>Bucuresti</cbc:CountrySubentity>');
    });

    test('uses address.country when tax ID has a different country prefix', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          companyId: 'DE1607969',
          address: {
            ...createBaseInvoice().supplier.address,
            country: 'France',
            county: 'Ile-de-France',
          },
        },
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(normalizedXml).toContain('<cbc:IdentificationCode>FR</cbc:IdentificationCode>');
      expect(normalizedXml).not.toContain('<cbc:IdentificationCode>DE</cbc:IdentificationCode>');
    });

    test('uses address country when tax ID has no country prefix', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        customer: {
          ...createBaseInvoice().customer,
          companyId: '1607969',
          address: {
            ...createBaseInvoice().customer.address,
            country: 'United States of America',
            county: 'California',
          },
        },
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(normalizedXml).toContain('<cbc:IdentificationCode>US</cbc:IdentificationCode>');
      expect(normalizedXml).toContain('<cbc:CountrySubentity>California</cbc:CountrySubentity>');
    });

    test('falls back to companyId in PartyLegalEntity when no registration number', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          companyId: 'RO160796',
          // registrationNumber is undefined,
        },
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(normalizedXml).toContain(
        '<cac:PartyLegalEntity><cbc:RegistrationName>SupplierSRL</cbc:RegistrationName><cbc:CompanyID>RO160796</cbc:CompanyID></cac:PartyLegalEntity>'
      );
    });

    test('uses companyId in PartyLegalEntity for physical person CNP', () => {
      const invoiceData: InvoiceInput = {
        ...createBaseInvoice(),
        supplier: {
          ...createBaseInvoice().supplier,
          companyId: '1960101123456',
          isVatPayer: false,
          // registrationNumber is undefined,
        },
      };

      const xml = buildInvoiceXml(invoiceData);
      const normalizedXml = compactXml(xml);

      expect(normalizedXml).toContain(
        '<cac:PartyLegalEntity><cbc:RegistrationName>SupplierSRL</cbc:RegistrationName><cbc:CompanyID>1960101123456</cbc:CompanyID></cac:PartyLegalEntity>'
      );
    });
  });

  describe('validation errors', () => {
    test.each([
      ['missing invoice number', (input: InvoiceInput) => (input.invoiceNumber = ' '), 'Invoice number is required'],
      ['missing issue date', (input: InvoiceInput) => ((input as any).issueDate = undefined), 'Issue date is required'],
      [
        'missing supplier',
        (input: InvoiceInput) => ((input as any).supplier = undefined),
        'Supplier information is required',
      ],
      [
        'missing supplier registration name',
        (input: InvoiceInput) => (input.supplier.registrationName = ' '),
        'Supplier registration name is required',
      ],
      [
        'missing supplier company id',
        (input: InvoiceInput) => (input.supplier.companyId = ' '),
        'Supplier company ID is required',
      ],
      [
        'missing supplier address',
        (input: InvoiceInput) => ((input.supplier as any).address = undefined),
        'Supplier address is required',
      ],
      [
        'missing supplier street',
        (input: InvoiceInput) => (input.supplier.address.street = ' '),
        'Supplier street address is required',
      ],
      [
        'missing supplier city',
        (input: InvoiceInput) => (input.supplier.address.city = ''),
        'Supplier city is required',
      ],
      [
        'missing supplier postal zone',
        (input: InvoiceInput) => (input.supplier.address.postalZone = ''),
        'Supplier postal zone is required',
      ],
      [
        'missing customer',
        (input: InvoiceInput) => ((input as any).customer = undefined),
        'Customer information is required',
      ],
      [
        'missing customer registration name',
        (input: InvoiceInput) => (input.customer.registrationName = ''),
        'Customer registration name is required',
      ],
      [
        'missing lines array',
        (input: InvoiceInput) => ((input as any).lines = undefined),
        'Invoice lines array is required',
      ],
      ['missing line name', (input: InvoiceInput) => (input.lines[0].name = ''), 'Line 1: Name is required'],
      [
        'non-numeric quantity',
        (input: InvoiceInput) => (input.lines[0].quantity = 'not a number' as any),
        'Line 1: Quantity must be a number',
      ],
      [
        'negative unit price',
        (input: InvoiceInput) => (input.lines[0].unitPrice = -1),
        'Line 1: Unit price must be a non-negative number',
      ],
      [
        'invalid tax percent',
        (input: InvoiceInput) => (input.lines[0].taxPercent = 150 as any),
        'Line 1: Tax percent must be between 0 and 100',
      ],
    ])('throws AnafValidationError for %s', (_label, mutate, expectedMessage) => {
      const invoiceData = createBaseInvoice();
      mutate(invoiceData);

      const action = () => buildInvoiceXml(invoiceData);
      expect(action).toThrow(AnafValidationError);
      expect(action).toThrow(expectedMessage);
    });
  });
});
