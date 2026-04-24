#!/usr/bin/env node
// Regenerates the umbrella SKILL.md's domain list from the skills/ directory.
// Run on merge to main via GitHub Actions.
// Does NOT produce an index.json — each site's SKILL.md is the source of truth.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const UMBRELLA_FILE = path.join(REPO_ROOT, 'SKILL.md');

function listDomains() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter(name => {
      const full = path.join(SKILLS_DIR, name);
      return (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, 'SKILL.md'))
      );
    })
    .sort();
}

function updateUmbrella(domains) {
  const raw = fs.readFileSync(UMBRELLA_FILE, 'utf8');

  const domainListText = domains.length > 0 ? domains.join(', ') : '(no sites yet)';
  const markerRe = /<!-- DOMAINS:START -->[\s\S]*?<!-- DOMAINS:END -->/g;
  let updated = raw.replace(
    markerRe,
    `<!-- DOMAINS:START -->${domainListText}<!-- DOMAINS:END -->`
  );

  const arrayBlock =
    domains.length > 0
      ? `supportedDomains:\n${domains.map(d => `  - ${d}`).join('\n')}`
      : `supportedDomains: []`;
  updated = updated.replace(
    /supportedDomains:(?:\s*\[\s*\]|(?:\n  - [^\n]+)+)/,
    arrayBlock
  );

  return updated;
}

function writeIfChanged(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === content) return false;
  fs.writeFileSync(filePath, content);
  return true;
}

function main() {
  const domains = listDomains();
  const updated = updateUmbrella(domains);
  const changed = writeIfChanged(UMBRELLA_FILE, updated);
  console.log(`[generate-umbrella] ${domains.length} supported site(s): ${domains.join(', ') || '(none)'}`);
  console.log(`[generate-umbrella] SKILL.md ${changed ? 'updated' : 'unchanged'}`);
}

main();
