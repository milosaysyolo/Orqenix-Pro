import { createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { canonicalize } from "./sign.js";
import type { License, LicenseCheckResult } from "./types.js";

export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export interface VerifyOptions {
  publicKeyPath: string;
  now?: number;
  gracePeriodMs?: number;
}

function isWellFormed(lic: unknown): lic is License {
  if (typeof lic !== "object" || lic === null) return false;
  const l = lic as Partial<License>;
  return (
    typeof l.customerId === "string" &&
    (l.plan === "pro" || l.plan === "team" || l.plan === "enterprise") &&
    typeof l.issuedAt === "number" &&
    typeof l.expiresAt === "number" &&
    Array.isArray(l.features) &&
    l.features.every((f) => typeof f === "string") &&
    typeof l.signature === "string"
  );
}

export async function verifyLicense(
  lic: unknown,
  opts: VerifyOptions
): Promise<LicenseCheckResult> {
  const now = opts.now ?? Date.now();
  const grace = opts.gracePeriodMs ?? GRACE_PERIOD_MS;

  if (!isWellFormed(lic)) {
    return { valid: false, reason: "malformed" };
  }

  const pubPem = await readFile(opts.publicKeyPath, "utf8");
  const key = createPublicKey(pubPem);

  const payload = canonicalize(lic);
  let sigBytes: Buffer;
  try {
    sigBytes = Buffer.from(lic.signature, "base64");
  } catch {
    return { valid: false, reason: "signature-invalid" };
  }

  const ok = verify(null, Buffer.from(payload), key, sigBytes);
  if (!ok) return { valid: false, reason: "signature-invalid" };

  if (now < lic.issuedAt) {
    return { valid: false, reason: "not-yet-valid" };
  }

  const cutoff = lic.expiresAt + grace;
  if (now > cutoff) {
    return { valid: false, reason: "expired-beyond-grace" };
  }

  if (now > lic.expiresAt) {
    return {
      valid: true,
      inGrace: true,
      graceRemainingMs: cutoff - now,
    };
  }

  return { valid: true, inGrace: false, graceRemainingMs: 0 };
}

export function hasFeature(lic: License, feature: string): boolean {
  return lic.features.includes(feature);
}
