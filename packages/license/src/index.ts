import { verify } from "node:crypto";

const ORQENIX_LICENSE_PUBKEY = `-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALz...
-----END PUBLIC KEY-----`;

export interface LicenseStatus {
  valid: boolean;
  reason?: string;
  tier?: "pro";
  features?: string[];
  expiresAt?: string;
  graceUntil?: string;
}

export function validateLicense(raw: string): LicenseStatus {
  let lic: any;
  try {
    lic = JSON.parse(raw);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const { signature, ...body } = lic;
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  const sigBuf = Buffer.from(signature.replace(/^ed25519:/, ""), "base64");

  if (!verify(null, Buffer.from(canonical), ORQENIX_LICENSE_PUBKEY, sigBuf)) {
    return { valid: false, reason: "bad-signature" };
  }

  const now = Date.now();
  const exp = Date.parse(lic.expires_at);
  if (now > exp) {
    const graceDays = 30;
    const graceUntil = exp + graceDays * 86_400_000;
    if (now < graceUntil) {
      return {
        valid: true,
        tier: lic.tier,
        features: lic.features,
        expiresAt: lic.expires_at,
        graceUntil: new Date(graceUntil).toISOString(),
      };
    }
    return { valid: false, reason: "expired" };
  }
  return {
    valid: true,
    tier: lic.tier,
    features: lic.features,
    expiresAt: lic.expires_at,
  };
}

export function gate(feature: string): boolean {
  const status = validateLicense("{}");
  if (!status.valid) return false;
  return status.features?.includes(feature) ?? false;
}
