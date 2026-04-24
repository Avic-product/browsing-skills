# browsing-skills

An open-source library of **per-website browser-automation skills** for AI agents. Each supported site is a first-class skill in standard [SKILL.md](https://docs.anthropic.com/en/docs/agents/skills) format — installable on its own or together as a bundle.

> **No browser?** If your agent doesn't already have browser access, see the optional [chrome-bridge/](./chrome-bridge) companion — a tiny Chrome extension + local bridge that lets any agent run skills in your real Chrome tabs.

## Two ways to install

### A. The umbrella (I want all supported sites)

Point your agent at the top-level [`SKILL.md`](./SKILL.md). It tells the agent which sites are supported and how to load each site's skill on demand:

```
https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/SKILL.md
```

This is the right choice if your agent might interact with any of the supported sites.

### B. A single site (I only care about one)

If you're building an agent that only ever works with one site, skip the umbrella — install that site's SKILL.md directly. For example, a LinkedIn-only agent:

```
https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/skills/linkedin.com/SKILL.md
```

This is leaner — no list of unrelated sites, no routing step. Each site is a complete, standalone skill.

## Repo layout

```
browsing-skills/
├── SKILL.md                     # umbrella — lists supported sites, routes agents
├── skills/
│   ├── linkedin.com/
│   │   └── SKILL.md             # linkedin skill (all linkedin actions in one file)
│   └── x.com/
│       └── SKILL.md             # x (twitter) skill (all x actions in one file)
├── chrome-bridge/               # optional browser-access companion
└── tools/                       # validation + umbrella regeneration
```

A site's `SKILL.md` is a complete, standalone skill that covers every action available for that site — search, extract, post, etc. Adding a new action means editing that file, not creating a new one.

## Contributing

To add a new supported site or improve an existing one:

1. Fork the repo, create a branch.
2. Add or edit `skills/<domain>/SKILL.md`.
3. Test your code against a real page (via [chrome-bridge](./chrome-bridge) or any browser automation you have).
4. Open a PR. CI validates frontmatter, JS syntax, and structure.
5. On merge to main, the umbrella `SKILL.md`'s supported-site list regenerates automatically.

### Site SKILL.md template

```markdown
---
name: browsing-<site>
description: "Use when the user wants to interact with <site> — <list the actions>. <auth/browser notes>."
---

# <site> — Browsing Skill

Short intro explaining which actions are covered.

## Requirements

Auth notes, browser notes, cookie injection snippets, etc.

## How to run any action

Shared execution pattern (page.evaluate / chrome-bridge /wpm).

---

## Action: <action-1>

**Navigate to:** `https://...`

**Code:**

​```js
({
  name: "<site>-<action-1>",
  description: "...",
  inputSchema: { ... },
  execute: function(params) { /* ... */ }
})
​```

**Returns:** `{ ... }`

---

## Action: <action-2>

...
```

### Conventions

- **One SKILL.md per site.** All actions for that site live in one file, each as its own section with a ```js``` code block. This keeps each skill a standalone unit.
- **The `description` in frontmatter is the trigger.** Agent frameworks match user intent against it. Be specific about what the skill does and when.
- **Skill code blocks** (`({ name, execute, ... })`) are validated by CI for JS syntax. Non-skill snippets (like cookie-injection examples) aren't validated — they're documentation.
- **Use `var`** (not `let`/`const`) for maximum compatibility in any browser.
- **Self-contained code** — no external imports, no CDN scripts.
- **WebMCP format** — each action is an object with `name`, `description`, `inputSchema`, and an `execute(params)` function. It returns `{ content: [{ type: "text", text: ... }] }`.

### Reporting broken or missing skills

Open a [GitHub issue](https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose) using one of the templates:
- **skill-broken** — a skill stopped working
- **skill-request** — a site not yet covered
- **skill-enhancement** — existing skill needs more actions or fields

## License

MIT — see [LICENSE](./LICENSE).
