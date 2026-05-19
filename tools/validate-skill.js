#!/usr/bin/env node
// Validates site SKILL.md files under skills/<domain>/SKILL.md.
// The site file is an action index; full executable specs live under
// skills/<domain>/references/*.md.
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

function listReferenceFiles(siteDir) {
  const referencesDir = path.join(siteDir, 'references');
  if (!fs.existsSync(referencesDir)) return [];
  return fs
    .readdirSync(referencesDir)
    .filter(name => name.endsWith('.md'))
    .map(name => path.join(referencesDir, name))
    .sort();
}

function parseReferenceLinks(body, siteDir) {
  return [...body.matchAll(/\]\((references\/[^)#\s]+\.md)(?:#[^)]+)?\)/g)]
    .map(match => path.join(siteDir, match[1]));
}

function collectSkillBlocks(files) {
  const blocks = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const jsBlocks = parseAllJsBlocks(raw);
    for (let i = 0; i < jsBlocks.length; i++) {
      const code = jsBlocks[i];
      if (/^\s*\(\s*\{/.test(code) && /\bexecute\b\s*:/.test(code)) {
        blocks.push({ code, file, i });
      }
    }
  }
  return blocks;
}

function countSkillBlocks(file) {
  return collectSkillBlocks([file]).length;
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

  const indexSkillBlocks = parseAllJsBlocks(body)
    .filter(code => /^\s*\(\s*\{/.test(code) && /\bexecute\b\s*:/.test(code));
  if (indexSkillBlocks.length > 0) {
    errors.push('site SKILL.md must be an action index only; move executable action-object ```js``` blocks to references/');
  }

  const siteDir = path.dirname(filePath);
  const referenceFiles = listReferenceFiles(siteDir);
  const referenceLinks = parseReferenceLinks(body, siteDir);

  if (referenceFiles.length === 0) {
    errors.push('site must have at least one markdown reference file under references/');
  }

  if (referenceLinks.length === 0) {
    errors.push('site SKILL.md must link to at least one action reference file under references/');
  }

  const referenceFileSet = new Set(referenceFiles);
  const referenceLinkSet = new Set(referenceLinks);

  for (const linkedFile of referenceLinkSet) {
    if (!fs.existsSync(linkedFile)) {
      const relLinked = path.relative(REPO_ROOT, linkedFile);
      errors.push('site SKILL.md links to missing reference file: ' + relLinked);
    }
  }

  for (const referenceFile of referenceFileSet) {
    if (!referenceLinkSet.has(referenceFile)) {
      const relRef = path.relative(REPO_ROOT, referenceFile);
      errors.push(relRef + ' is not linked from the site SKILL.md action index');
    }
  }

  for (const referenceFile of referenceFiles) {
    if (countSkillBlocks(referenceFile) === 0) {
      const relRef = path.relative(REPO_ROOT, referenceFile);
      errors.push(relRef + ' must contain at least one executable action-object ```js``` block');
    }
  }

  // Find executable action-code blocks (action object expressions) in references.
  // Convention: blocks that start with `({` and contain `execute` are action code;
  // other ```js``` blocks are illustrative snippets and aren't syntax-checked.
  const skillBlocks = collectSkillBlocks(referenceFiles);

  if (skillBlocks.length === 0) {
    errors.push('references must contain at least one action-object ```js``` block (an expression starting with `({` and defining an `execute` function)');
  }

  for (const { code, file, i } of skillBlocks) {
    try {
      new Function(`return (${code});`);
    } catch (e) {
      const relRef = path.relative(REPO_ROOT, file);
      errors.push(relRef + ' ```js``` block #' + (i + 1) + ': syntax error — ' + e.message);
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
