"use client";

import { getAppMode, getLicenseStorageKey } from "@/lib/app-mode";

export const LICENSE_PRODUCT = "MH Digital Salon POS";
export const LICENSE_TYPE = "Monthly Offline License";

const LICENSE_VERSION = 1;
const CLOCK_KEY = "mh_digital_salon_pos_license_clock";
const INSTALLATION_KEY = "mh_digital_salon_pos_installation_id";

/*
 * Electron exposes a small preload bridge on `window.mhDigitalPOS` when
 * this app is running inside the desktop shell (see app/electron/main.js
 * / server.js). In the browser this is simply undefined. Declaring it
 * here tells TypeScript this property legitimately exists on Window so
 * the optional-chained access below type-checks under `strict: true`.
 */
declare global {
  interface Window {
    mhDigitalPOS?: {
      getMachineId?: () => Promise<string>;
    };
  }
}

/*
 * IMPORTANT:
 * This is the PUBLIC key only.
 * The PRIVATE signing key must NEVER be placed in the POS application.
 */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnGsQ/wE9giHCmou9vL+w
WPLFhM43I2rjKJU+VvN10LI/ReP+zfBuI0PDlLhaqioEjIk0+/976pulwvrjp6Ou
b1SO/W3NGavDLaj2ZZIQmXiHqZYg0kGOoQAYX2KXHLvxFpEStGJfDRY+CUVAXAZ3
rHCHbX7qK82iu7ZPtvdXr2vmgJ7fnWXgWrF7ytvhHlXIvhBFvdSMQwUjIDZp9fS0
XuipD/sDGWQE9CybRDNSsdCG3mn1HwETKt2AHgqtgW9kky7Z/4jr0UdlVZJpk0Vi
9O24eKlgrb+cH78nIx1EBwUCPD20oi0HEAb6I6ZEx+/hBUig7Z0/6wop5KNx7gXB
vQIDAQAB
-----END PUBLIC KEY-----`;

type LicensePayload = {
  v: number;
  product: string;
  type: "monthly";
  licenseId: string;
  businessName: string;
  machineId: string;
  issuedAt: string;
  expiresAt: string;
  months: number;
};

export type StoredLicense = LicensePayload & {
  signature?: string;
};

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    normalized +
    "=".repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(padded);

  // Built with `new Uint8Array(length)` + a manual fill instead of
  // `Uint8Array.from(binary, ...)` so this is always backed by a plain,
  // freshly-allocated ArrayBuffer (not the wider ArrayBufferLike, which
  // includes SharedArrayBuffer) — that's what crypto.subtle.verify's
  // BufferSource parameter type expects.
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(body);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function getPublicKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToBytes(PUBLIC_KEY_PEM),
    {
      name: "RSA-PSS",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );
}

async function verifySignature(
  payloadText: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await getPublicKey();

    return await crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(payloadText)
    );
  } catch {
    return false;
  }
}

function makeId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto
          .randomUUID()
          .replace(/-/g, "")
          .slice(0, 16)
          .toUpperCase()
      : Math.random()
          .toString(36)
          .slice(2, 18)
          .toUpperCase();

  return `${prefix}-${random}`;
}

async function getMachineId(): Promise<string> {
  if (typeof window === "undefined") {
    return "server";
  }

  /*
   * Electron provides the real machine ID through preload.
   */
  const electronMachineId =
    window.mhDigitalPOS?.getMachineId;

  if (electronMachineId) {
    try {
      const id = await electronMachineId();

      if (id) {
        return id;
      }
    } catch {
      // Fall through to browser installation ID.
    }
  }

  /*
   * Browser fallback.
   */
  let id = localStorage.getItem(INSTALLATION_KEY);

  if (!id) {
    id = makeId("INSTALL");

    localStorage.setItem(
      INSTALLATION_KEY,
      id
    );
  }

  return id;
}

function readStoredLicense(): StoredLicense | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(
    getLicenseStorageKey(getAppMode())
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredLicense;
  } catch {
    return null;
  }
}

function saveStoredLicense(
  license: StoredLicense
): void {
  localStorage.setItem(
    getLicenseStorageKey(getAppMode()),
    JSON.stringify(license)
  );
}

function checkClock(now: number): boolean {
  const clockKey =
    `${CLOCK_KEY}_${getAppMode()}`;

  const previousRaw =
    localStorage.getItem(clockKey);

  const previous =
    previousRaw ? Number(previousRaw) : 0;

  /*
   * If the computer time moved backwards by
   * more than five minutes, consider it tampering.
   */
  if (
    Number.isFinite(previous) &&
    previous > now + 5 * 60 * 1000
  ) {
    return false;
  }

  localStorage.setItem(
    clockKey,
    String(Math.max(previous, now))
  );

  return true;
}

/*
 * Activates a signed monthly license.
 */
export async function activateLicenseKey(
  key: string
): Promise<{
  ok: boolean;
  message: string;
  license?: StoredLicense;
}> {
  const trimmed = key.trim();

  const parts = trimmed.split(".");

  if (parts.length !== 2) {
    return {
      ok: false,
      message: "Invalid license key format.",
    };
  }

  try {
    const payloadText =
      new TextDecoder().decode(
        base64UrlDecode(parts[0])
      );

    const payload =
      JSON.parse(payloadText) as LicensePayload;

    /*
     * Verify that this license belongs
     * to this product.
     */
    if (
      payload.v !== LICENSE_VERSION ||
      payload.product !== LICENSE_PRODUCT ||
      payload.type !== "monthly"
    ) {
      return {
        ok: false,
        message:
          "This license is not for MH Digital Salon POS.",
      };
    }

    /*
     * Cryptographic signature verification.
     */
    const signatureOk =
      await verifySignature(
        payloadText,
        parts[1]
      );

    if (!signatureOk) {
      return {
        ok: false,
        message:
          "License signature verification failed.",
      };
    }

    /*
     * Machine binding.
     */
    const machineId =
      await getMachineId();

    if (
      payload.machineId !== machineId
    ) {
      return {
        ok: false,
        message:
          "This license belongs to a different computer.",
      };
    }

    const issued =
      Date.parse(payload.issuedAt);

    const expires =
      Date.parse(payload.expiresAt);

    const now = Date.now();

    if (
      !Number.isFinite(issued) ||
      !Number.isFinite(expires) ||
      expires <= issued ||
      expires <= now
    ) {
      return {
        ok: false,
        message:
          "This license has expired or is invalid.",
      };
    }

    const license: StoredLicense = {
      ...payload,
      signature: parts[1],
    };

    saveStoredLicense(license);

    localStorage.setItem(
      `${CLOCK_KEY}_${getAppMode()}`,
      String(now)
    );

    return {
      ok: true,
      message:
        "License activated successfully.",
      license,
    };
  } catch {
    return {
      ok: false,
      message:
        "The license key could not be read.",
    };
  }
}

/*
 * Checks the current license.
 */
export async function getLicenseStatus(): Promise<{
  exists: boolean;
  expired: boolean;
  tampered: boolean;
  valid: boolean;
  license: StoredLicense | null;
}> {
  const license =
    readStoredLicense();

  if (!license) {
    return {
      exists: false,
      expired: false,
      tampered: false,
      valid: false,
      license: null,
    };
  }

  const now = Date.now();

  const clockOk =
    checkClock(now);

  const expires =
    Date.parse(license.expiresAt);

  const expired =
    !Number.isFinite(expires) ||
    expires <= now;

  /*
   * Reconstruct exactly the data that was signed.
   */
  const signature =
    license.signature;

  const payload: LicensePayload = {
    v: license.v,
    product: license.product,
    type: license.type,
    licenseId: license.licenseId,
    businessName: license.businessName,
    machineId: license.machineId,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
    months: license.months,
  };

  const payloadText =
    JSON.stringify(payload);

  const signatureOk =
    !!signature &&
    (await verifySignature(
      payloadText,
      signature
    ));

  const currentMachineId =
    await getMachineId();

  const machineOk =
    license.machineId ===
    currentMachineId;

  const tampered =
    !clockOk ||
    !signatureOk ||
    !machineOk;

  return {
    exists: true,

    expired:
      expired || !clockOk,

    tampered,

    valid:
      !expired &&
      clockOk &&
      signatureOk &&
      machineOk,

    license,
  };
}

/*
 * Formats license dates for Kenya.
 */
export function formatLicenseDate(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

/*
 * Used by the setup/license screen
 * to display the computer ID.
 */
export function getCurrentMachineId(): Promise<string> {
  return getMachineId();
}
