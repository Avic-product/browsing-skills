# Walmart.com — Product Data Reference

## Requirements

**Browser:** Required. Product availability, price, fulfillment, and seller data vary by location and session.

**Safety:** Read-only. This action does not click Add to cart, checkout, subscriptions, protection plans, or account controls.

## Action: product-data

**Navigate to:** `https://www.walmart.com/ip/<slug>/<item-id>` or any Walmart product URL.

**Code:**

```js
({
  name: "walmart-product-data",
  description: "Extract visible Walmart product detail data",
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
    function itemId() {
      var m = location.href.match(/\/ip\/[^/?#]+\/([0-9]+)/);
      return m ? m[1] : "";
    }
    var body = document.body ? document.body.textContent || "" : "";
    var price = text(['[itemprop="price"]', '[data-automation-id="product-price"]', '[data-testid="price-wrap"]', '[aria-label*="$"]']);
    var data = {
      url: location.href.split("#")[0],
      itemId: itemId(),
      title: text(["h1", '[data-automation-id="product-title"]']),
      brand: text(['a[href*="/brand/"]', '[data-testid="product-brand"]']),
      price: (price.match(/(?:[$€£]|USD|EUR|GBP)\s?[0-9][0-9.,]*/) || [price])[0],
      availability: text(['[data-testid*="availability"]', '[data-automation-id*="fulfillment"]', '[aria-live="polite"]']),
      seller: text(['[data-testid*="seller"]', '[data-automation-id*="seller"]']),
      rating: text(['[itemprop="ratingValue"]', '[aria-label*="stars"]']),
      reviewCount: text(['[itemprop="reviewCount"]', 'a[href*="reviews"]']),
      fulfillment: all(['[data-testid*="fulfillment"]', '[data-automation-id*="fulfillment"]', '[data-testid*="shipping"]'], 10),
      bullets: all(['[data-testid="product-description"] li', '[data-testid*="description"] li', 'section li'], 20),
      images: all(['img[src*="i5.walmartimages"], img[src*="walmartimages"]'], 12),
      variants: all(['[data-testid*="variant"]', '[data-automation-id*="variant"]'], 20),
      addToCartAvailable: !!document.querySelector('button[aria-label*="Add to cart" i], button[data-automation-id*="add-to-cart" i], button:enabled'),
      warnings: []
    };
    if (/robot or human|captcha|verify your identity|blocked/i.test(body)) data.warnings.push("Walmart appears to be showing a bot check or CAPTCHA page.");
    if (mode === "display") return { content: [{ type: "text", text: "<pre>" + JSON.stringify(data, null, 2) + "</pre>" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, itemId, title, brand, price, availability, seller, rating, reviewCount, fulfillment, bullets, images, variants, addToCartAvailable, warnings }`
