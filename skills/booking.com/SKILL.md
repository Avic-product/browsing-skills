---
name: browsing-booking
description: "Use when the user wants to interact with Booking.com — search for accommodations with full filter support (property type, stars, score, meal plan, facilities, district, etc.), extract a specific hotel's data (price, rooms, amenities, photos), extract reviews, or start a reservation up to (but not through) the payment step. Works on www.booking.com. A real browser is required (Booking is a JS-rendered SPA and serves bot challenges to plain fetches). Login is optional but improves prices and personalization."
---

# Booking.com — Browsing Skill

Use this index to choose the Booking.com action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **search** — Search for accommodations by destination, dates, guests, rooms, filters, sorting, and pagination. Full spec: [references/search.md](references/search.md).
- **hotel-data** — Extract details from a specific property, including name, address, score, rooms, amenities, and photos. Full spec: [references/hotel-data.md](references/hotel-data.md).
- **reviews** — Extract review cards or featured reviews from a property page. Full spec: [references/reviews.md](references/reviews.md).
- **book-room** — Start a reservation by selecting a room and submitting up to the guest-details page, stopping before payment. Full spec: [references/book-room.md](references/book-room.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| search | 3,903 / ~9.5s | 49,290 / ~82.5s | Skill clean; no-skill noisy/missing fields. |
| hotel-data | 2,969 / ~19.0s | 4,219 / ~35.6s | Skill complete; no-skill confirmed block but missed hotel/room details. |
| reviews | TBD | TBD | Planned. |
| book-room | TBD | TBD | Planned. |
