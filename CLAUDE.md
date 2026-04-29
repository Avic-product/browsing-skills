# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A registry of per-website browser-automation skills in [Anthropic SKILL.md](https://docs.anthropic.com/en/docs/agents/skills) format. Each supported site is a standalone skill that an AI agent can fetch and execute. There is no runtime here — the repo ships markdown + JS snippets, plus tooling to validate and aggregate them.

## Commands

```bash
npm install                          # one-time, installs js-yaml for the tools
npm run validate                     # validate every skills/<domain>/SKILL.md
node tools/validate-skill.js skills/x.com/SKILL.md   # validate just one file
npm run generate-umbrella            # rewrite root SKILL.md's supported-site list
```

There is no test suite, no build step, no linter — `validate-skill.js` is the only correctness gate.

For the optional Chrome extension companion:

```bash
cd chrome-bridge/server && npm install && node bridge.js
# then load chrome-bridge/extension/ as an unpacked extension at chrome://extensions/
```

The `chrome-bridge/` package has its own `package.json` and is fully independent of the root project.

## Architecture

Three layers, top-down:

**1. Umbrella `SKILL.md` (repo root)** — the entry point an agent loads when it might deal with any site. Its frontmatter carries a `supportedDomains` list and its body has a `<!-- DOMAINS:START -->...<!-- DOMAINS:END -->` marker. Both are **auto-generated** from the contents of `skills/` — do not hand-edit them. Everything else in the umbrella is hand-written prose. When a user mentions a site in `supportedDomains`, the agent fetches `skills/<domain>/SKILL.md` from raw.githubusercontent.com and follows it; otherwise it falls back to default behavior.

**2. Per-site `skills/<domain>/SKILL.md`** — one file per site, covering every action for that site (post extraction, search, etc.). Each action has its own section in the body with: a "Navigate to:" URL, a fenced ```` ```js ```` code block, and a "Returns:" line. Adding a new action = adding a section to the existing file, not creating a new file.

**3. Code blocks inside the body** — each action's ```` ```js ```` block is a [WebMCP-shaped](https://wpm.rocks) expression: `({ name, description, inputSchema, execute(params) { ... } })`. `execute` runs in the page (via `page.evaluate`, chrome-bridge `/wpm`, or any other JS-injection mechanism) and returns `{ content: [{ type: "text", text: ... }] }`. A SKILL.md may also contain illustrative ```` ```js ```` blocks (e.g. cookie-injection examples) that aren't tools — see "validator heuristic" below.

### Tooling (`tools/`)

- `parse-skill.js` — shared library. Splits a SKILL.md into `{ frontmatter, body, jsCode }`. The exported `jsCode` is the **last** ```` ```js ```` block, but most callers should use `parseAllJsBlocks` from the validator instead since a single SKILL.md now holds many actions.
- `validate-skill.js` — runs by default on every `skills/<domain>/SKILL.md`. Validates: file lives at `skills/<domain>/SKILL.md`, frontmatter has `name` (kebab-case) and `description`, legacy `urlPatterns`/`navigateTo` fields are absent, at least one **skill block** is present, every skill block parses as JS.
  - **Skill-block heuristic:** a ```` ```js ```` block counts as a tool definition (and is syntax-checked) iff it matches both `^\s*\(\s*\{` and `\bexecute\b\s*:`. Non-matching blocks (cookie examples, prose) are ignored. If you add a new kind of executable block, make sure it matches both patterns or extend the heuristic.
- `generate-umbrella.js` — lists `skills/<domain>/` directories that contain a `SKILL.md`, then rewrites the root `SKILL.md`'s `<!-- DOMAINS -->` marker and `supportedDomains:` YAML list in-place. It does **not** generate any `index.json`; each site's SKILL.md is the source of truth.

### CI / automation

- `.github/workflows/validate-pr.yml` — runs `node tools/validate-skill.js` on every PR that touches `skills/`, `tools/`, or its own config.
- `.github/workflows/generate-umbrella.yml` — on push to `main`, regenerates the umbrella and auto-commits any change as `chore: regenerate umbrella SKILL.md`. This means **the umbrella will drift on `main` if you forget to run `generate-umbrella` locally** — the CI will fix it after merge.

## Conventions for skill code

These are repo-wide rules — follow them in every `skills/<domain>/SKILL.md` you add or edit:

- **One SKILL.md per site.** Every action for that site is a section in the same file. Don't split a site across multiple files.
- **`description` in frontmatter is the trigger.** Agent frameworks match user intent against it — be specific about what the skill does and when to use it.
- **Use `var`**, not `let`/`const`. Targets old browser environments where these snippets get injected.
- **Self-contained** — no `import`, no CDN scripts, no external dependencies. The block must run in a fresh page context.
- **Return shape** — `execute(params)` must return `{ content: [{ type: "text", text: ... }] }` (text is usually a stringified JSON object, but can be HTML when a `mode: "display"` param is supported).

## Adding a new site

1. Create `skills/<domain>/SKILL.md` following the template in `README.md`.
2. Run `npm run validate` — it must pass.
3. (Optional) Run `npm run generate-umbrella` to refresh the root `SKILL.md`. CI will do it on merge anyway.
4. Open a PR. The validate workflow gates merging.
