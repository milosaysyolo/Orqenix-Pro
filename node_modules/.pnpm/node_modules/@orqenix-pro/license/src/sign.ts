import { createPrivateKey, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { License, LicensePayload } from "./types.js";

export function canonicalize(payload: LicensePayload): string {
  return JSON.stringify({
    customerId: payload.customerId,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    features: [...payload.features].sort(),
  });
}

export async function signLicense(
  payload: LicensePayload,
  privateKeyPath: string
): Promise<License> {
  const privPem = await readFile(privateKeyPath, "utf8");
  const key = createPrivateKey(privPem);
  const data = Buffer.from(canonicalize(payload));
  const sig = sign(null, data, key);
  return { ...payload, signature: sig.toString("base64") };
}
