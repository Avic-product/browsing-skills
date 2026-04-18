# browsing-skills

An open-source registry of browser-automation skills for AI agents.

Each skill is a JavaScript snippet that runs inside a real browser via `page.evaluate()` to extract data or perform actions on a specific website — faster, more reliable, and cheaper (in tokens) than figuring out the site from scratch every time.

## For agents

If you're an AI agent (or configuring one), install this skill by pointing at:

```
https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/SKILL.md
```

That file tells you how to use the registry: fetch `index.json`, match URLs, pull skill files, execute the code.

## For humans

Browse the skills at [`skills/`](./skills). Each folder is a supported domain; each `.md` file is one skill.

Every skill file is self-contained:
- YAML frontmatter with metadata (name, URL patterns, auth requirements, etc.)
- A fenced ```js``` block with the executable code

## Contributing

Contributions are welcome! To add or fix a skill:

1. **Fork this repo** and create a branch.
2. **Add or edit a skill file** at `skills/<domain>/<skill-name>.md`. Follow the format in any existing skill.
3. **Test it** locally — run the code via a browser bridge (e.g. [browser-relay](https://github.com/tomer-van-cohen/browser-relay)) against a real page, confirm the output.
4. **Open a pull request.** CI will validate the skill structure (frontmatter, URL patterns, JS syntax). A maintainer will review and merge.
5. On merge, `index.json` and `SKILL.md` auto-regenerate — no manual edits needed.

### Skill file template

```markdown
---
name: site-action-name
description: One-sentence description of what it does
urlPatterns:
  - https://www.example.com/path/*
auth:
  required: false
  hint: ""
requiresBrowser: true
tags: [example, extractor]
returns: "{ field1, field2 }"
---

# site-action-name

Longer description. Document what the skill extracts or does, and what fields are returned.

## Code

​```js
({
  name: "site-action-name",
  description: "What this tool extracts",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    // extraction logic
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
})
​```
```

### Rules for skill code

- **Self-contained** — no external imports, no CDN scripts.
- **Use `var`** (not `let`/`const`) for maximum browser compatibility.
- **WebMCP format** — an object with `name`, `description`, `inputSchema`, and an `execute(params)` function.
- **Can return Promises** for async operations (scrolling, waiting for elements).
- **Set `requiresBrowser: true`** if the site blocks headless browsers.
- **Set `auth.required: true`** if the site requires login — include a `hint` explaining which cookie/token the user needs to provide.

### Reporting broken or missing skills

Open a [GitHub issue](https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose) using one of the templates:
- **skill-broken** — a skill stopped working
- **skill-request** — a site/action not yet covered
- **skill-enhancement** — existing skill needs more fields

## How it works

```
┌─────────┐    1. fetch index     ┌──────────────────┐
│  Agent  │ ────────────────────► │   GitHub (raw)   │
│         │ ◄──────────────────── │  index.json      │
└─────────┘    2. match URL       └──────────────────┘
     │
     │         3. fetch skill
     ▼
┌─────────────────────────────────────┐
│  skills/linkedin.com/post-data.md   │
│  ─ frontmatter                      │
│  ─ ```js  …  ```                    │
└─────────────────────────────────────┘
     │
     │         4. extract code + execute
     ▼
┌───────────────┐
│ page.evaluate │  ← real browser
└───────────────┘
```

No server. No database. No auth. Just markdown files and git.

## License

MIT — see [LICENSE](./LICENSE).
