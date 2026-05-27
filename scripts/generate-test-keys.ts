import { generateKeyPairSync } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, "..", "keys");

async function main() {
  await mkdir(KEYS_DIR, { recursive: true });

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  const pubPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const privPem = privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();

  await writeFile(join(KEYS_DIR, "test-public.pem"), pubPem, "utf8");
  await writeFile(join(KEYS_DIR, "test-private.pem"), privPem, "utf8");

  console.log("Generated Ed25519 keypair in keys/");
  console.log("test-public.pem committed, test-private.pem gitignored");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
