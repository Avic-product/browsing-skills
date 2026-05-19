---
name: browsing-airbnb
description: "Use when the user wants to interact with Airbnb — search public stays, extract listing details, extract visible reviews, or read availability and price breakdowns. Works on airbnb.com public guest pages without login for most stays; a real browser is required because Airbnb is a JavaScript-rendered SPA."
---

# Airbnb — Browsing Skill

Use this index to choose the Airbnb action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **search** — Search public Airbnb stays by destination, dates, guests, price, room type, and other URL filters, then extract visible result cards. Full spec: [references/search.md](references/search.md).
- **listing-data** — Extract visible details from a specific Airbnb listing, including title, host, location, rating, capacity, amenities, photos, and description. Full spec: [references/listing-data.md](references/listing-data.md).
- **reviews** — Extract visible reviews from a listing page, opening the reviews dialog when possible. Full spec: [references/reviews.md](references/reviews.md).
- **availability-price** — Read the currently visible booking-card availability, nightly price, fees, taxes, and total for selected dates and guests. Full spec: [references/availability-price.md](references/availability-price.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| search | TBD | TBD | Planned. |
| listing-data | TBD | TBD | Planned. |
| reviews | TBD | TBD | Planned. |
| availability-price | TBD | TBD | Planned. |

