# browsing-skills

An open-source library of **website-specific browser automation skills** for AI agents.

Each supported website is packaged as a standard [SKILL.md](https://docs.anthropic.com/en/docs/agents/skills) skill. Agents can install the whole library through the umbrella skill, or install a single site skill when they only need one website.

> **Need browser access?** Most modern sites are JavaScript-rendered and require a real browser. Use your agent's browser integration, Playwright, or the optional [chrome-bridge/](./chrome-bridge) companion to run actions inside Chrome.

## Why

General browser agents can use any website, but they often spend a lot of time and context rediscovering the same page structure: inspecting DOM snippets, guessing selectors, running extraction code, and repairing mistakes. This library packages that site knowledge once, as small action references agents can load only when needed. With a skill, the agent does not need to research the live DOM or invent selectors; after navigating to the right page, it can run the maintained action code in one page-context execution call (`page.evaluate()` or Chrome Bridge `/run-action`).

We benchmark each action against a no-skill browser agent and track both **time** and **tokens** in [BENCHMARKS.md](./BENCHMARKS.md). In one Booking.com search benchmark, the skill path used **3,903 tokens** and finished in **~9.5s**, while the no-skill DOM-inspection loop used **49,290 tokens** and took **~82.5s**. The skill also returned cleaner structured result cards, while the no-skill run was noisier and missed fields.

## Supported Websites

The library currently includes skills for:

| Website | Skill |
|---|---|
| Reddit | [`skills/reddit.com`](./skills/reddit.com) |
| X | [`skills/x.com`](./skills/x.com) |
| LinkedIn | [`skills/linkedin.com`](./skills/linkedin.com) |
| TikTok | [`skills/tiktok.com`](./skills/tiktok.com) |
| Facebook | [`skills/facebook.com`](./skills/facebook.com) |
| Booking.com | [`skills/booking.com`](./skills/booking.com) |
| Airbnb | [`skills/airbnb.com`](./skills/airbnb.com) |

## Two ways to install

### A. The umbrella (I want all supported sites)

Point your agent at the top-level [`SKILL.md`](./SKILL.md). It tells the agent which sites are supported and how to load each site's skill on demand:

```
https://raw.githubusercontent.com/browsing-skills/browsing-skills/main/SKILL.md
```

This is the right choice if your agent might interact with any of the supported sites.

### B. A single site (I only care about one)

If you're building an agent that only ever works with one site, skip the umbrella — install that site's SKILL.md directly. For example, a LinkedIn-only agent:

```
https://raw.githubusercontent.com/browsing-skills/browsing-skills/main/skills/linkedin.com/SKILL.md
```

This is leaner — no list of unrelated sites, no routing step. Each site is a complete, standalone skill.

## Repo layout

```
browsing-skills/
├── SKILL.md                     # umbrella — lists supported sites, routes agents
├── skills/
│   ├── linkedin.com/
│   │   ├── SKILL.md             # linkedin action index
│   │   └── references/
│   │       └── post-data.md     # one action spec + JS
│   └── x.com/
│       ├── SKILL.md             # x (twitter) action index
│       └── references/
│           ├── post-data.md     # one action spec + JS
│           ├── profile-data.md  # one action spec + JS
│           └── search.md        # one action spec + JS
├── chrome-bridge/               # optional browser-access companion
└── tools/                       # validation + umbrella regeneration
```

A site's `SKILL.md` is a compact action index. Each action's requirements, navigation instructions, code block, and return shape live in a separate file under `skills/<domain>/references/`, so agents can load only the action they need. Adding a new action means updating the index and adding one action-specific reference file.

## How actions run

Reference files contain self-contained JavaScript action objects. Once the target page is loaded, run the action in the page context with `page.evaluate()` or Chrome Bridge's `/run-action` endpoint:

```js
var result = await page.evaluate(async function(code) {
  var tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);
```

Actions return:

```js
{ content: [{ type: "text", text: "..." }] }
```

The `text` value is usually JSON, but some actions also support `mode: "display"` for self-contained HTML output.

## Contributing

To add a new supported site or improve an existing one:

1. Fork the repo, create a branch.
2. Add or edit `skills/<domain>/SKILL.md` and `skills/<domain>/references/*.md`.
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

Use this index to choose the <site> action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **<action-1>** — Short explanation of when to use this action. Full spec: [references/<action-1>.md](references/<action-1>.md).
- **<action-2>** — Short explanation of when to use this action. Full spec: [references/<action-2>.md](references/<action-2>.md).
```

Put each full action specification in its own file under `skills/<domain>/references/`:

````markdown
# <site> — <action-1> Reference

## Requirements

Auth notes, browser notes, cookie injection snippets, etc.

## How to run this action

Shared execution pattern (page.evaluate / chrome-bridge `/run-action`).

---

## Action: <action-1>

**Navigate to:** `https://...`

**Code:**

```js
({
  name: "<site>-<action-1>",
  description: "...",
  inputSchema: { ... },
  execute: function(params) { /* ... */ }
})
```

**Returns:** `{ ... }`
````

### Conventions

- **One SKILL.md index per site.** The site `SKILL.md` lists available actions with short explanations and links to full specs under `references/`.
- **One reference file per action.** Put navigation instructions, auth/browser requirements, the executable ```js``` block, and the return shape for one action in `skills/<domain>/references/<action>.md`.
- **The `description` in frontmatter is the trigger.** Agent frameworks match user intent against it. Be specific about what the skill does and when.
- **Action code blocks** (`({ name, execute, ... })`) are validated by CI for JS syntax. Non-action snippets (like cookie-injection examples) aren't validated — they're documentation.
- **Use `var`** (not `let`/`const`) for maximum compatibility in any browser.
- **Self-contained code** — no external imports, no CDN scripts.
- **Action object format** — each action is an object with `name`, `description`, `inputSchema`, and an `execute(params)` function. It returns `{ content: [{ type: "text", text: ... }] }`.

### Security and privacy

- Do not commit cookies, API keys, session tokens, or personal browser profile paths.
- Keep examples generic. If an action requires authentication, document the requirement without including real account data.
- Chrome Bridge runs code in real browser tabs. Review action code before running it on logged-in sessions, and keep write actions explicitly opt-in.

### Reporting broken or missing skills

Open a [GitHub issue](https://github.com/browsing-skills/browsing-skills/issues/new/choose) using one of the templates:
- **skill-broken** — a skill stopped working
- **skill-request** — a site not yet covered
- **skill-enhancement** — existing skill needs more actions or fields

## License

MIT — see [LICENSE](./LICENSE).
