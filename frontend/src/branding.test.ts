import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';

// The app must only carry Laxmi India Finance / Laxmi Samadhan branding. Another company's
// name ("Aavas Support Service Desk") and template placeholders ("TicketPortal") shipped to
// production before. This scans app source so they cannot come back unnoticed.
// Runs in scripts/deploy.sh (blocks deploys) and in .github/workflows/test.yml.

const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'Aavas (another company)', pattern: /aavas/i },
  { label: 'TicketPortal (template placeholder)', pattern: /ticket\s?portal/i },
  { label: 'Acme / Contoso (placeholder company)', pattern: /\b(acme|contoso)\b/i },
];

const repoRoot = resolve(__dirname, '..', '..');
const SCAN_DIRS = ['frontend/src', 'frontend/index.html', 'frontend/capacitor.config.ts', 'backend/src'];
const EXTENSIONS = /\.(tsx?|jsx?|html|css|json)$/;
const SKIP = /(__tests__|\.test\.|node_modules|dist)/;

function walk(path: string, out: string[] = []): string[] {
  if (!existsSync(path)) return out;
  if (statSync(path).isFile()) {
    if (EXTENSIONS.test(path) && !SKIP.test(path)) out.push(path);
    return out;
  }
  for (const name of readdirSync(path)) {
    const p = join(path, name);
    if (SKIP.test(p)) continue;
    walk(p, out);
  }
  return out;
}

describe('Branding', () => {
  it('app source contains no other company or placeholder branding', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(repoRoot, dir))) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const { label, pattern } of FORBIDDEN) {
              if (pattern.test(line)) hits.push(`${relative(repoRoot, file)}:${i + 1}  [${label}]  ${line.trim().slice(0, 100)}`);
            }
          });
      }
    }
    expect(hits, `Replace with Laxmi India Finance / Laxmi Samadhan branding:\n${hits.join('\n')}`).toEqual([]);
  });

  it('scanner actually sees the app source', () => {
    expect(walk(join(repoRoot, 'frontend/src')).length).toBeGreaterThan(40);
    expect(walk(join(repoRoot, 'backend/src')).length).toBeGreaterThan(40);
  });
});
