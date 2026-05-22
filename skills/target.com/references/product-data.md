# Target.com — Product Data Reference

## Requirements

**Browser:** Recommended. Target product pages are dynamic and location-aware.

**Safety:** Read-only. This action does not click Add to cart, Buy now, Circle offers, checkout, or account controls.

## Action: product-data

**Navigate to:** `https://www.target.com/p/<slug>/-/A-<tcin>` or any Target product URL.

**Code:**

```js
({
  name: "target-product-data",
  description: "Extract visible Target product detail data",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    function clean(t) { return (t || "").replace(/\s+/g, " ").trim(); }
    function text(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        var v = clean(el ? el.textContent || el.getAttribute("aria-label") : "");
        if (v) return v;
      }
      return "";
    }
    function all(selectors, limit) {
      var out = [];
      for (var s = 0; s < selectors.length; s++) {
        var els = document.querySelectorAll(selectors[s]);
        for (var i = 0; i < els.length && out.length < limit; i++) {
          var v = clean(els[i].textContent || els[i].getAttribute("aria-label"));
          if (v && out.indexOf(v) === -1) out.push(v);
        }
      }
      return out;
    }
    function tcin() { return (location.href.match(/A-([0-9]+)/) || [])[1] || ""; }
    var body = document.body ? document.body.textContent || "" : "";
    var data = {
      url: location.href.split("#")[0],
      tcin: tcin(),
      title: text(["h1", '[data-test="product-title"]']),
      brand: text(['[data-test*="brand"]', 'a[href*="/b/"]']),
      price: text(['[data-test="product-price"]', '[data-test="current-price"]', '[data-test*="price"]', '[aria-label*="$"]']),
      availability: text(['[data-test*="availability"]', '[data-test*="fulfillment"]', '[aria-live="polite"]']),
      rating: text(['[data-test*="rating"]', '[aria-label*="out of 5"]']),
      reviewCount: text(['[data-test*="review"]', 'a[href*="ratings-reviews"]']),
      fulfillment: all(['[data-test*="fulfillment"]', '[data-test*="shipping"]', '[data-test*="pickup"]'], 10),
      bullets: all(['[data-test*="description"] li', '[data-test*="details"] li', 'section li'], 20),
      images: all(['img[src*="target.scene7"], img[src*="targetimg"], picture img'], 12),
      variants: all(['[data-test*="variation"]', '[data-test*="swatch"]', 'button[aria-pressed]'], 30),
      addToCartAvailable: !!document.querySelector('button[aria-label*="Add to cart" i], button[data-test*="addToCart"], button[data-test*="shipItButton"]'),
      buyNowVisible: !!document.querySelector('button[aria-label*="Buy now" i], button[data-test*="buyNow"]'),
      warnings: []
    };
    if (/captcha|robot|verify/i.test(body)) data.warnings.push("Target appears to be showing a bot check or verification page.");
    if (mode === "display") return { content: [{ type: "text", text: "<pre>" + JSON.stringify(data, null, 2) + "</pre>" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, tcin, title, brand, price, availability, rating, reviewCount, fulfillment, bullets, images, variants, addToCartAvailable, buyNowVisible, warnings }`
