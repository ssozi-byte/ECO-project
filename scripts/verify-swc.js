#!/usr/bin/env node
/**
 * Verifies that Next.js SWC native binaries are intact.
 *
 * Why: if `npm install` is interrupted, npm can leave a TRUNCATED .node binary
 * behind and treat the package as installed. Loading a truncated native module
 * segfaults with SIGBUS (exit 135) — e.g. "Next.js build worker exited with
 * code: null and signal: SIGBUS". This script detects that early with a clear
 * message instead of a cryptic crash later.
 *
 * Usage: node scripts/verify-swc.js [--fix]
 *   --fix  attempts `npm rebuild` on broken packages automatically.
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const require = createRequire(path.join(process.cwd(), 'noop.js'));
const root = process.cwd();

// Only the ABI matching this machine's libc is required; the other is an
// optional cross-platform package whose absence is normal.
const libc = process.report?.getReport?.()?.header?.glibcVersionRuntime
  || (fs.existsSync('/etc/alpine-release') ? 'musl' : 'glibc');
const candidates =
  libc === 'musl'
    ? [['next', '@next/swc-linux-x64-musl', 'next-swc.linux-x64-musl.node']]
    : [['next', '@next/swc-linux-x64-gnu', 'next-swc.linux-x64-gnu.node']];

function resolvePkgDir(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [root] }));
  } catch {
    return null;
  }
}

let broken = [];
let checked = 0;

for (const [parent, pkg, binary] of candidates) {
  const parentVersion = (() => {
    try {
      return require(`${parent}/package.json`, { paths: [root] }).version;
    } catch {
      return null; // next not installed — nothing to check
    }
  })();
  if (!parentVersion) continue;

  checked++;
  const dir = resolvePkgDir(pkg);
  if (!dir) {
    broken.push({ pkg, reason: `package not installed (required by next@${parentVersion})` });
    continue;
  }
  const file = path.join(dir, binary);
  let size = -1;
  try {
    size = fs.statSync(file).size;
  } catch {
    broken.push({ pkg, reason: `missing binary: ${file}` });
    continue;
  }

  // Sanity floor: real SWC binaries are >100MB. A truncated download is almost
  // always far smaller. (Exact integrity is npm's job via the lockfile; this
  // catches the "file exists but was cut short" case.)
  if (size < 50 * 1024 * 1024) {
    broken.push({ pkg, reason: `binary too small (${(size / 1e6).toFixed(1)}MB) — likely truncated: ${file}` });
  }
}

if (checked === 0) {
  console.log('verify-swc: next is not installed — nothing to check');
  process.exit(0);
}

if (broken.length === 0) {
  console.log(`verify-swc: OK (${checked} native binary(ies) intact)`);
  process.exit(0);
}

console.error('verify-swc: BROKEN native packages detected:');
for (const b of broken) console.error(`  - ${b.pkg}: ${b.reason}`);

if (process.argv.includes('--fix')) {
  console.log('verify-swc: attempting repair via npm rebuild...');
  for (const b of broken) {
    try {
      execSync(`npm rebuild ${b.pkg} --force`, { stdio: 'inherit', cwd: root });
      console.log(`verify-swc: rebuilt ${b.pkg}`);
    } catch (e) {
      console.error(`verify-swc: rebuild failed for ${b.pkg}. Run: rm -rf node_modules/${b.pkg} && npm install`);
      process.exitCode = 1;
    }
  }
} else {
  console.error('\nFix with: npm run verify:swc -- --fix');
  console.error('or:       rm -rf node_modules && npm install');
  process.exit(1);
}
