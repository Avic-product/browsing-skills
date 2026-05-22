---
name: browsing-walmart
description: "Use when the user wants to interact with Walmart.com — search products or groceries, inspect product pages, read cart contents, or add explicitly requested items to cart. Works on www.walmart.com. A real browser is required for reliable results because Walmart often serves bot checks to plain HTTP requests and personalizes inventory, pickup, delivery, prices, and cart state by session and location. Write actions stop at cart changes and never place orders."
---

# Walmart.com — Browsing Skill

Use this index to choose the Walmart.com action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **search** — Search Walmart products or groceries and extract visible result cards. Full spec: [references/search.md](references/search.md).
- **product-data** — Extract a Walmart product page: title, price, availability, fulfillment, seller, ratings, images, variants, and cart-button state. Full spec: [references/product-data.md](references/product-data.md).
- **cart-data** — Read the visible Walmart cart contents, subtotal, quantities, fulfillment warnings, and checkout affordance without making changes. Full spec: [references/cart-data.md](references/cart-data.md).
- **add-to-cart** — Add an explicitly selected item and quantity to cart, then verify with `cart-data`. This is a write action and never proceeds to checkout. Full spec: [references/add-to-cart.md](references/add-to-cart.md).

## Benchmarks

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| search | TBD | TBD | Planned. |
| product-data | TBD | TBD | Planned. |
| cart-data | TBD | TBD | Planned. |
| add-to-cart | TBD | TBD | Planned. |
