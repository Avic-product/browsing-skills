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

## With-Skill Run

Give the model:

- the task
- the target URL/query
- the relevant site `SKILL.md`
- only the chosen action reference file
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
- reasoning tokens if the API reports them
- number of API calls
- wall time from branch start to final answer
- browser/tool calls
- final result summary
- result quality notes

Token counts should come from API `usage` whenever available. If using local estimates, clearly label them as estimates and state what is excluded.

## Fairness Rules

- Use the same target and success criteria for both branches.
- Use the same browser/page state unless explicitly comparing browser state.
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
