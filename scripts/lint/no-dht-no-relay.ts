import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const FORBIDDEN = [
  /@libp2p\/kad-dht/,
  /@libp2p\/circuit-relay-v2/,
  /from\s+['"][^'"]*kad-dht[^'"]*['"]/,
  /from\s+['"][^'"]*circuit-relay[^'"]*['"]/,
];

interface Violation {
  file: string;
  line: number;
  match: string;
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist') continue;
    const p = join(dir, e);
    const s = await stat(p);
    if (s.isDirectory()) {
      await walk(p, out);
    } else if (p.endsWith('.ts') && (p.includes('/src/') || p.includes('\\src\\'))) {
      out.push(p);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const packagesDir = join(root, 'packages');
  const files = await walk(packagesDir);
  const violations: Violation[] = [];

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const re of FORBIDDEN) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, match: line.trim() });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('[lint:no-dht-no-relay] FAIL: forbidden imports found');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.match}`);
    }
    process.exit(1);
  }
  console.log('[lint:no-dht-no-relay] PASS: no DHT or circuit-relay imports in Pro repo');
}

main().catch((e) => { console.error(e); process.exit(1); });
