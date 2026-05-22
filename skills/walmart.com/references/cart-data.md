# Walmart.com — Cart Data Reference

## Requirements

**Browser:** Required. Cart state is personalized and may require login/location.

**Safety:** Read-only. This action does not change quantities, remove items, checkout, reserve pickup, or place orders.

## Action: cart-data

**Navigate to:** `https://www.walmart.com/cart`

**Code:**

```js
({
  name: "walmart-cart-data",
  description: "Read visible Walmart cart contents without making changes",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
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
    var data = {
      url: location.href,
      signedIn: !/sign in|account/i.test(clean((document.querySelector('[data-automation-id*="account"], header') || {}).textContent || "")),
      subtotal: text(document, ['[data-testid*="subtotal"]', '[data-automation-id*="subtotal"]', '[aria-label*="subtotal" i]']),
      itemCountText: text(document, ['[data-testid*="cart-count"]', '[data-automation-id*="cart-count"]']),
      checkoutButtonVisible: !!document.querySelector('button[data-automation-id*="checkout"], button[aria-label*="checkout" i], a[href*="checkout"]'),
      items: [],
      warnings: []
    };
    var roots = document.querySelectorAll('[data-automation-id*="cart-item"], [data-testid*="cart-item"], [data-item-id], a[href*="/ip/"]');
    var seen = {};
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var link = root.matches && root.matches('a[href*="/ip/"]') ? root : root.querySelector('a[href*="/ip/"]');
      var url = abs(link ? link.getAttribute("href") : "");
      var itemId = root.getAttribute("data-item-id") || (url.match(/\/ip\/[^/]+\/([0-9]+)/) || [])[1] || "";
      var title = text(root, ['[data-automation-id*="title"]', '[data-testid*="title"]', 'a[href*="/ip/"]']);
      var key = itemId || url || title;
      if (!key || seen[key]) continue;
      seen[key] = true;
      data.items.push({
        itemId: itemId,
        title: title,
        quantity: text(root, ['select option:checked', '[data-testid*="quantity"]', '[aria-label*="quantity" i]']),
        price: text(root, ['[data-automation-id*="price"]', '[data-testid*="price"]', '[aria-label*="$"]']),
        productUrl: url,
        rawText: clean(root.textContent)
      });
    }
    if (/robot or human|captcha|verify your identity|blocked/i.test(document.body.textContent || "")) data.warnings.push("Walmart appears to be showing a bot check or CAPTCHA page.");
    if (mode === "display") return { content: [{ type: "text", text: "<pre>" + JSON.stringify(data, null, 2) + "</pre>" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, signedIn, subtotal, itemCountText, checkoutButtonVisible, items: [{ itemId, title, quantity, price, productUrl, rawText }], warnings }`
