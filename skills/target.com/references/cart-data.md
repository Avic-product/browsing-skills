# Target.com — Cart Data Reference

## Requirements

**Browser:** Required for meaningful cart state.

**Safety:** Read-only. This action does not change quantities, remove items, checkout, or place orders.

## Action: cart-data

**Navigate to:** `https://www.target.com/cart`

**Code:**

```js
({
  name: "target-cart-data",
  description: "Read visible Target cart contents without making changes",
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
      signedIn: !/sign in/i.test(clean((document.querySelector("header") || {}).textContent || "")),
      subtotal: text(document, ['[data-test*="subtotal"]', '[data-test*="order-summary"]', '[aria-label*="subtotal" i]']),
      itemCountText: text(document, ['[data-test*="cart-count"]', '[aria-label*="cart"]']),
      checkoutButtonVisible: !!document.querySelector('button[aria-label*="checkout" i], button[data-test*="checkout"], a[href*="checkout"]'),
      items: [],
      warnings: []
    };
    var roots = document.querySelectorAll('[data-test*="cartItem"], [data-test*="cart-item"], [data-test*="lineItem"], a[href*="/p/"]');
    var seen = {};
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var link = root.matches && root.matches('a[href*="/p/"]') ? root : root.querySelector('a[href*="/p/"]');
      var url = abs(link ? link.getAttribute("href") : "");
      var tcin = (url.match(/A-([0-9]+)/) || [])[1] || "";
      var title = text(root, ['[data-test*="title"]', 'a[href*="/p/"]']);
      var key = tcin || url || title;
      if (!key || seen[key]) continue;
      seen[key] = true;
      data.items.push({
        tcin: tcin,
        title: title,
        quantity: text(root, ['select option:checked', '[data-test*="quantity"]', '[aria-label*="quantity" i]']),
        price: text(root, ['[data-test*="price"]', '[aria-label*="$"]']),
        productUrl: url,
        rawText: clean(root.textContent)
      });
    }
    if (/captcha|robot|verify/i.test(document.body.textContent || "")) data.warnings.push("Target appears to be showing a bot check or verification page.");
    if (mode === "display") return { content: [{ type: "text", text: "<pre>" + JSON.stringify(data, null, 2) + "</pre>" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, signedIn, subtotal, itemCountText, checkoutButtonVisible, items: [{ tcin, title, quantity, price, productUrl, rawText }], warnings }`
