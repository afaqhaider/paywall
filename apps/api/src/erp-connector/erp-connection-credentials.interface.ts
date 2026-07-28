/**
 * Decrypted LedGix ERP connection credentials. Callers (the `financial-events`
 * sync processor) are responsible for loading the `ERPConnection` row and
 * running it through `decryptSecret` - this connector never touches Prisma or
 * the encryption helpers itself, so it never sees ciphertext and never has to
 * know how a credential was stored.
 */
export interface ERPConnectionCredentials {
  baseUrl: string;
  companyId: string;
  /** The decrypted API key, already plaintext by the time it reaches here. */
  apiKey: string;
  apiVersion: string;
}
