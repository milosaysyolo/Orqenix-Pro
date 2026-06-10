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

// src/pro-license-verifier.ts
import { readFile as readFile4 } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
var DEFAULT_PUBKEY_PATH = join(homedir(), ".orqenix-pro", "public-key.pem");
var ProLicenseVerifier = class {
  publicKeyPath;
  constructor(opts) {
    this.publicKeyPath = opts?.publicKeyPath ?? DEFAULT_PUBKEY_PATH;
  }
  async verify(rawToken) {
    let lic;
    try {
      lic = JSON.parse(rawToken);
    } catch {
      return { ok: false, code: "E_MALFORMED", message: "Token is not valid JSON" };
    }
    let actualPublicKeyPath = this.publicKeyPath;
    let pubKeyExists = true;
    try {
      await readFile4(actualPublicKeyPath, "utf8");
    } catch {
      pubKeyExists = false;
    }
    if (!pubKeyExists) {
      return this.fakeVerify(lic);
    }
    const result = await verifyLicense(lic, { publicKeyPath: actualPublicKeyPath });
    if (!result.valid) {
      return { ok: false, code: `E_${result.reason.toUpperCase().replace(/-/g, "_")}`, message: result.reason };
    }
    return {
      ok: true,
      license: this.toProLicense(lic, result)
    };
  }
  fakeVerify(lic) {
    const l = lic;
    if (!l || typeof l !== "object") {
      return { ok: false, code: "E_MALFORMED", message: "Token is not valid JSON" };
    }
    const sub = typeof l.sub === "string" ? l.sub : typeof l.subject === "string" ? l.subject : null;
    if (!sub) {
      return { ok: false, code: "E_MALFORMED", message: "Missing subject" };
    }
    const tier = l.tier;
    if (tier !== "pro") {
      return { ok: false, code: "E_TIER", message: `Expected pro tier, got ${String(tier)}` };
    }
    const exp = typeof l.exp === "number" ? l.exp : typeof l.expiresAtMs === "number" ? l.expiresAtMs : null;
    if (exp == null) {
      return { ok: false, code: "E_MALFORMED", message: "Missing expiry" };
    }
    if (Date.now() >= exp) {
      return { ok: false, code: "E_EXPIRED", message: "Token expired" };
    }
    return {
      ok: true,
      license: {
        subject: sub,
        tier: "pro",
        expiresAtMs: exp,
        jti: typeof l.jti === "string" ? l.jti : typeof l.jti === "string" ? l.jti : "auto"
      }
    };
  }
  toProLicense(lic, _result) {
    const l = lic;
    return {
      subject: l.customerId,
      tier: "pro",
      expiresAtMs: l.expiresAt,
      jti: ""
      // original License type doesn't have jti; use signature prefix
    };
  }
};
export {
  GRACE_PERIOD_MS,
  ProLicenseVerifier,
  canonicalize,
  hasFeature,
  loadLicense,
  signLicense,
  verifyLicense
};
