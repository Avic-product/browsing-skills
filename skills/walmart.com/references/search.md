# Walmart.com — Search Reference

## Requirements

**Browser:** Required. Walmart commonly serves bot-check pages to plain HTTP requests and renders product cards with JavaScript.

**Login / location:** Optional for public search, but local pickup, delivery windows, groceries, and store inventory require a browser session with a selected location.

**Safety:** Read-only. This action does not add to cart, reserve pickup, checkout, or change account settings.

## How to run this action

Once the search page is loaded, execute via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: search

**Navigate to:** `https://www.walmart.com/search?q=<query>`

**Code:**

```js
({
  name: "walmart-search",
  description: "Extract visible Walmart search result cards",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      limit: { type: "number" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 40;
    function clean(t) { return (t || "").replace(/\s+/g, " ").trim(); }
    function abs(url) { try { var u = new URL(url, location.origin); u.hash = ""; return u.href; } catch (e) { return url || ""; } }
    function text(root, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = root.querySelector(selectors[i]);
        var v = clean(el ? el.textContent || el.getAttribute("aria-label") : "");
        if (v) return v;
      }
      return "";
    }
    function price(root) {
      var t = text(root, ['[data-automation-id="product-price"]', '[itemprop="price"]', '[aria-label*="$"]', '.price-main', '.lh-title + div']);
      var m = t.match(/(?:[$€£]|USD|EUR|GBP)\s?[0-9][0-9.,]*/);
      return m ? m[0] : t;
    }
    function title(root) {
      return text(root, ['[data-automation-id="product-title"]', '[data-testid="product-title"]', 'span[data-automation-id*="title"]', 'a[href*="/ip/"] span', 'a[href*="/ip/"]']);
    }
    function image(root) {
      var img = root.querySelector('img[src], img[data-src]');
      return img ? img.currentSrc || img.src || img.getAttribute("data-src") || "" : "";
    }
    var data = {
      url: location.href,
      query: new URLSearchParams(location.search).get("q") || "",
      locationText: clean((document.querySelector('[data-automation-id="header-location"], [data-testid="location-banner"], button[aria-label*="location"]') || {}).textContent || ""),
      results: [],
      totalResults: 0,
      warnings: []
    };
    var body = document.body ? document.body.textContent || "" : "";
    if (/robot or human|captcha|verify your identity|blocked/i.test(body)) data.warnings.push("Walmart appears to be showing a bot check or CAPTCHA page.");
    var roots = document.querySelectorAll('[data-item-id], [data-testid="item-stack"], [data-testid*="product"], div[data-automation-id="product"], a[href*="/ip/"]');
    var seen = {};
    for (var i = 0; i < roots.length && data.results.length < limit; i++) {
      var root = roots[i];
      var link = root.matches && root.matches('a[href*="/ip/"]') ? root : root.querySelector('a[href*="/ip/"]');
      var url = abs(link ? link.getAttribute("href") : "");
      var id = root.getAttribute("data-item-id") || (url.match(/\/ip\/[^/]+\/([0-9]+)/) || [])[1] || "";
      var name = title(root);
      if (!url || !name || seen[url]) continue;
      seen[url] = true;
      var raw = clean(root.textContent);
      data.results.push({
        itemId: id,
        title: name,
        price: price(root),
        rating: (raw.match(/([0-9.]+)\s+stars?/i) || [])[1] || "",
        reviewCount: (raw.match(/([0-9,]+)\s+reviews?/i) || [])[1] || "",
        fulfillment: (raw.match(/\b(pickup|delivery|shipping|available|out of stock)[^.]*/i) || [""])[0],
        sponsored: /sponsored/i.test(raw),
        productUrl: url,
        imageUrl: image(root),
        rawText: raw
      });
    }
    data.totalResults = data.results.length;
    if (mode === "display") {
      var h = "<div style='font-family:sans-serif;max-width:900px;margin:auto;padding:20px'><h2>Walmart search: " + clean(data.query) + "</h2>";
      for (var r = 0; r < data.results.length; r++) h += "<p><b>" + data.results[r].title + "</b><br>" + [data.results[r].price, data.results[r].rating, data.results[r].fulfillment].filter(Boolean).join(" · ") + "</p>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, locationText, results: [{ itemId, title, price, rating, reviewCount, fulfillment, sponsored, productUrl, imageUrl, rawText }], totalResults, warnings }`
