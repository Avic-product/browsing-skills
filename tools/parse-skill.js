import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// Parse a skill markdown file into { frontmatter, body, jsCode }.
// Throws on malformed input.
export function parseSkill(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`${filePath}: missing YAML frontmatter (expected file to start with ---)`);
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(fmMatch[1]);
  } catch (e) {
    throw new Error(`${filePath}: invalid YAML frontmatter — ${e.message}`);
  }
  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error(`${filePath}: frontmatter must be a YAML object`);
  }

  const body = fmMatch[2];

  // Find the last ```js ... ``` fenced block (the code)
  const codeMatches = [...body.matchAll(/```js\n([\s\S]*?)\n```/g)];
  if (codeMatches.length === 0) {
    throw new Error(`${filePath}: missing \`\`\`js code block`);
  }
  const jsCode = codeMatches[codeMatches.length - 1][1];

  return { frontmatter, body, jsCode };
}

// Extract unique domains from a list of URL patterns.
export function extractDomains(urlPatterns) {
  const set = new Set();
  for (const pattern of urlPatterns || []) {
    const m = String(pattern).match(/:\/\/([^/]+)/);
    if (!m) continue;
    let host = m[1].replace(/^\*\./, '').replace(/^www\./, '');
    if (host) set.add(host);
  }
  return [...set].sort();
}

// Walk skills/ and return array of file paths.
export function listSkillFiles(skillsDir) {
  const out = [];
  if (!fs.existsSync(skillsDir)) return out;
  for (const domain of fs.readdirSync(skillsDir)) {
    const domainDir = path.join(skillsDir, domain);
    if (!fs.statSync(domainDir).isDirectory()) continue;
    for (const file of fs.readdirSync(domainDir)) {
      if (file.endsWith('.md')) {
        out.push(path.join(domainDir, file));
      }
    }
  }
  return out.sort();
}
