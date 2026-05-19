---
name: browsing-facebook
description: "Use when the user wants to interact with Facebook Marketplace — search visible listings, extract listing details, and summarize seller/profile information. Requires a real browser signed in to facebook.com; Facebook Marketplace has no practical public API for normal buyer workflows."
---

# Facebook Marketplace — Browsing Skill

Use this index to choose the Facebook Marketplace action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **marketplace-search** — Extract visible Facebook Marketplace search results, including title, price, location, listing URL, image URL, and visible metadata. Full spec: [references/marketplace-search.md](references/marketplace-search.md).
- **marketplace-listing-data** — Extract details from a specific Marketplace listing page, including title, price, seller, location, description, images, and visible item metadata. Full spec: [references/marketplace-listing-data.md](references/marketplace-listing-data.md).
- **marketplace-seller-data** — Extract visible seller/profile information from a Marketplace seller or profile page, including name, profile URL, rating text, marketplace metadata, and visible listings. Full spec: [references/marketplace-seller-data.md](references/marketplace-seller-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| marketplace-search | TBD | TBD | Planned. |
| marketplace-listing-data | TBD | TBD | Planned. |
| marketplace-seller-data | TBD | TBD | Planned. |

