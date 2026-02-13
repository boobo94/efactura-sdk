import { AnafDetailsClient } from '../src/AnafDetailsClient';
import { AnafCompanyResult, AnafApiResponse } from '../src/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnafDetailsClient Unit Tests', () => {
  let client: AnafDetailsClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AnafDetailsClient();
  });

  describe('Constructor and Configuration', () => {
    test('should create client with default configuration', () => {
      const defaultClient = new AnafDetailsClient();
      expect(defaultClient).toBeInstanceOf(AnafDetailsClient);
    });

    test('should create client with custom configuration', () => {
      const customClient = new AnafDetailsClient({
        timeout: 60000,
      });
      expect(customClient).toBeInstanceOf(AnafDetailsClient);
    });
  });

  describe('VAT Code Validation', () => {
    test('should validate correct VAT codes', async () => {
      expect(await client.isValidVatCode('RO12345678')).toBe(true);
      expect(await client.isValidVatCode('12345678')).toBe(true);
      expect(await client.isValidVatCode('RO123')).toBe(true);
      expect(await client.isValidVatCode('1234567890')).toBe(true);
    });

    test('should reject invalid VAT codes', async () => {
      expect(await client.isValidVatCode('')).toBe(false);
      expect(await client.isValidVatCode('RO')).toBe(false);
      expect(await client.isValidVatCode('ROABC')).toBe(false);
      expect(await client.isValidVatCode('12345678901')).toBe(false); // Too long
      expect(await client.isValidVatCode('0')).toBe(false); // Zero
      expect(await client.isValidVatCode('-123')).toBe(false); // Negative
    });
  });

  describe('Company Data Fetching', () => {
    const mockSuccessResponse: AnafApiResponse = {
      found: [
        {
          date_generale: {
            cui: 12345678,
            denumire: 'Test Company SRL',
            adresa: 'Str. Test Nr. 1, Bucuresti',
            nrRegCom: 'J40/1234/2020',
            telefon: '0212345678',
            codPostal: '010101',
          },
          inregistrare_scop_Tva: {
            scpTVA: true,
          },
          inregistrare_RTVAI: {
            dataInceputTvaInc: '2023-09-01',
            dataSfarsitTvaInc: '',
            dataActualizareTvaInc: '2023-08-24',
            dataPublicareTvaInc: '2023-08-25',
            tipActTvaInc: 'Inregistrare',
            statusTvaIncasare: true,
          },
          stare_inactiv: {
            dataInactivare: '',
            dataReactivare: '',
            dataPublicare: '',
            dataRadiere: '',
            statusInactivi: false,
          },
          inregistrare_SplitTVA: {
            dataInceputSplitTVA: '',
            dataAnulareSplitTVA: '',
            statusSplitTVA: false,
          },
          adresa_sediu_social: {
            sdenumire_Strada: 'Str. Test',
            snumar_Strada: '1',
            sdenumire_Localitate: 'Bucuresti',
            scod_Localitate: '1',
            sdenumire_Judet: 'MUNICIPIUL BUCURESTI',
            scod_Judet: '40',
            scod_JudetAuto: 'B',
            stara: 'RO',
            sdetalii_Adresa: '',
            scod_Postal: '010101',
          },
          adresa_domiciliu_fiscal: {
            ddenumire_Strada: 'Str. Test',
            dnumar_Strada: '1',
            ddenumire_Localitate: 'Bucuresti',
            dcod_Localitate: '1',
            ddenumire_Judet: 'MUNICIPIUL BUCURESTI',
            dcod_Judet: '40',
            dcod_JudetAuto: 'B',
            dtara: 'RO',
            ddetalii_Adresa: '',
            dcod_Postal: '010101',
          },
        },
      ],
      notFound: [],
    };

    const mockNotFoundResponse: AnafApiResponse = {
      notFound: [{ cui: 99999999 }],
    };

    test('should fetch company data successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await client.getCompanyData('RO12345678');

      expect(result.success).toBe(true);
      expect(result.data?.[0]).toEqual({
        vatCode: '12345678',
        name: 'Test Company SRL',
        registrationNumber: 'J40/1234/2020',
        address: {
          street: 'Str. Test Nr. 1, Bucuresti',
          city: 'Bucuresti',
          county: 'MUNICIPIUL BUCURESTI',
          postalZone: '010101',
          country: 'Romania',
        },
        postalCode: '010101',
        contactPhone: '0212345678',
        isVatPayer: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('12345678'),
        })
      );
    });

    test('should handle company not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockNotFoundResponse),
      });

      const result = await client.getCompanyData('RO99999999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Company not found for the provided VAT code.');
    });

    test('should handle invalid VAT code format', async () => {
      const result = await client.getCompanyData('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('All provided VAT codes are invalid: invalid');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle empty VAT code', async () => {
      const result = await client.getCompanyData('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('All provided VAT codes are invalid: ');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('fetch failed'));

      const result = await client.getCompanyData('RO12345678');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: Could not connect to ANAF service.');
    });

    test('should handle API errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('API error'));

      const result = await client.getCompanyData('RO12345678');

      expect(result.success).toBe(false);
      expect(result.error).toBe('An unexpected error occurred while contacting the ANAF service.');
    });

    test('should handle unexpected response structure', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({}),
      });

      const result = await client.getCompanyData('RO12345678');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response structure from ANAF API: {}');
    });
  });

  describe('Batch Operations', () => {
    const mockResponse1: AnafApiResponse = {
      found: [
        {
          date_generale: {
            cui: 11111111,
            denumire: 'Company One SRL',
            adresa: 'Address One',
            nrRegCom: 'J40/1111/2020',
            telefon: '0211111111',
            codPostal: '010101',
          },
          inregistrare_scop_Tva: {
            scpTVA: true,
          },
          inregistrare_RTVAI: {
            dataInceputTvaInc: '2023-09-01',
            dataSfarsitTvaInc: '',
            dataActualizareTvaInc: '2023-08-24',
            dataPublicareTvaInc: '2023-08-25',
            tipActTvaInc: 'Inregistrare',
            statusTvaIncasare: true,
          },
          stare_inactiv: {
            dataInactivare: '',
            dataReactivare: '',
            dataPublicare: '',
            dataRadiere: '',
            statusInactivi: false,
          },
          inregistrare_SplitTVA: {
            dataInceputSplitTVA: '',
            dataAnulareSplitTVA: '',
            statusSplitTVA: false,
          },
          adresa_sediu_social: {
            sdenumire_Strada: 'Str. Test',
            snumar_Strada: '1',
            sdenumire_Localitate: 'Bucuresti',
            scod_Localitate: '1',
            sdenumire_Judet: 'MUNICIPIUL BUCURESTI',
            scod_Judet: '40',
            scod_JudetAuto: 'B',
            stara: 'RO',
            sdetalii_Adresa: '',
            scod_Postal: '010101',
          },
          adresa_domiciliu_fiscal: {
            ddenumire_Strada: 'Str. Test',
            dnumar_Strada: '1',
            ddenumire_Localitate: 'Bucuresti',
            dcod_Localitate: '1',
            ddenumire_Judet: 'MUNICIPIUL BUCURESTI',
            dcod_Judet: '40',
            dcod_JudetAuto: 'B',
            dtara: 'RO',
            ddetalii_Adresa: '',
            dcod_Postal: '010101',
          },
        },
      ],
    };

    const mockResponse2: AnafApiResponse = {
      found: [
        {
          date_generale: {
            cui: 22222222,
            denumire: 'Company Two SRL',
            adresa: 'Address Two',
            nrRegCom: 'J40/2222/2020',
            telefon: '0212222222',
            codPostal: '020202',
          },
          inregistrare_scop_Tva: {
            scpTVA: true,
          },
          inregistrare_RTVAI: {
            dataInceputTvaInc: '2023-09-01',
            dataSfarsitTvaInc: '',
            dataActualizareTvaInc: '2023-08-24',
            dataPublicareTvaInc: '2023-08-25',
            tipActTvaInc: 'Inregistrare',
            statusTvaIncasare: true,
          },
          stare_inactiv: {
            dataInactivare: '',
            dataReactivare: '',
            dataPublicare: '',
            dataRadiere: '',
            statusInactivi: false,
          },
          inregistrare_SplitTVA: {
            dataInceputSplitTVA: '',
            dataAnulareSplitTVA: '',
            statusSplitTVA: false,
          },
          adresa_sediu_social: {
            sdenumire_Strada: 'Str. Test',
            snumar_Strada: '1',
            sdenumire_Localitate: 'Bucuresti',
            scod_Localitate: '1',
            sdenumire_Judet: 'MUNICIPIUL BUCURESTI',
            scod_Judet: '40',
            scod_JudetAuto: 'B',
            stara: 'RO',
            sdetalii_Adresa: '',
            scod_Postal: '010101',
          },
          adresa_domiciliu_fiscal: {
            ddenumire_Strada: 'Str. Test',
            dnumar_Strada: '1',
            ddenumire_Localitate: 'Bucuresti',
            dcod_Localitate: '1',
            ddenumire_Judet: 'MUNICIPIUL BUCURESTI',
            dcod_Judet: '40',
            dcod_JudetAuto: 'B',
            dtara: 'RO',
            ddetalii_Adresa: '',
            dcod_Postal: '010101',
          },
        },
      ],
    };

    const mockNotFound: AnafApiResponse = {
      notFound: [{ cui: 99999999 }],
    };

    test('should batch fetch multiple companies', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () =>
          Promise.resolve({
            found: [
              {
                date_generale: {
                  cui: 12345678,
                  denumire: 'Company One SRL',
                  adresa: 'Address One',
                  nrRegCom: 'J40/1234/2020',
                  telefon: '0211111111',
                  codPostal: '010101',
                },
                inregistrare_scop_Tva: {
                  scpTVA: true,
                  perioade_TVA: [
                    {
                      data_inceput_ScpTVA: '2023-09-01',
                      data_sfarsit_ScpTVA: '',
                      data_anul_imp_ScpTVA: '',
                      mesaj_ScpTVA: '',
                    },
                  ],
                },
                inregistrare_RTVAI: {
                  dataActualizareTvaInc: '2023-08-24',
                  dataPublicareTvaInc: '2023-08-25',
                  dataInceputTvaInc: '2023-09-01',
                  dataSfarsitTvaInc: '',
                  tipActTvaInc: 'Inregistrare',
                  statusTvaIncasare: true,
                },
                stare_inactiv: {
                  dataInactivare: '',
                  dataReactivare: '',
                  dataPublicare: '',
                  dataRadiere: '',
                  statusInactivi: false,
                },
                inregistrare_SplitTVA: {
                  dataInceputSplitTVA: '',
                  dataAnulareSplitTVA: '',
                  statusSplitTVA: false,
                },
                adresa_sediu_social: {
                  sdenumire_Localitate: 'Sector 3 Mun. Bucureşti',
                  sdenumire_Strada: 'Drm. Gura Caliţei',
                  snumar_Strada: '4-32',
                  scod_Localitate: '3',
                  sdenumire_Judet: 'MUNICIPIUL BUCUREŞTI',
                  scod_Judet: '40',
                  scod_JudetAuto: 'B',
                  sdetalii_Adresa: '',
                  scod_Postal: '32604',
                  stara: '',
                },
                adresa_domiciliu_fiscal: {
                  ddenumire_Localitate: 'Sector 3 Mun. Bucureşti',
                  ddenumire_Strada: 'Drm. Gura Caliţei',
                  dnumar_Strada: '4-32',
                  dcod_Localitate: '3',
                  ddenumire_Judet: 'MUNICIPIUL BUCUREŞTI',
                  dcod_Judet: '40',
                  dcod_JudetAuto: 'B',
                  ddetalii_Adresa: '',
                  dcod_Postal: '32604',
                  dtara: '',
                },
              },
              {
                date_generale: {
                  cui: 87654321,
                  denumire: 'Company Two SRL',
                  adresa: 'Address Two',
                  nrRegCom: 'J40/5678/2020',
                  telefon: '0222222222',
                  codPostal: '020202',
                },
                inregistrare_scop_Tva: {
                  scpTVA: false,
                  perioade_TVA: [],
                },
                inregistrare_RTVAI: {
                  dataInceputTvaInc: '',
                  dataSfarsitTvaInc: '',
                  tipActTvaInc: '',
                  statusTvaIncasare: false,
                  dataActualizareTvaInc: '',
                  dataPublicareTvaInc: '',
                },
                stare_inactiv: {
                  dataInactivare: '',
                  dataReactivare: '',
                  dataPublicare: '',
                  dataRadiere: '',
                  statusInactivi: false,
                },
                inregistrare_SplitTVA: {
                  dataInceputSplitTVA: '',
                  dataAnulareSplitTVA: '',
                  statusSplitTVA: false,
                },
                adresa_sediu_social: {
                  stara: '',
                  sdenumire_Strada: 'Şos. Ştefan cel Mare',
                  snumar_Strada: '39',
                  sdenumire_Localitate: 'Sector 2 Mun. Bucureşti',
                  scod_Localitate: '2',
                  sdenumire_Judet: 'MUNICIPIUL BUCUREŞTI',
                  scod_Judet: '40',
                  scod_JudetAuto: 'B',
                  sdetalii_Adresa: '',
                  scod_Postal: '20133',
                },
                adresa_domiciliu_fiscal: {
                  ddenumire_Localitate: 'Sector 2 Mun. Bucureşti',
                  ddenumire_Strada: 'Şos. Ştefan cel Mare',
                  dnumar_Strada: '39',
                  dcod_Localitate: '2',
                  ddenumire_Judet: 'MUNICIPIUL BUCUREŞTI',
                  dcod_Judet: '40',
                  dcod_JudetAuto: 'B',
                  ddetalii_Adresa: '',
                  dcod_Postal: '20133',
                  dtara: '',
                },
              },
            ],
          }),
      });

      const result = await client.batchGetCompanyData(['RO12345678', 'RO87654321']);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.name).toBe('Company One SRL');
      expect(result.data?.[0]?.isVatPayer).toBe(true);
      expect(result.data?.[1]?.name).toBe('Company Two SRL');
      expect(result.data?.[1]?.isVatPayer).toBe(false);

      expect(fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva');

      const requestOptions = fetchCall[1];
      expect(requestOptions.method).toBe('POST');
      expect(requestOptions.headers).toEqual({ 'Content-Type': 'application/json' });

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody).toEqual([
        {
          cui: 12345678,
          data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
        {
          cui: 87654321,
          data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      ]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle VAT codes with different formats', async () => {
      const mockResponse: AnafApiResponse = {
        found: [
          {
            date_generale: {
              cui: 123,
              denumire: 'Short CUI Company',
              adresa: 'Test Address',
              nrRegCom: 'J40/123/2020',
              telefon: '0211234567',
              codPostal: null,
            },
            inregistrare_scop_Tva: {
              scpTVA: true,
            },
            inregistrare_RTVAI: {
              dataInceputTvaInc: '2023-09-01',
              dataSfarsitTvaInc: '',
              dataActualizareTvaInc: '2023-08-24',
              dataPublicareTvaInc: '2023-08-25',
              tipActTvaInc: 'Inregistrare',
              statusTvaIncasare: true,
            },
            stare_inactiv: {
              dataInactivare: '',
              dataReactivare: '',
              dataPublicare: '',
              dataRadiere: '',
              statusInactivi: false,
            },
            inregistrare_SplitTVA: {
              dataInceputSplitTVA: '',
              dataAnulareSplitTVA: '',
              statusSplitTVA: false,
            },
            adresa_sediu_social: {
              sdenumire_Strada: 'Str. Test',
              snumar_Strada: '1',
              sdenumire_Localitate: 'Bucuresti',
              scod_Localitate: '1',
              sdenumire_Judet: 'MUNICIPIUL BUCURESTI',
              scod_Judet: '40',
              scod_JudetAuto: 'B',
              stara: 'RO',
              sdetalii_Adresa: '',
              scod_Postal: '010101',
            },
            adresa_domiciliu_fiscal: {
              ddenumire_Strada: 'Str. Test',
              dnumar_Strada: '1',
              ddenumire_Localitate: 'Bucuresti',
              dcod_Localitate: '1',
              ddenumire_Judet: 'MUNICIPIUL BUCURESTI',
              dcod_Judet: '40',
              dcod_JudetAuto: 'B',
              dtara: 'RO',
              ddetalii_Adresa: '',
              dcod_Postal: '010101',
            },
          },
        ],
        notFound: [],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      });

      // Test with different VAT code formats
      const result1 = await client.getCompanyData('RO123');
      const result2 = await client.getCompanyData('123');
      const result3 = await client.getCompanyData('  RO123  ');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      expect(result1.data?.[0]?.vatCode).toBe('123');
      expect(result1.data?.[0]?.postalCode).toBe('000000');
    });

    test('should handle missing optional fields', async () => {
      const mockResponse: AnafApiResponse = {
        found: [
          {
            date_generale: {
              cui: 12345678,
              denumire: 'Minimal Company',
              adresa: 'Minimal Address',
              nrRegCom: '',
              telefon: '',
              codPostal: null,
            },
            inregistrare_scop_Tva: {
              scpTVA: true,
            },
            inregistrare_RTVAI: {
              dataInceputTvaInc: '2023-09-01',
              dataSfarsitTvaInc: '',
              dataActualizareTvaInc: '2023-08-24',
              dataPublicareTvaInc: '2023-08-25',
              tipActTvaInc: 'Inregistrare',
              statusTvaIncasare: true,
            },
            stare_inactiv: {
              dataInactivare: '',
              dataReactivare: '',
              dataPublicare: '',
              dataRadiere: '',
              statusInactivi: false,
            },
            inregistrare_SplitTVA: {
              dataInceputSplitTVA: '',
              dataAnulareSplitTVA: '',
              statusSplitTVA: false,
            },
            adresa_sediu_social: {
              sdenumire_Strada: 'Str. Test',
              snumar_Strada: '1',
              sdenumire_Localitate: 'Bucuresti',
              scod_Localitate: '1',
              sdenumire_Judet: 'MUNICIPIUL BUCURESTI',
              scod_Judet: '40',
              scod_JudetAuto: 'B',
              stara: 'RO',
              sdetalii_Adresa: '',
              scod_Postal: '010101',
            },
            adresa_domiciliu_fiscal: {
              ddenumire_Strada: 'Str. Test',
              dnumar_Strada: '1',
              ddenumire_Localitate: 'Bucuresti',
              dcod_Localitate: '1',
              ddenumire_Judet: 'MUNICIPIUL BUCURESTI',
              dcod_Judet: '40',
              dcod_JudetAuto: 'B',
              dtara: 'RO',
              ddetalii_Adresa: '',
              dcod_Postal: '010101',
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getCompanyData('RO12345678');

      expect(result.success).toBe(true);
      expect(result.data?.[0]?.name).toBe('Minimal Company');
      expect(result.data?.[0]?.registrationNumber).toBe('');
      expect(result.data?.[0]?.contactPhone).toBe('');
      expect(result.data?.[0]?.postalCode).toBe('000000');
      expect(result.data?.[0]?.isVatPayer).toBe(true);
    });
  });
});
