/**
 * Signed session cookie helpers, shared between middleware.ts (Edge runtime)
 * and /api/login (Node runtime). Built on the Web Crypto API rather than
 * Node's `crypto` module — `crypto.subtle` is a standard global available
 * in both runtimes, so this stays dependency-free without requiring the
 * Node.js middleware runtime (not stable in the Next.js version here).
 *
 * Cookie format: `${issuedAt}.${signatureHex}`, where signature is an
 * HMAC-SHA256 of issuedAt keyed on SESSION_SECRET. issuedAt never changes
 * for a given session — the sliding expiry is implemented by middleware
 * re-issuing the same value with a refreshed Max-Age on every valid
 * request, not by re-signing. Rotating SESSION_SECRET invalidates every
 * outstanding session at once (the documented revocation path).
 */

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(signature);
}

/** Constant-time string compare, so signature checks don't leak timing info. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const issuedAt = Date.now().toString();
  const signature = await hmacHex(secret, issuedAt);
  return `${issuedAt}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;

  const issuedAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(issuedAt)) return false;

  const expected = await hmacHex(secret, issuedAt);
  return timingSafeEqual(signature, expected);
}
