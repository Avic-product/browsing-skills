# Target.com — Search Reference

## Requirements

**Browser:** Recommended. Target returns a large Next.js shell to plain HTTP and renders/updates product-grid data client-side.

**Login / location:** Optional for public search, but pickup, Drive Up, Same Day Delivery, local inventory, Circle offers, and cart state depend on store/location/session.

**Safety:** Read-only. This action does not add to cart, clip offers, checkout, or change account settings.

## Action: search

**Navigate to:** `https://www.target.com/s?searchTerm=<query>`

**Code:**

```js
({
  name: "target-search",
  description: "Extract visible Target search result cards",
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
    function tcinFrom(url, root) {
      var m = (url || "").match(/A-([0-9]+)/);
      if (m) return m[1];
      var attrs = ["data-tcin", "data-item-id", "data-test"];
      for (var i = 0; i < attrs.length; i++) {
        var v = root.getAttribute(attrs[i]) || "";
        var mm = v.match(/[0-9]{6,}/);
        if (mm) return mm[0];
      }
      return "";
    }
    function image(root) {
      var img = root.querySelector("img[src], img[data-src]");
      return img ? img.currentSrc || img.src || img.getAttribute("data-src") || "" : "";
    }
    var data = {
      url: location.href,
      query: new URLSearchParams(location.search).get("searchTerm") || "",
      storeText: clean((document.querySelector('[data-test*="store"], [aria-label*="store" i]') || {}).textContent || ""),
      results: [],
      totalResults: 0,
      warnings: []
    };
    var body = document.body ? document.body.textContent || "" : "";
    if (/captcha|robot|verify/i.test(body)) data.warnings.push("Target appears to be showing a bot check or verification page.");
    var roots = document.querySelectorAll('[data-test*="product-card"], [data-test*="ProductCard"], [data-test*="product-grid"] li, a[href*="/p/"]');
    var seen = {};
    for (var i = 0; i < roots.length && data.results.length < limit; i++) {
      var root = roots[i];
      var link = root.matches && root.matches('a[href*="/p/"]') ? root : root.querySelector('a[href*="/p/"]');
      var url = abs(link ? link.getAttribute("href") : "");
      var title = text(root, ['[data-test="product-title"]', '[data-test*="title"]', 'a[href*="/p/"]']);
      if (!url || !title || seen[url]) continue;
      seen[url] = true;
      var raw = clean(root.textContent);
      data.results.push({
        tcin: tcinFrom(url, root),
        title: title,
        price: text(root, ['[data-test="current-price"]', '[data-test*="price"]', '[aria-label*="$"]']),
        rating: (raw.match(/([0-9.]+)\s+out of 5/i) || [])[1] || "",
        reviewCount: (raw.match(/([0-9,]+)\s+ratings?|([0-9,]+)\s+reviews?/i) || ["", "", ""])[1] || "",
        fulfillment: (raw.match(/\b(Shipping|Pickup|Drive Up|Delivery|Out of stock|In stock)[^.]*/i) || [""])[0],
        sponsored: /sponsored/i.test(raw),
        productUrl: url,
        imageUrl: image(root),
        rawText: raw
      });
    }
    data.totalResults = data.results.length;
    if (mode === "display") return { content: [{ type: "text", text: "<pre>" + JSON.stringify(data, null, 2) + "</pre>" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, storeText, results: [{ tcin, title, price, rating, reviewCount, fulfillment, sponsored, productUrl, imageUrl, rawText }], totalResults, warnings }`
