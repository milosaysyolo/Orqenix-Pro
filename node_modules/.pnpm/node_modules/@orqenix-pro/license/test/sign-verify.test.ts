import { describe, it, expect, beforeAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  signLicense,
  verifyLicense,
  hasFeature,
  GRACE_PERIOD_MS,
  type LicensePayload,
} from "../src/index.js";

let dir: string;
let privPath: string;
let pubPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "license-test-"));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  privPath = join(dir, "priv.pem");
  pubPath = join(dir, "pub.pem");
  await writeFile(
    privPath,
    privateKey.export({ format: "pem", type: "pkcs8" }).toString()
  );
  await writeFile(
    pubPath,
    publicKey.export({ format: "pem", type: "spki" }).toString()
  );
});

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  const now = Date.now();
  return {
    customerId: "cust-1",
    plan: "pro",
    issuedAt: now - 86400000,
    expiresAt: now + 30 * 86400000,
    features: ["learning-loop", "knowledge-intel"],
    ...overrides,
  };
}

describe("signLicense + verifyLicense", () => {
  it("valid license verifies as valid, not in grace", async () => {
    const lic = await signLicense(makePayload(), privPath);
    const r = await verifyLicense(lic, { publicKeyPath: pubPath });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.inGrace).toBe(false);
  });

  it("expired but within grace returns valid + inGrace", async () => {
    const now = Date.now();
    const lic = await signLicense(
      makePayload({
        issuedAt: now - 30 * 86400000,
        expiresAt: now - 86400000,
      }),
      privPath
    );
    const r = await verifyLicense(lic, { publicKeyPath: pubPath, now });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.inGrace).toBe(true);
      expect(r.graceRemainingMs).toBeGreaterThan(0);
      expect(r.graceRemainingMs).toBeLessThan(GRACE_PERIOD_MS);
    }
  });

  it("expired beyond grace returns invalid", async () => {
    const now = Date.now();
    const lic = await signLicense(
      makePayload({
        issuedAt: now - 60 * 86400000,
        expiresAt: now - 30 * 86400000,
      }),
      privPath
    );
    const r = await verifyLicense(lic, { publicKeyPath: pubPath, now });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("expired-beyond-grace");
  });

  it("not yet valid returns invalid", async () => {
    const now = Date.now();
    const lic = await signLicense(
      makePayload({
        issuedAt: now + 86400000,
        expiresAt: now + 30 * 86400000,
      }),
      privPath
    );
    const r = await verifyLicense(lic, { publicKeyPath: pubPath, now });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("not-yet-valid");
  });

  it("tampered payload fails signature", async () => {
    const lic = await signLicense(makePayload(), privPath);
    const tampered = { ...lic, customerId: "attacker" };
    const r = await verifyLicense(tampered, { publicKeyPath: pubPath });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("signature-invalid");
  });

  it("malformed input returns malformed", async () => {
    const r = await verifyLicense({ junk: true }, { publicKeyPath: pubPath });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("malformed");
  });

  it("hasFeature returns true for listed feature", async () => {
    const lic = await signLicense(makePayload(), privPath);
    expect(hasFeature(lic, "learning-loop")).toBe(true);
    expect(hasFeature(lic, "non-existent")).toBe(false);
  });

  it("feature order does not affect signature", async () => {
    const a = await signLicense(
      makePayload({ features: ["a", "b", "c"] }),
      privPath
    );
    const b = await signLicense(
      makePayload({
        issuedAt: a.issuedAt,
        expiresAt: a.expiresAt,
        features: ["c", "b", "a"],
      }),
      privPath
    );
    expect(a.signature).toBe(b.signature);
  });
});
