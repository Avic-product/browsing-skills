#!/usr/bin/env node
// Validates site SKILL.md files under skills/<domain>/SKILL.md.
// Pass file paths as args, or no args to validate all.
// Exits with code 1 if any validation fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkill } from './parse-skill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const KEBAB_RE = /^[a-z0-9][a-z0-9-]*$/;

function listSiteSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const out = [];
  for (const name of fs.readdirSync(SKILLS_DIR)) {
    const dir = path.join(SKILLS_DIR, name);
    const skillFile = path.join(dir, 'SKILL.md');
    if (fs.statSync(dir).isDirectory() && fs.existsSync(skillFile)) {
      out.push(skillFile);
    }
  }
  return out.sort();
}

function parseAllJsBlocks(body) {
  return [...body.matchAll(/```js\n([\s\S]*?)\n```/g)].map(m => m[1]);
}

function validateOne(filePath) {
  const errors = [];

  // File must live at skills/<domain>/SKILL.md
  const rel = path.relative(SKILLS_DIR, filePath);
  const segments = rel.split(path.sep);
  if (segments.length !== 2 || segments[1] !== 'SKILL.md') {
    errors.push(`file must live at skills/<domain>/SKILL.md (got skills/${rel})`);
  }

  let frontmatter, body;
  try {
    ({ frontmatter, body } = parseSkill(filePath));
  } catch (e) {
    return [e.message];
  }

  // Required frontmatter
  for (const field of ['name', 'description']) {
    if (!frontmatter[field] || typeof frontmatter[field] !== 'string') {
      errors.push(`missing or non-string frontmatter field: ${field}`);
    }
  }

  if (frontmatter.name && !KEBAB_RE.test(frontmatter.name)) {
    errors.push(`name must be kebab-case (got "${frontmatter.name}")`);
  }

  // Reject legacy fields
  if (frontmatter.urlPatterns !== undefined) {
    errors.push('urlPatterns is no longer supported — the skill body documents which URLs to use.');
  }
  if (frontmatter.navigateTo !== undefined) {
    errors.push('navigateTo in frontmatter is no longer used — document the URL in the body near each action.');
  }

  // Find the executable skill-code blocks (WebMCP tool expressions).
  // Convention: blocks that start with `({` and contain `execute` are skill code;
  // other ```js``` blocks are illustrative snippets and aren't syntax-checked.
  const jsBlocks = parseAllJsBlocks(body);
  const skillBlocks = jsBlocks
    .map((code, i) => ({ code, i }))
    .filter(({ code }) => /^\s*\(\s*\{/.test(code) && /\bexecute\b\s*:/.test(code));

  if (skillBlocks.length === 0) {
    errors.push('skill body must contain at least one WebMCP ```js``` block (an expression starting with `({` and defining an `execute` function)');
  }

  for (const { code, i } of skillBlocks) {
    try {
      new Function(`return (${code});`);
    } catch (e) {
      errors.push('```js``` block #' + (i + 1) + ': syntax error — ' + e.message);
    }
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : listSiteSkills();

  let failed = 0;
  for (const file of files) {
    const errors = validateOne(file);
    const rel = path.relative(REPO_ROOT, file);
    if (errors.length === 0) {
      console.log(`✓ ${rel}`);
    } else {
      failed++;
      console.log(`✗ ${rel}`);
      for (const err of errors) console.log(`  - ${err}`);
    }
  }

  if (failed > 0) {
    console.log(`\n${failed} skill(s) failed validation.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${files.length} skill(s) passed.`);
  }
}

main();
