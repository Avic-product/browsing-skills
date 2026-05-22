# Amazon.com — Cart Data Reference

## Requirements

**Browser:** Required for meaningful results. Cart pages are personalized and may render or update asynchronously.

**Login / location:** Optional for a public empty cart, but required for the user's real cart, grocery/local-market cart, delivery-specific warnings, and saved item state.

**Safety:** This action is read-only. It does not change quantities, delete items, save for later, proceed to checkout, select delivery slots, or place orders.

## How to run this action

Once the cart page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: cart-data

Use when the user wants to inspect the current Amazon shopping cart or Amazon Fresh/Whole Foods local-market cart.

**Navigate to:** one of:

- `https://www.amazon.com/gp/cart/view.html`
- `https://www.amazon.com/cart/localmarket?almBrandId=QW1hem9uIEZyZXNo`
- The already-open Amazon cart page in the user's browser session.

**Code:**

```js
({
  name: "amazon-cart-data",
  description: "Read visible Amazon cart contents without making changes",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
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

    function titleFrom(root) {
      var title = textOf(root, ".sc-product-title, .a-truncate-full, a[href*='/dp/'], a[href*='/gp/product/']");
      if (title) return title;
      var img = root.querySelector("img[alt]");
      return clean(img ? img.getAttribute("alt") : "");
    }

    function priceFrom(root) {
      var el = root.querySelector(".sc-product-price, .a-price .a-offscreen, .sc-white-space-nowrap, .a-color-price");
      var t = clean(el ? el.textContent : "");
      if (t) return t;
      var m = clean(root.textContent).match(/(?:[$€£]|USD|EUR|GBP)\s?[0-9][0-9.,]*/);
      return m ? m[0] : "";
    }

    function qtyFrom(root) {
      var selected = root.querySelector("select[name='quantity'] option:checked, .a-dropdown-prompt");
      var t = clean(selected ? selected.textContent : "");
      var m = t.match(/[0-9]+/);
      if (m) return m[0];
      var input = root.querySelector("input[name='quantityBox'], input[name='quantity']");
      return input ? input.value || input.getAttribute("value") || "" : "";
    }

    function subtotalFromPage() {
      var selectors = ["#sc-subtotal-amount-activecart", "#sw-subtotal .a-price .a-offscreen", "#sw-subtotal", ".sc-subtotal .a-price .a-offscreen", ".sc-subtotal .a-price", "[data-name='Subtotals']"];
      for (var i = 0; i < selectors.length; i++) {
        var t = textOf(document, selectors[i]);
        if (!t) continue;
        var money = t.match(/(?:[$€£]|USD|EUR|GBP)\s?[0-9][0-9.,]*/);
        if (money) return money[0];
        return t;
      }
      return "";
    }

    var bodyText = document.body ? document.body.textContent || "" : "";
    var data = {
      url: window.location.href,
      title: document.title,
      cartType: /localmarket|almBrandId|Amazon Fresh|Whole Foods/i.test(window.location.href + " " + bodyText) ? "local-market-grocery" : "standard",
      signedIn: !/sign\s*in|signin|hello,\s*sign/i.test(clean((document.querySelector("#nav-link-accountList") || {}).textContent || "")),
      itemCountText: clean((document.querySelector("#nav-cart-count, #sc-subtotal-label-activecart, [data-name='Active Items']") || {}).textContent || ""),
      subtotal: subtotalFromPage(),
      checkoutButtonVisible: !!document.querySelector("input[name='proceedToRetailCheckout'], input[name='proceedToCheckout'], a[href*='checkout']"),
      items: [],
      savedForLater: [],
      warnings: []
    };

    var itemRoots = document.querySelectorAll("#sc-active-cart .sc-list-item[data-asin], form#activeCartViewForm .sc-list-item[data-asin], [data-name='Active Items'] .sc-list-item[data-asin], [data-name='Active Items'] [data-asin][data-itemid], .ewc-item[data-asin], #sw-atc-confirmation [data-asin][data-itemid]");
    var seen = {};
    var itemIndexByKey = {};
    for (var i = 0; i < itemRoots.length; i++) {
      var root = itemRoots[i];
      var asin = root.getAttribute("data-asin") || "";
      if (!asin) {
        var attr = root.getAttribute("data-csa-c-item-id") || "";
        var match = attr.match(/([A-Z0-9]{10})/);
        asin = match ? match[1] : "";
      }
      var link = root.querySelector("a[href*='/dp/'], a[href*='/gp/product/']");
      var url = absUrl(link ? link.getAttribute("href") : "");
      var title = titleFrom(root);
      var key = asin || url || title;
      if (!key) continue;
      var text = clean(root.textContent);
      var itemData = {
        asin: asin,
        title: title,
        quantity: qtyFrom(root),
        price: priceFrom(root),
        availability: (text.match(/\b(in stock|out of stock|currently unavailable|unavailable|saved for later|only [0-9]+ left)\b/i) || [""])[0],
        productUrl: url,
        rawText: text
      };
      if (seen[key]) {
        var existing = data.items[itemIndexByKey[key]];
        if (existing) {
          if (!existing.title && itemData.title) existing.title = itemData.title;
          if (!existing.quantity && itemData.quantity) existing.quantity = itemData.quantity;
          if (!existing.price && itemData.price) existing.price = itemData.price;
          if (!existing.availability && itemData.availability) existing.availability = itemData.availability;
          if (!existing.productUrl && itemData.productUrl) existing.productUrl = itemData.productUrl;
          if (!existing.rawText && itemData.rawText) existing.rawText = itemData.rawText;
        }
        continue;
      }
      seen[key] = true;
      itemIndexByKey[key] = data.items.length;
      data.items.push(itemData);
    }

    var savedRoots = document.querySelectorAll("#sc-saved-cart .sc-list-item, [data-name='Saved For Later'] .sc-list-item");
    for (var s = 0; s < savedRoots.length; s++) {
      var savedTitle = textOf(savedRoots[s], ".sc-product-title, .a-truncate-full, a[href*='/dp/']");
      if (savedTitle) data.savedForLater.push({ title: savedTitle, price: priceFrom(savedRoots[s]), rawText: clean(savedRoots[s].textContent) });
    }

    var alertRoot = document.querySelector("#sc-active-cart, form#activeCartViewForm, [data-name='Active Items']") || document;
    var alerts = alertRoot.querySelectorAll(".a-alert-content, .sc-list-item-removed-msg, .sc-cart-quantity-alert, [role='alert']");
    for (var a = 0; a < alerts.length; a++) {
      var warning = clean(alerts[a].textContent);
      if (/^(Added to Cart|Failed\\.|Try again!)$/i.test(warning)) continue;
      if (warning && data.warnings.indexOf(warning) === -1) data.warnings.push(warning);
    }
    if (/captcha|enter the characters you see below|robot check/i.test(bodyText)) data.warnings.push("Amazon appears to be showing a bot check or CAPTCHA page.");

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:20px;max-width:840px;margin:0 auto;">';
      h += '<h2 style="font-size:20px;margin:0 0 8px;">Amazon cart</h2>';
      h += '<div style="font-weight:700;margin-bottom:12px;">' + (data.subtotal || data.itemCountText || "") + '</div>';
      for (var r = 0; r < data.items.length; r++) {
        var item = data.items[r];
        h += '<div style="padding:10px 0;border-top:1px solid #ddd;"><div style="font-weight:700;">' + (item.title || item.asin || "Cart item") + '</div>';
        h += '<div>' + [item.quantity ? "Qty " + item.quantity : "", item.price, item.availability].filter(Boolean).join(" · ") + '</div></div>';
      }
      if (data.warnings.length) h += '<p style="color:#8a5200;">' + data.warnings.join(" ") + '</p>';
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, title, cartType, signedIn, itemCountText, subtotal, checkoutButtonVisible, items: [{ asin, title, quantity, price, availability, productUrl, rawText }], savedForLater, warnings }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `amazon.com` `cart-data`.
