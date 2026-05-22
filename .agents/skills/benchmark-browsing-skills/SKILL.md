---
name: benchmark-browsing-skills
description: Use when benchmarking browsing-skills actions, comparing a maintained site skill against a no-skill browser agent, measuring OpenAI API token usage, wall time, API calls, browser/tool calls, and result quality. Trigger whenever the user asks to benchmark a browsing skill, compare with/without skill, measure token or time savings, or update benchmark tables in this repo.
---

# Benchmark Browsing Skills

Use this skill to run and document fair benchmarks for actions in this repo.

The benchmark compares two agents on the same live browser task:

- **With skill:** loads the site action index plus only the action-facing parts of one action reference, then runs the maintained action code.
- **Without skill:** receives browser access but no skill/reference, inspects the live page, derives extraction logic, and iterates until success or timeout.

For official numbers, prefer OpenAI API-separated runs over Codex subagents. Subagents are useful for quick qualitative comparisons, but API runs give explicit token accounting and cleaner cost comparison.

Use the same browser layer and session state for both branches. For actions that depend on login, personalization, region, cart state, or existing cookies, prefer Chrome Bridge `/run-action` against the user's loaded Chrome session. Use Playwright only for public, unauthenticated actions or when you intentionally create an equivalent browser profile for both branches.

## Workflow

1. Identify the website, action, target URL/query, browser layer, expected output fields, session requirements, and success criteria.
2. Read only the matching site `SKILL.md` and action reference from `skills/<domain>/references/<action>.md`; exclude benchmark history and other non-action prose from the measured with-skill prompt.
3. Run the **with-skill** API pass with the skill index/reference available.
4. Run the **without-skill** API pass without skill files; provide only browser tools and live page observations.
5. Capture tokens, API calls, wall time, browser calls, and result quality for both passes.
6. Record results in:
   - `BENCHMARKS.md`
   - the site `skills/<domain>/SKILL.md` benchmark table
   - the action reference `## Benchmark` section

Read [references/api-benchmark-protocol.md](references/api-benchmark-protocol.md) before designing or running a benchmark.
