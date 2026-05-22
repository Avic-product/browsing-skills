# Amazon.com — Search Reference

## Requirements

**Browser:** Strongly recommended. Amazon serves different markup, bot checks, pricing, currency, and shipping messages by region, account, browser state, and address. Use Playwright, a built-in Chromium integration, or the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

**Login / location:** Optional for ordinary shipped-product searches, but required for personalized grocery availability, Amazon Fresh, Whole Foods Market, Past Purchases, Repeat Items, and local delivery/pickup inventory. If grocery results look empty, make sure the browser session has a ZIP/address selected.

**Safety:** This action only reads visible search results. It does not add to cart, buy, save, subscribe, or change account settings.

## How to run this action

Once the right URL is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: search

Use when the user wants to search Amazon and extract visible product result cards.

**Navigate to:**

General Amazon search:

`https://www.amazon.com/s?k=<query>`

Amazon Fresh scoped search:

`https://www.amazon.com/s?k=<query>&i=amazonfresh`

Whole Foods searches and grocery pages are often location/session dependent. If direct search is sparse, use the storefront page first and let the user/browser session apply the desired location:

`https://www.amazon.com/wholefoods`

**Code:**

```js
({
  name: "amazon-search",
  description: "Extract visible Amazon product result cards from a search results page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      limit: { type: "number", description: "Maximum result cards to return from the visible page" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 40;

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function dedupeRepeated(text) {
      text = clean(text);
      if (text.length > 4 && text.length % 2 === 0) {
        var half = text.slice(0, text.length / 2);
        if (half === text.slice(text.length / 2)) return half;
      }
      return text;
    }

    function absUrl(url) {
      if (!url) return "";
      try {
        var out = new URL(url, window.location.origin);
        out.hash = "";
        return out.href;
      } catch (e) {
        return url;
      }
    }

    function textOf(root, selector) {
      var el = root && root.querySelector(selector);
      return clean(el ? el.textContent || el.getAttribute("aria-label") : "");
    }

    function first(root, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = root && root.querySelector(selectors[i]);
        if (el) return el;
      }
      return null;
    }

    function priceFrom(root) {
      var offscreen = root.querySelector(".a-price .a-offscreen");
      if (offscreen) return clean(offscreen.textContent);
      var whole = textOf(root, ".a-price-whole");
      var fraction = textOf(root, ".a-price-fraction");
      var symbol = textOf(root, ".a-price-symbol");
      if (whole) return clean(symbol + " " + whole + (fraction ? "." + fraction : ""));
      return "";
    }

    function unitPriceFrom(root) {
      var candidates = root.querySelectorAll(".a-color-secondary, .a-size-base, .a-size-small");
      for (var i = 0; i < candidates.length; i++) {
        var t = clean(candidates[i].textContent);
        if (/(\/|per |each|count|oz|lb|kg|g|ml|fl oz|sheets)/i.test(t) && /[$€£]|USD|EUR|GBP/.test(t)) return t;
      }
      return "";
    }

    function ratingFrom(root) {
      var label = "";
      var ratingEl = root.querySelector('[aria-label*="out of 5 stars"], .a-icon-alt');
      if (ratingEl) label = clean(ratingEl.getAttribute("aria-label") || ratingEl.textContent);
      var match = label.match(/([0-9.]+)\s+out of 5/i);
      return match ? match[1] : label;
    }

    function reviewCountFrom(root) {
      var links = root.querySelectorAll('a[href*="#customerReviews"], a[href*="customerReviews"]');
      for (var i = 0; i < links.length; i++) {
        var label = clean(links[i].getAttribute("aria-label") || links[i].textContent);
        if (/[0-9]/.test(label)) return label;
      }
      return "";
    }

    function findTitle(root) {
      var h = first(root, ["h2 span", "h2", "[data-cy='title-recipe'] span", ".p13nTitle"]);
      return dedupeRepeated(h ? h.textContent || h.getAttribute("aria-label") : "");
    }

    function findLink(root) {
      var link = first(root, ["h2 a[href]", "a.a-link-normal.s-no-outline[href]", "a[href*='/dp/']", "a[href*='/gp/product/']"]);
      return absUrl(link ? link.getAttribute("href") : "");
    }

    function firstImage(root) {
      var img = first(root, ["img.s-image", "img[src*='media-amazon']", "img"]);
      return img ? img.currentSrc || img.src || img.getAttribute("data-src") || "" : "";
    }

    function deliveryText(root) {
      var block = first(root, ["[data-cy='delivery-block']", "[data-cy='delivery-recipe']", ".udm-delivery-block"]);
      return clean(block ? block.textContent : "");
    }

    function availabilityText(root) {
      var candidates = root.querySelectorAll(".a-color-success, .a-color-price, .a-color-secondary, .a-size-base");
      for (var i = 0; i < candidates.length; i++) {
        var t = clean(candidates[i].textContent);
        if (/\b(in stock|out of stock|currently unavailable|available|left in stock|ships|delivery|pickup)\b/i.test(t)) return t;
      }
      return "";
    }

    var data = {
      url: window.location.href,
      query: (new URLSearchParams(window.location.search)).get("k") || (new URLSearchParams(window.location.search)).get("field-keywords") || "",
      searchAlias: (new URLSearchParams(window.location.search)).get("i") || "",
      locationText: clean((document.querySelector("#glow-ingress-line2") || {}).textContent || ""),
      signedIn: !/signin|Sign in securely/i.test(clean((document.querySelector("#nav-link-accountList") || {}).textContent || "")),
      results: [],
      totalResults: 0,
      warnings: []
    };

    if (/captcha|enter the characters you see below|robot check/i.test(document.body.textContent || "")) {
      data.warnings.push("Amazon appears to be showing a bot check or CAPTCHA page.");
    }

    var cards = document.querySelectorAll('[data-component-type="s-search-result"][data-asin], .s-result-item[data-asin], [data-csa-c-item-id*="asin."]');
    var seen = {};
    for (var i = 0; i < cards.length && data.results.length < limit; i++) {
      var card = cards[i];
      var asin = card.getAttribute("data-asin") || "";
      if (!asin) {
        var itemId = card.getAttribute("data-csa-c-item-id") || "";
        var m = itemId.match(/asin\.([A-Z0-9]{10})|([A-Z0-9]{10})/);
        asin = m ? (m[1] || m[2]) : "";
      }
      var title = findTitle(card);
      var url = findLink(card);
      if (!asin && url.indexOf("/dp/") === -1 && url.indexOf("/gp/product/") === -1) continue;
      if (!title || /^(Results|Sponsored Results|More results)$/i.test(title)) continue;
      var key = asin || url || title;
      if (!key || seen[key]) continue;
      seen[key] = true;

      var text = clean(card.textContent);
      data.results.push({
        asin: asin,
        title: title,
        price: priceFrom(card),
        unitPrice: unitPriceFrom(card),
        rating: ratingFrom(card),
        reviewCount: reviewCountFrom(card),
        boughtRecently: (text.match(/[0-9K,.+]+\s+bought\s+in\s+past\s+(?:month|week)/i) || [""])[0],
        delivery: deliveryText(card),
        availability: availabilityText(card),
        sponsored: /sponsored|featured from amazon brands/i.test(text),
        productUrl: url,
        imageUrl: firstImage(card),
        rawText: text
      });
    }
    data.totalResults = data.results.length;

    if (data.totalResults === 0 && /amazonfresh|wholefoods|fresh/i.test(data.searchAlias + " " + document.title)) {
      data.warnings.push("No product cards were visible. Grocery inventory often requires a signed-in browser session with a delivery location selected.");
    }

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:20px;max-width:900px;margin:0 auto;">';
      h += '<h2 style="font-size:20px;margin:0 0 12px;">Amazon search: ' + clean(data.query || data.searchAlias || "visible results") + '</h2>';
      for (var r = 0; r < data.results.length; r++) {
        var item = data.results[r];
        h += '<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid #ddd;">';
        if (item.imageUrl) h += '<img src="' + item.imageUrl + '" style="width:88px;height:88px;object-fit:contain;">';
        h += '<div><div style="font-weight:700;">' + (item.title || "Untitled item") + '</div>';
        h += '<div>' + (item.price || "") + (item.unitPrice ? " · " + item.unitPrice : "") + '</div>';
        h += '<div style="color:#555;font-size:13px;">' + [item.rating, item.reviewCount, item.delivery, item.availability].filter(Boolean).join(" · ") + '</div></div></div>';
      }
      if (data.warnings.length) h += '<p style="color:#8a5200;">' + data.warnings.join(" ") + '</p>';
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, searchAlias, locationText, signedIn, results: [{ asin, title, price, unitPrice, rating, reviewCount, boughtRecently, delivery, availability, sponsored, productUrl, imageUrl, rawText }], totalResults, warnings }`

## Benchmark

- **With skill:** 17,588 API tokens, 3 API calls, 2 browser calls, ~20.7s total on `electric drum kit`. Returned 5 visible cards with ASIN, title, price, rating, review count, product URL, image URL, delivery, and availability fields.
- **Without skill:** 21,770 API tokens, 6 API calls, 5 browser calls, ~22.3s total on the same query and browser state. Returned 5 visible cards, but product URLs were missing and delivery/availability text was noisier.
- **Comparison:** Skill used fewer tokens and fewer browser/API calls while returning cleaner structured Amazon search results.
