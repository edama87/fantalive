/**
 * Bearer token per le API "machine-to-machine" (es. LINEUP_SUGGESTIONS_API_KEY).
 * Confronto a tempo costante sugli hash SHA-256 (lunghezza fissa).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function bearerToken(header: string | null | undefined): string | null {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

/** true solo se la chiave attesa è configurata (>= 32 caratteri) e coincide. */
export function verifyApiKey(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || expected.length < 32 || !provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}
