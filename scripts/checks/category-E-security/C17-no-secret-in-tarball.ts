import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult } from "../types";

const SECRET_PATTERNS = [
  { name: "npm token", regex: /npm_[A-Za-z0-9]{36}/ },
  { name: "GitHub PAT", regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: "GitHub fine-grained PAT", regex: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Anthropic key", regex: /sk-ant-[A-Za-z0-9-]{90,}/ },
  { name: "OpenAI key", regex: /sk-[A-Za-z0-9]{48}/ },
  { name: "Generic secret env", regex: /(SECRET|PASSWORD|PRIVATE_KEY)\s*=\s*['"][^'"]+['"]/i },
  { name: "PEM private key", regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |)?PRIVATE KEY-----/ },
];

export const C17_NoSecretInTarball: Check = {
  id: "C17",
  category: "security",
  severity: "blocking",
  description: "No secrets, keys, or credentials in any tarball that will be published",
  rationale: "Leaked secrets in npm packages are permanent (cannot fully unpublish) and cause supply chain incidents",

  async run(ctx: CheckContext): Promise<CheckResult> {
    const start = Date.now();
    const leaks: Array<{ pkg: string; file: string; pattern: string }> = [];

    for (const pkg of ctx.packages.filter((p) => p.classification === "publishable")) {
      try {
        const { stdout } = await execa("npm", ["pack", "--dry-run", "--json"], { cwd: pkg.path });
        const result = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
        const files = result[0]?.files ?? [];

        for (const f of files) {
          const filePath = join(ctx.repoRoot, pkg.path, f.path);
          const content = await readFile(filePath, "utf-8").catch(() => "");

          for (const { name, regex } of SECRET_PATTERNS) {
            if (regex.test(content)) {
              leaks.push({ pkg: pkg.name, file: f.path, pattern: name });
            }
          }
        }
      } catch (err) {
        return {
          id: this.id,
          severity: this.severity,
          status: "fail",
          durationMs: Date.now() - start,
          message: `npm pack failed for ${pkg.name}: ${(err as Error).message}`,
        };
      }
    }

    if (leaks.length === 0) {
      return {
        id: this.id,
        severity: this.severity,
        status: "pass",
        durationMs: Date.now() - start,
        message: "Scanned all tarballs, no secrets detected",
      };
    }

    return {
      id: this.id,
      severity: this.severity,
      status: "fail",
      durationMs: Date.now() - start,
      message: `Found ${leaks.length} potential secret leak(s) in tarballs`,
      details: {
        affectedPackages: [...new Set(leaks.map((l) => l.pkg))],
        rawOutput: leaks,
        recommendation: "Remove the file from package or add it to forbidden_files_in_tarball list",
      },
    };
  },
};
