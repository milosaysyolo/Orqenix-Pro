// SPDX-License-Identifier: Apache-2.0
// scripts/release/tag-phase-5.ts
//
// Phase 5 v0.5.0-phase-5 tag execution.
// Runs identically on Orqenix (main) and Orqenix-Pro repos.
// Reads CHANGELOG + RELEASE_NOTES + README badges from sibling .md template files.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const TEMPLATE_DIR = join(REPO_ROOT, 'scripts/release/templates');

const TAG_NAME = 'v0.5.0-phase-5';
const COMMIT_MSG_MAIN = 'chore(release): Phase 5 — Memory Foundation Refactor v0.5.0-phase-5';
const COMMIT_MSG_PRO  = 'chore(release): Phase 5 Pro Tier v0.5.0-phase-5';

interface ReleaseReport {
  repoKind: 'main' | 'pro';
  tagName: string;
  commitSha: string;
  changedFiles: string[];
  pushedToOrigin: boolean;
  dryRun: boolean;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

function run(cmd: string, opts: { silent?: boolean } = {}): string {
  return execSync(cmd, { cwd: REPO_ROOT, stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf-8' }).trim();
}

function tryRun(cmd: string): string | null {
  try { return run(cmd, { silent: true }); } catch { return null; }
}

function detectRepoKind(): 'main' | 'pro' {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { name?: string };
  if (pkg.name === '@orqenix-pro/root' || pkg.name?.startsWith('@orqenix-pro/')) return 'pro';
  return 'main';
}

function assertCleanTree(): void {
  const status = run('git status --porcelain', { silent: true });
  // Allow modifications only to the 3 files we are about to write
  const allowed = new Set(['CHANGELOG.md', 'RELEASE_NOTES.md', 'README.md', 'pnpm-lock.yaml']);
  const dirty = status.split('\n').filter((line) => {
    if (!line) return false;
    const path = line.slice(3);
    return !allowed.has(path);
  });
  if (dirty.length > 0) {
    throw new Error(`working tree has uncommitted changes:\n${dirty.join('\n')}\nAbort.`);
  }
}

function assertTagDoesNotExist(): void {
  const local = tryRun(`git rev-parse -q --verify "refs/tags/${TAG_NAME}"`);
  if (local) throw new Error(`tag ${TAG_NAME} already exists locally (sha=${local}). Abort.`);
  const remote = tryRun(`git ls-remote --tags origin "${TAG_NAME}"`);
  if (remote && remote.trim().length > 0) {
    throw new Error(`tag ${TAG_NAME} already exists on origin:\n${remote}\nAbort.`);
  }
}

function copyTemplate(name: string, target: string): void {
  const src = join(TEMPLATE_DIR, name);
  if (!existsSync(src)) throw new Error(`template not found: ${src}`);
  const content = readFileSync(src, 'utf-8');
  writeFileSync(join(REPO_ROOT, target), content);
}

function ensureReadmeBadge(): void {
  const readmePath = join(REPO_ROOT, 'README.md');
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, readFileSync(join(TEMPLATE_DIR, 'README-section.md'), 'utf-8'));
    return;
  }
  const current = readFileSync(readmePath, 'utf-8');
  const marker = '<!-- phase-5-status:start -->';
  if (current.includes(marker)) return; // already present
  const section = readFileSync(join(TEMPLATE_DIR, 'README-section.md'), 'utf-8');
  writeFileSync(readmePath, `${section}\n\n${current}`);
}

function writeReleaseDocs(kind: 'main' | 'pro'): string[] {
  copyTemplate(`CHANGELOG-${kind}.md`, 'CHANGELOG.md');
  copyTemplate(`RELEASE_NOTES-${kind}.md`, 'RELEASE_NOTES.md');
  ensureReadmeBadge();
  return ['CHANGELOG.md', 'RELEASE_NOTES.md', 'README.md'];
}

function stageAndCommit(files: string[], message: string): string {
  run(`git add ${files.map((f) => `"${f}"`).join(' ')} pnpm-lock.yaml`);
  run(`git commit -m "${message}"`);
  return run('git rev-parse HEAD', { silent: true });
}

function createAnnotatedTag(kind: 'main' | 'pro'): void {
  const tagMsgFile = join(TEMPLATE_DIR, `TAG-MESSAGE-${kind}.txt`);
  if (!existsSync(tagMsgFile)) throw new Error(`tag message file not found: ${tagMsgFile}`);
  run(`git tag -a "${TAG_NAME}" -F "${tagMsgFile}"`);
}

function pushIfNotDryRun(branch: string, dryRun: boolean): boolean {
  if (dryRun) {
    console.log(`[dry-run] would push: git push origin ${branch} && git push origin ${TAG_NAME}`);
    return false;
  }
  run(`git push origin "${branch}"`);
  run(`git push origin "${TAG_NAME}"`);
  return true;
}

async function main(): Promise<void> {
  const dryRun = process.env.ORQENIX_DRY_RUN === 'true';
  const startedAt = new Date().toISOString();
  const start = Date.now();

  console.log(`=== Phase 5 tag execution at ${REPO_ROOT} ===`);
  console.log(`Dry-run: ${dryRun}`);

  const kind = detectRepoKind();
  console.log(`Repo kind: ${kind}`);

  const branch = process.env.ORQENIX_BRANCH ?? run('git rev-parse --abbrev-ref HEAD', { silent: true });
  console.log(`Branch: ${branch}`);

  assertCleanTree();
  assertTagDoesNotExist();

  const changed = writeReleaseDocs(kind);
  console.log(`Wrote: ${changed.join(', ')}`);

  // refresh lockfile (no actual install change unless dependencies drifted)
  try { run('pnpm install --lockfile-only'); }
  catch { /* lockfile already current */ }

  const commitMsg = kind === 'main' ? COMMIT_MSG_MAIN : COMMIT_MSG_PRO;
  const sha = stageAndCommit(changed, commitMsg);
  console.log(`Commit: ${sha.slice(0, 12)}`);

  createAnnotatedTag(kind);
  console.log(`Tag: ${TAG_NAME} (annotated)`);

  const pushed = pushIfNotDryRun(branch, dryRun);
  console.log(`Pushed: ${pushed}`);

  const finishedAt = new Date().toISOString();
  const report: ReleaseReport = {
    repoKind: kind, tagName: TAG_NAME,
    commitSha: sha, changedFiles: changed,
    pushedToOrigin: pushed, dryRun,
    durationMs: Date.now() - start,
    startedAt, finishedAt,
  };

  const reportDir = join(REPO_ROOT, 'release-reports');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `${TAG_NAME}-${startedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(`\n✓ Phase 5 tag execution complete (${report.durationMs}ms)`);
}

main().catch((e) => {
  console.error(`\n✗ Tag execution FAILED: ${(e as Error).message}`);
  console.error((e as Error).stack);
  process.exit(1);
});
