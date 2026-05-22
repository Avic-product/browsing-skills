---
name: browsing-amazon
description: "Use when the user wants to interact with Amazon.com — search products or groceries, inspect product detail pages, extract Amazon Fresh or Whole Foods storefront items, read the shopping cart, or add explicitly requested items to cart. Works on www.amazon.com. A real browser is strongly recommended; login and a delivery location are required for personalized grocery availability, cart contents, Past Purchases, Repeat Items, delivery slots, and checkout-adjacent pages. Write actions stop at cart changes and never place orders."
---

# Amazon.com — Browsing Skill

Use this index to choose the Amazon.com action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **search** — Search Amazon product results, including normal shipped products and scoped grocery searches such as Amazon Fresh, then extract visible result cards. Full spec: [references/search.md](references/search.md).
- **product-data** — Extract details from a product page: title, price, availability, seller, delivery text, ratings, images, bullets, variants, and cart-button state. Full spec: [references/product-data.md](references/product-data.md).
- **grocery-storefront** — Extract visible Amazon Fresh or Whole Foods storefront modules, aisle/deal/navigation links, and grocery product cards from the current page. Full spec: [references/grocery-storefront.md](references/grocery-storefront.md).
- **cart-data** — Read the current Amazon cart or local-market grocery cart contents, subtotal, quantities, warnings, and checkout affordance without making changes. Full spec: [references/cart-data.md](references/cart-data.md).
- **add-to-cart** — Add an explicitly selected item and quantity to cart, then return the visible confirmation/cart state. This is a write action and never proceeds to checkout. Full spec: [references/add-to-cart.md](references/add-to-cart.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| search | 17,588 tokens / ~20.7s | 21,770 tokens / ~22.3s | Skill returned complete visible cards; no-skill missed product URLs and had noisier delivery/availability text. |
| product-data | 12,321 tokens / ~9.6s | 8,673 tokens / ~19.6s | Skill used fewer browser calls and returned more images plus Buy Now visibility; no-skill used fewer tokens on this stable page but missed Buy Now visibility. |
| grocery-storefront | TBD | TBD | Planned. |
| cart-data | TBD | TBD | Planned. |
| add-to-cart | TBD | TBD | Planned. |
