---
name: browsing-skills
description: "Umbrella skill for a library of website-specific browsing skills. Use when the user's request targets one of these specific websites: <!-- DOMAINS:START -->linkedin.com, x.com<!-- DOMAINS:END -->. For supported sites: load the site-specific skill at skills/<domain>/SKILL.md from this repo, then follow its instructions. For unsupported sites: handle the request the normal way — don't force this skill. Each site's skill is also installable independently — if you only ever deal with one site, install that site's skill directly and skip this umbrella."
supportedDomains:
  - linkedin.com
  - x.com
---

# browsing-skills

An open-source library of website-specific browsing skills for AI agents. Each supported website is a first-class skill in this repo — the umbrella (this file) just lists what's available and tells you how to load the one you need.

Repo: https://github.com/tomer-van-cohen/browsing-skills

## When to use this umbrella

You're loaded into an agent that might work with *any* website. When the user mentions a specific site, you want to check: is there a prebuilt skill for it?

- **Supported site** (`<!-- DOMAINS:START -->linkedin.com, x.com<!-- DOMAINS:END -->`) → load the site's skill, follow its instructions.
- **Unsupported site** → handle the request the way you normally would.

## When to skip this umbrella

If your agent only ever interacts with one site (e.g. you're building a LinkedIn scraping tool), install that site's skill directly and forget this umbrella exists:

```
https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/skills/linkedin.com/SKILL.md
```

## How to load a site's skill

Fetch the raw SKILL.md for the domain the user mentioned:

```
GET https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/skills/<domain>/SKILL.md
```

Examples:
- `skills/x.com/SKILL.md`
- `skills/linkedin.com/SKILL.md`

Read the fetched skill's instructions and follow them. Each site skill tells you:
- Which actions are available (e.g. post extraction, profile extraction, search)
- The URL to navigate to for each action
- The JavaScript to execute, in a ```js``` code block
- Auth and browser requirements

## How site skills work (mental model)

A site skill is a markdown file with:

1. **Frontmatter** — machine-readable metadata (name, description, etc.)
2. **Body** — human-readable instructions for the agent, organized by action
3. **Fenced ```js``` code blocks** — the actual scripts to run in the browser via `page.evaluate()` (or the chrome-bridge `/wpm` endpoint if you don't have native browser access)

You don't need any custom tooling — fetch the file, read it, follow it.

## Browser access

Most skills require a real browser because target sites are JS-rendered. If your agent has browser access (Playwright, a Chrome extension, etc.), use it.

If you don't have browser access, the optional [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion is a tiny Chrome extension + local bridge that lets you run skills in the user's real Chrome tabs. Setup: under a minute.

## Reporting issues / requesting skills

- A skill is broken: https://github.com/tomer-van-cohen/browsing-skills/issues/new?template=skill-broken.md
- A site isn't supported yet: https://github.com/tomer-van-cohen/browsing-skills/issues/new?template=skill-request.md
- An existing skill needs more fields: https://github.com/tomer-van-cohen/browsing-skills/issues/new?template=skill-enhancement.md

## Contributing

See the [README](https://github.com/tomer-van-cohen/browsing-skills#contributing).
