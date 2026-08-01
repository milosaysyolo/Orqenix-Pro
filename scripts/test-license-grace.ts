import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import {
  signLicense,
  verifyLicense,
  GRACE_PERIOD_MS,
  type LicensePayload,
} from "../packages/license/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KEYS = join(ROOT, "keys");
const FIXTURES = join(ROOT, "fixtures");

const PRIV = join(KEYS, "test-private.pem");
const PUB = join(KEYS, "test-public.pem");

// test-private.pem is gitignored (see keys/.gitignore); generate the keypair
// when missing so `pnpm test:license-grace` works from a fresh checkout.
async function ensureKeys() {
  if (existsSync(PRIV) && existsSync(PUB)) return;
  await mkdir(KEYS, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  await writeFile(PUB, publicKey.export({ format: "pem", type: "spki" }).toString(), "utf8");
  await writeFile(
    PRIV,
    privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    "utf8",
  );
  console.log("Generated missing test keypair in keys/");
}

type Case = {
  name: string;
  payload: LicensePayload;
  now: number;
  expectValid: boolean;
  expectInGrace?: boolean;
  expectReason?: string;
  fixtureFile?: string;
  tamper?: (lic: any) => any;
};

const NOW = Date.parse("2026-06-01T00:00:00Z");

const cases: Case[] = [
  {
    name: "C1 valid not in grace",
    payload: {
      customerId: "cust-1",
      plan: "pro",
      issuedAt: NOW - 10 * 86400000,
      expiresAt: NOW + 30 * 86400000,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: true,
    expectInGrace: false,
    fixtureFile: "license-valid.json",
  },
  {
    name: "C2 expired 1d ago in grace",
    payload: {
      customerId: "cust-2",
      plan: "pro",
      issuedAt: NOW - 30 * 86400000,
      expiresAt: NOW - 86400000,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: true,
    expectInGrace: true,
    fixtureFile: "license-expired-in-grace.json",
  },
  {
    name: "C3 expired 8d ago beyond grace",
    payload: {
      customerId: "cust-3",
      plan: "pro",
      issuedAt: NOW - 60 * 86400000,
      expiresAt: NOW - 8 * 86400000,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: false,
    expectReason: "expired-beyond-grace",
    fixtureFile: "license-expired-beyond-grace.json",
  },
  {
    name: "C4 boundary expiresAt exactly now",
    payload: {
      customerId: "cust-4",
      plan: "pro",
      issuedAt: NOW - 30 * 86400000,
      expiresAt: NOW,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: true,
    expectInGrace: false,
  },
  {
    name: "C5 boundary expiresAt + grace minus 1s",
    payload: {
      customerId: "cust-5",
      plan: "pro",
      issuedAt: NOW - 30 * 86400000,
      expiresAt: NOW - GRACE_PERIOD_MS + 1000,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: true,
    expectInGrace: true,
  },
  {
    name: "C6 tampered signature",
    payload: {
      customerId: "cust-6",
      plan: "pro",
      issuedAt: NOW - 10 * 86400000,
      expiresAt: NOW + 30 * 86400000,
      features: ["learning-loop"],
    },
    now: NOW,
    expectValid: false,
    expectReason: "signature-invalid",
    tamper: (lic) => ({ ...lic, customerId: "attacker" }),
    fixtureFile: "license-bad-signature.json",
  },
];

async function run() {
  await ensureKeys();
  await mkdir(FIXTURES, { recursive: true });

  let failed = 0;
  for (const c of cases) {
    let lic: any = await signLicense(c.payload, PRIV);
    if (c.tamper) lic = c.tamper(lic);
    if (c.fixtureFile) {
      await writeFile(
        join(FIXTURES, c.fixtureFile),
        JSON.stringify(lic, null, 2)
      );
    }

    const r = await verifyLicense(lic, { publicKeyPath: PUB, now: c.now });

    let ok = true;
    if (r.valid !== c.expectValid) ok = false;
    if (r.valid && c.expectInGrace !== undefined) {
      if (r.inGrace !== c.expectInGrace) ok = false;
      if (c.expectInGrace && r.graceRemainingMs <= 0) ok = false;
    }
    if (!r.valid && c.expectReason && r.reason !== c.expectReason) ok = false;

    if (ok) {
      console.log(`PASS ${c.name}`);
    } else {
      console.error(`FAIL ${c.name}: ${JSON.stringify(r)}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} license-grace case(s) failed`);
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} license-grace cases passed`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
