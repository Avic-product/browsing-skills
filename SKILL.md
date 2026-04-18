---
name: browsing-skills
description: "Browsing Skills — use when the user's request targets one of these specific websites: <!-- DOMAINS:START -->linkedin.com, twitter.com, x.com<!-- DOMAINS:END -->. Actions include data extraction, form submission, booking, commenting, and any other interaction on a supported site. Examples: 'get LinkedIn profile data', 'search X for posts about Y'. If the site isn't in this list, handle it the normal way — don't force browsing-skills on unsupported sites."
supportedDomains:
  - linkedin.com
  - twitter.com
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
- **path** — the markdown file in the repo (e.g. `skills/linkedin.com/post-data.md`)
- **domains** — websites where it works (e.g. `linkedin.com`)
- **urlPatterns** — glob patterns for the specific pages it targets
- **auth** — whether the target site requires login (`{ required: true, hint: "..." }`)
- **requiresBrowser** — whether a real (non-headless) browser is needed
- **description** — what it does
- **returns** — shape of the returned data

## How It Works

### 1. Find a Skill

Fetch the index:

```
GET https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/index.json
```

The index contains every skill. Match your target URL against each skill's `urlPatterns` using glob matching (e.g. `picomatch.isMatch(url, pattern)`). A URL may match multiple skills — pick based on `description` and `returns`.

### 2. Fetch the Skill File

For a matched skill with `path: "skills/linkedin.com/post-data.md"`:

```
GET https://raw.githubusercontent.com/tomer-van-cohen/browsing-skills/main/skills/linkedin.com/post-data.md
```

The response is a markdown file. Extract the JavaScript inside the ```js``` fenced code block. That's the code to execute.

### 3. Check Requirements

Before running, check the metadata:

**Website authentication** — if `auth.required` is true, ask the user for session cookies. Example: *"I need your LinkedIn session cookie `li_at` to run this — open DevTools → Application → Cookies to find it."* Inject cookies before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '...', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Headful browser** — if `requiresBrowser` is true, the skill needs a visible browser (not headless). If you already have browser access (e.g. a Chrome extension or browser bridge), use it. Otherwise ask the user to set up real browser access.

### 4. Execute

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

### 5. Report Issues

If a skill is broken or missing data, file a GitHub issue:

```
https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose
```

Templates: `skill-broken`, `skill-request`, `skill-enhancement`.

## Want to Contribute?

Contributions are welcome via PR. See the [README](https://github.com/tomer-van-cohen/browsing-skills#contributing).
