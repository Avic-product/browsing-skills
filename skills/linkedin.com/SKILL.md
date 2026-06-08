---
name: browsing-linkedin
description: "Use when the user wants to interact with LinkedIn — extract data from a specific post (content, author, reactions, comments). Works on linkedin.com post pages. No login required for public posts; for private posts the user must provide an li_at session cookie. Works without a browser thanks to JSON-LD on post pages, though a real browser gives richer data."
---

# LinkedIn — Browsing Skill

Use this index to choose the LinkedIn action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **post-data** — Extract a LinkedIn post's content, author, reactions, comments, reposts, and canonical metadata. Full spec: [references/post-data.md](references/post-data.md).
- **profile-data** — Extract name, headline, location, connection degree, about, experience, education, and skills from a LinkedIn profile page. Full spec: [references/profile-data.md](references/profile-data.md).
- **job-data** — Extract title, company, location, description, employment type, years of experience, and industry from a LinkedIn job posting. Full spec: [references/job-data.md](references/job-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| post-data | TBD | TBD | Planned. |

