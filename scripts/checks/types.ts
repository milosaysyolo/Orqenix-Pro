import type { ReleasePolicy } from "../types";

export type Severity = "blocking" | "warning" | "info";

export interface CheckContext {
  repoRoot: string;
  mode: "oss" | "pro";
  policy: ReleasePolicy;
  packages: PackageInfo[];
  publishableNames: string[];
  env: NodeJS.ProcessEnv;
}

export interface CheckResult {
  id: string;
  severity: Severity;
  status: "pass" | "fail" | "warn" | "skip";
  durationMs: number;
  message: string;
  details?: {
    affectedPackages?: string[];
    affectedFiles?: string[];
    recommendation?: string;
    docsUrl?: string;
    rawOutput?: unknown;
  };
}

export interface Check {
  id: string;
  category: string;
  severity: Severity;
  description: string;
  rationale: string;
  docsUrl?: string;
  run(context: CheckContext): Promise<CheckResult>;
}

export interface PrePublishReport {
  timestamp: string;
  mode: "oss" | "pro";
  repo: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  durationMs: number;
  blockingFailures: number;
  results: CheckResult[];
  verdict: "go" | "no-go" | "go-with-warnings";
}

export interface PackageInfo {
  name: string;
  path: string;
  pkgJsonPath: string;
  current: Record<string, unknown>;
  classification: "publishable" | "internal" | "skip";
  reason?: string;
}
