# API Benchmark Protocol

This protocol formalizes the current `browsing-skills` benchmark method.

## Benchmark Goal

Measure whether a maintained browsing skill reduces:

- OpenAI API tokens
- wall-clock time
- API calls
- browser/tool calls
- selector-repair loops
- extraction errors

The benchmark is not only about speed. A lower-token result that misses required fields is a worse result.

## Required Inputs

Before running, define:

- `domain`: site directory, such as `booking.com` or `x.com`
- `action`: action reference name, such as `search` or `hotel-data`
- `target`: exact URL, search query, or navigation recipe
- `browserLayer`: Playwright, Chrome Bridge `/run-action`, or another page execution layer
- `successCriteria`: required fields and quality checks
- `samePageState`: login state, currency, viewport, locale, cookies/profile assumptions, and wait strategy

Use the same browser layer and page state for both runs unless the benchmark explicitly compares browser layers.

## Browser Layer Selection

Prefer the browser layer that matches the real action's expected production use.

- Use **Chrome Bridge `/run-action`** when the action depends on an existing user session, login, account state, location, cart state, personalization, anti-bot trust, or anything else that normally lives in the user's Chrome profile.
- Use **Playwright** when the action is public and unauthenticated, or when you intentionally create and document an equivalent browser profile/cookie jar for both branches.
- Do not compare a logged-in Chrome Bridge with-skill run against a fresh Playwright no-skill run, or the reverse, unless the benchmark is explicitly about browser-layer differences.
- If the browser layer differs from the action's normal expected use, mark the benchmark as limited and explain what state may be missing.

For many social, marketplace, booking, cart, and account-adjacent actions in this repo, Chrome Bridge is the fair default because it preserves the user's real session.

## With-Skill Run

Give the model:

- the task
- the target URL/query
- the relevant site `SKILL.md`
- only the chosen action reference file, trimmed to the action-facing spec
- access to the same browser layer used by the baseline

The with-skill run should:

1. choose the action from the index
2. navigate to the right page
3. execute the maintained action object in one page-context call:
   - Playwright: `page.evaluate(...)`
   - Chrome Bridge: `POST /run-action`
4. parse the action result
5. return concise structured output

Do not give the with-skill model unrelated action references. Progressive disclosure is part of the benchmark.

### Action-Facing Spec

The measured with-skill branch should receive only what a normal agent needs to execute the action:

- action name and short purpose
- navigation requirements
- input schema / required params
- the executable action object or the already-registered action name
- return shape and success criteria

Exclude benchmark history, prior benchmark tables, maintenance notes, unrelated examples, README prose, and the benchmarking protocol itself from the measured prompt. If the full markdown file is injected verbatim, report that as a separate **full-doc load** measurement, not the primary action benchmark.

If using Chat Completions or another multi-turn API loop, remember that the original messages are usually counted again on later calls. A 3k-token reference sent through a 3-call loop can add about 9k prompt tokens. Log per-call usage so this multiplication is visible.

## Without-Skill Run

Give the model:

- the same task
- the same target URL/query
- browser access
- no site skill, no action reference, and no copied selectors from the skill

The without-skill run should behave like a general browser agent:

1. inspect live text, DOM snippets, attributes, or selectors
2. write extraction logic
3. execute it in the page
4. inspect/repair if required fields are missing
5. stop when success criteria are met or a timeout/iteration limit is reached

This is the realistic baseline: the agent spends context and time discovering the page structure.

## API Measurement Setup

Use separate API keys or projects when possible:

- `OPENAI_KEY_WITH_SKILL`
- `OPENAI_KEY_WITHOUT_SKILL`

This makes dashboard and cost attribution easier. Never commit keys or `.env` files.

For each branch, record:

- model name
- prompt token count
- completion token count
- total token count
- per-call token usage
- reasoning tokens if the API reports them
- number of API calls
- wall time from branch start to final answer
- browser/tool calls
- final result summary
- result quality notes

Token counts should come from API `usage` whenever available. If using local estimates, clearly label them as estimates and state what is excluded.

Persist a local ignored run log when possible, including each request payload, response usage object, tool call, browser response size, and timing. Do not commit logs that contain API keys, cookies, personal account data, or page content that should stay private.

## Freshness And Provenance

Existing benchmark sections are historical context only. Never copy existing numbers into a new benchmark result.

A fresh benchmark must include newly captured:

- API `usage` objects or totals for both branches
- per-call API usage for both branches, when available
- branch start/end timestamps or measured wall time
- browser layer used by each branch
- browser/tool call counts
- final result summaries for both branches
- model name and any relevant profile/session assumptions

If any of these are missing, label the result as not run or limited instead of updating official benchmark tables.

## Fairness Rules

- Use the same target and success criteria for both branches.
- Use the same browser/page state unless explicitly comparing browser state.
- Use the same browser layer unless explicitly comparing browser layers.
- Run branches close together in time for live sites.
- Do not let the no-skill run read the skill, reference file, or selector code.
- Do not count failed harness/setup attempts as benchmark evidence.
- Separate model-planning/API time from browser wait time when useful, but report total wall time.
- Report result quality alongside tokens/time.

## Result Quality Rubric

Use these labels:

- **Complete:** all required fields present and correctly structured.
- **Partial:** core success signal found, but important fields are missing/noisy.
- **Malformed:** output shape is wrong or cannot be reliably parsed.
- **Failed:** no usable result, blocked page, timeout, or execution error.
- **Blocked:** benchmark cannot safely or legally run without a fixture, login, or explicit approval.

Prefer a short note explaining the concrete gap, such as: "confirmed tracked room block, but missed room names and policies."

## Recording Results

Update all three places:

1. `BENCHMARKS.md`
   - target
   - browser layer
   - benchmark table
   - observed result quality
   - notes about fairness or limitations

2. `skills/<domain>/SKILL.md`
   - compact row: `tokens / ~seconds`
   - short quality note

3. `skills/<domain>/references/<action>.md`
   - `## Benchmark` section
   - with-skill summary
   - without-skill summary
   - comparison sentence

## Recommended Output Template

```markdown
### <Site> <action>

- **Target:** `<target>`
- **Browser layer:** <Playwright/Chrome Bridge/etc.>
- **Captured at:** <ISO timestamp>
- **Success criteria:** <required fields>

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill | <tokens> | <calls> | ~<seconds>s | <Complete/Partial/etc.> |
| Without skill | <tokens> | <calls> | ~<seconds>s | <Complete/Partial/etc.> |

Observed result quality:

- **With skill:** <short concrete summary>
- **Without skill:** <short concrete summary>

Notes:

- <fairness limitation or live-site caveat>
```

## When To Use Subagents

Use subagents for quick qualitative exploration or parallel dry runs when exact token accounting is not critical.

For official benchmark numbers, use API-separated runs. API usage is the source of truth for tokens and cost.
