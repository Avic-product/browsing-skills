#!/usr/bin/env node
// Validates skill files. Pass file paths as args, or no args to validate all.
// Exits with code 1 if any validation fails.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import picomatch from 'picomatch';
import { parseSkill, extractDomains, listSkillFiles } from './parse-skill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const KEBAB_RE = /^[a-z0-9][a-z0-9-]*$/;
const REQUIRED_FIELDS = ['name', 'description', 'urlPatterns'];

function validateOne(filePath) {
  const errors = [];
  let parsed;
  try {
    parsed = parseSkill(filePath);
  } catch (e) {
    return [e.message];
  }
  const { frontmatter, jsCode } = parsed;

  for (const field of REQUIRED_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === null) {
      errors.push(`missing required field: ${field}`);
    }
  }

  if (frontmatter.name && !KEBAB_RE.test(frontmatter.name)) {
    errors.push(`name must be kebab-case (got "${frontmatter.name}")`);
  }

  if (frontmatter.urlPatterns) {
    if (!Array.isArray(frontmatter.urlPatterns) || frontmatter.urlPatterns.length === 0) {
      errors.push('urlPatterns must be a non-empty array');
    } else {
      for (const pattern of frontmatter.urlPatterns) {
        if (typeof pattern !== 'string' || !pattern.includes('://')) {
          errors.push(`invalid URL pattern: ${JSON.stringify(pattern)}`);
          continue;
        }
        try {
          picomatch(pattern);
        } catch (e) {
          errors.push(`URL pattern not a valid glob: "${pattern}" (${e.message})`);
        }
      }
    }
  }

  // File path must be under skills/<domain>/ and the domain must match at least one URL pattern domain.
  const rel = path.relative(SKILLS_DIR, filePath);
  const segments = rel.split(path.sep);
  if (segments.length !== 2) {
    errors.push(`file must live at skills/<domain>/<name>.md (got skills/${rel})`);
  } else {
    const folderDomain = segments[0];
    const patternDomains = extractDomains(frontmatter.urlPatterns || []);
    if (patternDomains.length > 0 && !patternDomains.includes(folderDomain)) {
      errors.push(
        `folder domain "${folderDomain}" does not match any urlPatterns domain (${patternDomains.join(', ')})`
      );
    }
  }

  if (frontmatter.auth !== undefined) {
    if (typeof frontmatter.auth !== 'object' || frontmatter.auth === null) {
      errors.push('auth must be an object');
    } else if (typeof frontmatter.auth.required !== 'boolean') {
      errors.push('auth.required must be a boolean');
    }
  }

  if (frontmatter.requiresBrowser !== undefined && typeof frontmatter.requiresBrowser !== 'boolean') {
    errors.push('requiresBrowser must be a boolean');
  }

  if (frontmatter.tags !== undefined && !Array.isArray(frontmatter.tags)) {
    errors.push('tags must be an array');
  }

  // JS syntax check: wrap in a function and parse.
  try {
    new Function(`return (${jsCode});`);
  } catch (e) {
    errors.push(`JS code has syntax error: ${e.message}`);
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : listSkillFiles(SKILLS_DIR);

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
