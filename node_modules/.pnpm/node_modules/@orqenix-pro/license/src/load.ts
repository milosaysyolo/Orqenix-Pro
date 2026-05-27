import { readFile } from "node:fs/promises";

export async function loadLicense(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}
