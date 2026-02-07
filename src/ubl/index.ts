/**
 * UBL (Universal Business Language) Module
 *
 * This module provides functionality for generating UBL 2.1 XML invoices
 * compliant with Romanian CIUS-RO specification for ANAF e-Factura.
 */

export { buildInvoiceXml } from './InvoiceBuilder';

// Re-export types for convenience
export type { InvoiceInput, InvoiceLine, Party, Address } from '../types';

/**
 * Address helpers
 */
export {
  sanitizeCounty,
  sanitizeBucharestSector,
  isBucharest,
  getCountryCodeByInput,
  isInternalInvoice,
  getCountryFromTaxId,
} from './address-sanitizer';
