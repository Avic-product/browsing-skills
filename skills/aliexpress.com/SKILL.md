---
name: browsing-aliexpress
description: Use when the user wants to interact with AliExpress — search products, inspect product detail pages, read the shopping cart, or add explicitly requested items to cart. Works on aliexpress.com and regional AliExpress domains. A real browser is required because AliExpress is JavaScript-rendered and frequently serves captcha or x5 challenge pages to plain HTTP clients. Login, ship-to country, currency, selected variants, and delivery estimates affect availability and prices. Write actions stop at cart changes and never place orders.
---

# AliExpress Browsing Skill

Use this skill for AliExpress buyer workflows: searching product listings, extracting product information, checking the cart, and adding an explicitly requested product to the cart.

AliExpress is heavily personalized. Results and prices vary by ship-to country, currency, account state, coupons, selected variants, and seller shipping rules. Prefer a real browser session that already has the user's region and account state.

Do not place orders, click checkout confirmation, submit payment details, or accept checkout-adjacent prompts.

## Actions

- [Search products](references/search.md) — search AliExpress product listings and return normalized visible results.
- [Get product data](references/product-data.md) — extract title, price, seller, rating, variants, shipping, and images from a product detail page.
- [Read cart](references/cart-data.md) — read visible cart items, quantities, subtotal, and checkout readiness.
- [Add to cart](references/add-to-cart.md) — add the current product page to cart after required options have been selected.

## Notes

- Plain HTTP fetches commonly return captcha, x5 challenge, or anti-bot pages. Use a real browser, Chrome Bridge, or Playwright with an existing browser profile.
- Product pages often require color, size, ship-from, or bundle selections before Add to cart becomes available.
- Delivery estimates and totals are not reliable unless the browser session has a delivery country and currency configured.

## Benchmarks

| Task | Recommended action |
| --- | --- |
| Find cheap phone cases | Search products |
| Compare a specific listing | Get product data |
| See what is already in cart | Read cart |
| Add an explicitly requested listing | Add to cart |
