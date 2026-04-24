#!/usr/bin/env node
// Regenerates index.json and refreshes SKILL.md's domain list.
// Run on merge to main via GitHub Actions.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkill, domainFromPath, listSkillFiles } from './parse-skill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const INDEX_FILE = path.join(REPO_ROOT, 'index.json');
const SKILL_FILE = path.join(REPO_ROOT, 'SKILL.md');

function buildIndex() {
  const domains = {};
  for (const filePath of listSkillFiles(SKILLS_DIR)) {
    const { frontmatter } = parseSkill(filePath);
    const domain = domainFromPath(filePath, SKILLS_DIR);
    const relPath = path.relative(REPO_ROOT, filePath).replaceAll(path.sep, '/');

    if (!domains[domain]) domains[domain] = [];
    domains[domain].push({
      name: frontmatter.name,
      path: relPath,
      description: frontmatter.description || '',
      navigateTo: frontmatter.navigateTo || '',
      auth: frontmatter.auth || { required: false, hint: '' },
      requiresBrowser: frontmatter.requiresBrowser || false,
      tags: frontmatter.tags || [],
      returns: frontmatter.returns || '',
    });
  }

  // Sort skills within each domain by name for stable output
  for (const domain of Object.keys(domains)) {
    domains[domain].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sort domain keys alphabetically for stable output
  const sorted = {};
  for (const key of Object.keys(domains).sort()) {
    sorted[key] = domains[key];
  }

  return {
    generatedAt: new Date().toISOString(),
    domains: sorted,
  };
}

function updateSkillDomains(allDomains) {
  const raw = fs.readFileSync(SKILL_FILE, 'utf8');

  // Rewrite inline <!-- DOMAINS:START -->...<!-- DOMAINS:END --> block
  const domainListText = allDomains.length > 0 ? allDomains.join(', ') : '(no skills yet)';
  let updated = raw.replace(
    /<!-- DOMAINS:START -->[\s\S]*?<!-- DOMAINS:END -->/,
    `<!-- DOMAINS:START -->${domainListText}<!-- DOMAINS:END -->`
  );

  // Rewrite supportedDomains: YAML array
  const arrayBlock = allDomains.length > 0
    ? `supportedDomains:\n${allDomains.map(d => `  - ${d}`).join('\n')}`
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
  const index = buildIndex();
  const indexJson = JSON.stringify(index, null, 2) + '\n';
  const indexChanged = writeIfChanged(INDEX_FILE, indexJson);

  const allDomains = Object.keys(index.domains);
  const skillCount = Object.values(index.domains).reduce((n, arr) => n + arr.length, 0);
  const updatedSkill = updateSkillDomains(allDomains);
  const skillChanged = writeIfChanged(SKILL_FILE, updatedSkill);

  console.log(`[generate-index] ${skillCount} skills across ${allDomains.length} domains`);
  console.log(`[generate-index] index.json ${indexChanged ? 'updated' : 'unchanged'}`);
  console.log(`[generate-index] SKILL.md ${skillChanged ? 'updated' : 'unchanged'}`);
}

main();
