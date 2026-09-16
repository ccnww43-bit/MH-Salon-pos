/**
 * Password security helpers.
 *
 * Uses the browser's built-in Web Crypto API (SubtleCrypto) so no
 * extra libraries or internet access are required — it works fully
 * offline on the POS machine.
 *
 * Each password gets its own random salt, and is hashed with SHA-256
 * many times (a simple PBKDF2 loop) before being stored. The plain
 * password itself is never saved to the database.
 */

const ITERATIONS = 100_000;

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

async function derive(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits);
}

export interface PasswordHash {
  passwordHash: string;
  passwordSalt: string;
}

/** Hash a new password. Use the result to store passwordHash + passwordSalt. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const passwordSalt = randomSaltHex();
  const passwordHash = await derive(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

/** Check a typed password against a stored hash + salt. */
export async function verifyPassword(
  password: string,
  passwordHash: string,
  passwordSalt: string
): Promise<boolean> {
  const candidate = await derive(password, passwordSalt);
  return candidate === passwordHash;
}
