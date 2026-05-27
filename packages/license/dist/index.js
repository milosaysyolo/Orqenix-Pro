// src/sign.ts
import { createPrivateKey, sign } from "crypto";
import { readFile } from "fs/promises";
function canonicalize(payload) {
  return JSON.stringify({
    customerId: payload.customerId,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    features: [...payload.features].sort()
  });
}
async function signLicense(payload, privateKeyPath) {
  const privPem = await readFile(privateKeyPath, "utf8");
  const key = createPrivateKey(privPem);
  const data = Buffer.from(canonicalize(payload));
  const sig = sign(null, data, key);
  return { ...payload, signature: sig.toString("base64") };
}

// src/verify.ts
import { createPublicKey, verify } from "crypto";
import { readFile as readFile2 } from "fs/promises";
var GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1e3;
function isWellFormed(lic) {
  if (typeof lic !== "object" || lic === null) return false;
  const l = lic;
  return typeof l.customerId === "string" && (l.plan === "pro" || l.plan === "team" || l.plan === "enterprise") && typeof l.issuedAt === "number" && typeof l.expiresAt === "number" && Array.isArray(l.features) && l.features.every((f) => typeof f === "string") && typeof l.signature === "string";
}
async function verifyLicense(lic, opts) {
  const now = opts.now ?? Date.now();
  const grace = opts.gracePeriodMs ?? GRACE_PERIOD_MS;
  if (!isWellFormed(lic)) {
    return { valid: false, reason: "malformed" };
  }
  const pubPem = await readFile2(opts.publicKeyPath, "utf8");
  const key = createPublicKey(pubPem);
  const payload = canonicalize(lic);
  let sigBytes;
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
      graceRemainingMs: cutoff - now
    };
  }
  return { valid: true, inGrace: false, graceRemainingMs: 0 };
}
function hasFeature(lic, feature) {
  return lic.features.includes(feature);
}

// src/load.ts
import { readFile as readFile3 } from "fs/promises";
async function loadLicense(path) {
  const raw = await readFile3(path, "utf8");
  return JSON.parse(raw);
}
export {
  GRACE_PERIOD_MS,
  canonicalize,
  hasFeature,
  loadLicense,
  signLicense,
  verifyLicense
};
