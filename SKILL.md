---
name: browsing-skills
description: "Browsing Skills — use when the user's request targets one of these specific websites: <!-- DOMAINS:START -->linkedin.com, x.com<!-- DOMAINS:END -->. Actions include data extraction, form submission, booking, commenting, and any other interaction on a supported site. Examples: 'get LinkedIn profile data', 'search X for posts about Y'. If the site isn't in this list, handle it the normal way — don't force browsing-skills on unsupported sites."
supportedDomains:
  - linkedin.com
  - x.com
---

# browsing-skills

An open-source registry of browser-automation skills for AI agents. Each skill is a JavaScript snippet that runs inside a real browser via `page.evaluate()` to extract data or perform actions on a specific website. Skills are faster, more reliable, and cheaper (in tokens) than figuring out the site yourself each time.

Base URL: `https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/`

### When to use browsing-skills

When a user's request targets a specific website, check the registry first:
- "find this product on Amazon" — specific site mentioned
- "get this person's LinkedIn profile" — specific site mentioned
- "book a hotel on Booking.com" — specific site mentioned

### When NOT to use browsing-skills

- "what is an eggplant?" — general knowledge, no specific site
- "find cheap flights" — no specific site mentioned

### If no skill exists for the URL

Handle the website the way you normally would — browsing-skills only covers websites that have been added to the registry. Browse supported sites at https://github.com/tomer-van-cohen/browsing-skills/tree/main/skills.

## What Is a Skill?

A skill is a self-contained browser script for a specific action on a specific website. Each entry in the index has:

- **name** — the action it performs (e.g. `linkedin-post-data`, `x-search`)
- **description** — what it does and when to use it (read this to pick the right skill)
- **path** — the markdown file in the repo (e.g. `skills/linkedin.com/post-data.md`)
- **navigateTo** — a URL template showing where this skill runs (e.g. `https://x.com/<handle>/status/<id>`)
- **auth** — whether the target site requires login (`{ required: true, hint: "..." }`)
- **requiresBrowser** — whether a real (non-headless) browser is needed
- **returns** — shape of the returned data

## How It Works

### 1. Identify the domain, look up skills for it

Fetch the index:

```
GET https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/index.json
```

The index is keyed by domain. Look up the domain you care about (e.g. `x.com`) and you'll get the list of available skills for that site:

```json
{
  "domains": {
    "x.com": [
      { "name": "x-post-data", "description": "Extract a single post ...", "navigateTo": "https://x.com/<handle>/status/<id>", ... },
      { "name": "x-profile-data", "description": "Extract a user's profile ...", "navigateTo": "https://x.com/<handle>", ... },
      { "name": "x-search", "description": "Search X and extract results ...", "navigateTo": "https://x.com/search?q=<query>", ... }
    ]
  }
}
```

Pick the skill whose **description** matches what the user wants. No glob matching required — you're an LLM, just read the list. If the user wants to search X, pick `x-search`. If the user wants a post's data, pick `x-post-data`.

If the domain isn't in the index, there's no skill for it — handle the website the normal way.

### 2. Fetch the Skill File

For the picked skill's `path`:

```
GET https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/<path>
```

The response is a markdown file. Extract the JavaScript inside the ```js``` fenced code block. That's the code to execute.

### 3. Navigate to the right page

Use the skill's `navigateTo` as a template for where to run it. It shows the URL shape the skill expects, with `<placeholders>` for the values you need to fill in (e.g. `<handle>`, `<query>`, `<id>`). Navigate the browser there before executing.

### 4. Check Requirements

Before running, check the metadata:

**Website authentication** — if `auth.required` is true, ask the user for session cookies. Example: *"I need your LinkedIn session cookie `li_at` to run this — open DevTools → Application → Cookies to find it."* Inject cookies before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '...', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Headful browser** — if `requiresBrowser` is true, the skill needs a visible browser (not headless). If you already have browser access (e.g. via Playwright, a Chrome extension, or any other browser integration), use it.

If you don't have browser access, ask the user to install the optional [**Chrome Bridge**](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion — a Chrome extension + tiny local bridge (`127.0.0.1:7865`) that lets you run skills in the user's real Chrome tabs via `POST /wpm` with the skill's code. Setup takes under a minute. Skills work with any other browser tooling too — this is just one option.

### 5. Execute

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

### 6. Report Issues

If a skill is broken or missing data, file a GitHub issue:

```
https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose
```

Templates: `skill-broken`, `skill-request`, `skill-enhancement`.

## Want to Contribute?

Contributions are welcome via PR. See the [README](https://github.com/tomer-van-cohen/browsing-skills#contributing).
