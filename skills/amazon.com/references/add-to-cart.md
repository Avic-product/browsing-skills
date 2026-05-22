# Amazon.com — Add To Cart Reference

## Requirements

**Browser:** Required. This action uses the visible Amazon page and account/session state.

**Login / location:** May be required for Amazon Fresh, Whole Foods, age-restricted items, delivery-restricted items, subscriptions, personalized pricing, or carts tied to an address.

**User consent:** This is a write action. Only run it after the user explicitly asks to add a specific item and quantity to cart. Do not use it for vague browsing, comparison, or recommendations.

**Safety:** This action schedules or performs the Add to Cart click, then stops. Amazon sometimes navigates to a smart-wagon confirmation page immediately after the click; if that happens, run `cart-data` next to verify the resulting cart state. It never clicks Buy Now, checkout, delivery-slot selection, Subscribe & Save enrollment, Place Order, payment, address-change, or one-click controls.

## How to run this action

Navigate to the product page or a search/storefront page where the target item is visible, then execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ asin: "B000000000", quantity: 1, mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: add-to-cart

Use when the user has explicitly selected an Amazon product and asks to add it to cart.

**Navigate to:** one of:

- `https://www.amazon.com/dp/<ASIN>`
- A search, grocery storefront, or cart-adjacent page where the target ASIN's Add to Cart control is visible.

**Code:**

```js
({
  name: "amazon-add-to-cart",
  description: "Add an explicitly requested Amazon item to cart and return visible confirmation state without proceeding to checkout",
  inputSchema: {
    type: "object",
    required: ["asin"],
    properties: {
      asin: { type: "string", description: "Target ASIN to add. Required to avoid accidental wrong-item cart changes." },
      quantity: { type: "number", description: "Quantity to add. Defaults to 1." },
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      clickDelayMs: { type: "number", description: "Delay before clicking Add to Cart. Defaults to 100ms so browser-bridge callers can receive a response before Amazon navigates." }
    }
  },
  execute: async function(params) {
    var mode = (params && params.mode) || "data";
    var asin = clean((params && params.asin) || "").toUpperCase();
    var quantity = Math.max(1, Math.min(99, parseInt((params && params.quantity) || 1, 10) || 1));
    var clickDelayMs = Math.max(0, Math.min(2000, parseInt((params && params.clickDelayMs) || 100, 10) || 100));

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function sleep(ms) {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    function asinFromUrl() {
      var m = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      return m ? m[1].toUpperCase() : "";
    }

    function visible(el) {
      if (!el) return false;
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }

    function setQuantity(q) {
      var select = document.querySelector("select#quantity, select[name='quantity']");
      if (select) {
        var value = String(q);
        var found = false;
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].value === value || clean(select.options[i].textContent) === value) found = true;
        }
        if (found) {
          select.value = value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      var input = document.querySelector("input#quantity, input[name='quantity']");
      if (input) {
        input.value = String(q);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return q === 1;
    }

    function findProductRoot(targetAsin) {
      if (asinFromUrl() === targetAsin) return document;
      var roots = document.querySelectorAll("[data-asin], [data-csa-c-item-id*='asin'], [id*='" + targetAsin + "']");
      for (var i = 0; i < roots.length; i++) {
        var attr = (roots[i].getAttribute("data-asin") || "") + " " + (roots[i].getAttribute("data-csa-c-item-id") || "") + " " + roots[i].id;
        if (attr.indexOf(targetAsin) !== -1) {
          var node = roots[i];
          for (var depth = 0; depth < 5 && node.parentElement; depth++) {
            if (node.querySelector("input[name*='submit.add-to-cart'], button[name*='submit.add-to-cart'], input[id*='add-to-cart'], button[id*='add-to-cart']")) return node;
            node = node.parentElement;
          }
          return roots[i];
        }
      }
      return null;
    }

    function findAddButton(root) {
      var selectors = [
        "#add-to-cart-button",
        "input[name='submit.add-to-cart']",
        "button[name='submit.add-to-cart']",
        "input[id*='add-to-cart']",
        "button[id*='add-to-cart']",
        "[aria-label*='Add to Cart']",
        "[aria-label*='Add to cart']"
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = (root || document).querySelector(selectors[i]);
        if (el && visible(el) && !el.disabled) return el;
      }
      return null;
    }

    function confirmationState() {
      var text = clean(document.body ? document.body.textContent : "");
      var cartCount = clean((document.querySelector("#nav-cart-count") || {}).textContent || "");
      var subtotal = clean((document.querySelector("#attach-accessory-cart-subtotal, #sc-subtotal-amount-activecart, .sc-subtotal .a-price") || {}).textContent || "");
      return {
        url: window.location.href,
        cartCount: cartCount,
        subtotal: subtotal,
        addedMessage: (text.match(/added to (?:your )?cart|Added to Cart|Cart subtotal|Proceed to checkout/i) || [""])[0],
        warning: (text.match(/currently unavailable|out of stock|could not be added|problem adding|select.*options|choose.*options|captcha|robot check/i) || [""])[0]
      };
    }

    var data = {
      url: window.location.href,
      asin: asin,
      quantity: quantity,
      attempted: false,
      success: false,
      clickScheduled: false,
      message: "",
      confirmation: {},
      warnings: []
    };

    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      data.message = "A valid 10-character ASIN is required before changing the cart.";
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    var pageAsin = asinFromUrl();
    var root = findProductRoot(asin);
    if (!root) {
      data.message = "The requested ASIN is not visible on the current page. Navigate to the product page or a visible card for this ASIN first.";
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    if (pageAsin && pageAsin !== asin) {
      data.message = "Current product page ASIN does not match the requested ASIN.";
      data.warnings.push("Requested " + asin + " but page shows " + pageAsin + ".");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    var qtySet = setQuantity(quantity);
    if (!qtySet) data.warnings.push("Could not set requested quantity from the visible controls; Amazon may only allow adding one unit here.");
    await sleep(250);

    var button = findAddButton(root);
    if (!button) {
      data.message = "No enabled Add to Cart control was visible for the requested ASIN.";
      data.confirmation = confirmationState();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    data.attempted = true;
    data.clickScheduled = true;
    data.confirmation = confirmationState();
    data.message = "Add-to-cart click scheduled. Run cart-data after navigation or confirmation to verify the cart state.";
    setTimeout(function() {
      try { button.click(); } catch (e) {}
    }, clickDelayMs);

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:20px;max-width:720px;margin:0 auto;">';
      h += '<h2 style="font-size:20px;margin:0 0 10px;">Amazon add to cart</h2>';
      h += '<div style="font-weight:700;">Add-to-cart click scheduled</div>';
      h += '<div>' + [data.asin, "Qty " + data.quantity, data.confirmation.cartCount ? "Cart " + data.confirmation.cartCount : "", data.confirmation.subtotal].filter(Boolean).join(" · ") + '</div>';
      h += '<p>' + data.message + '</p>';
      if (data.warnings.length || data.confirmation.warning) h += '<p style="color:#8a5200;">' + data.warnings.concat([data.confirmation.warning]).filter(Boolean).join(" ") + '</p>';
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, asin, quantity, attempted, success, clickScheduled, message, confirmation: { url, cartCount, subtotal, addedMessage, warning }, warnings }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `amazon.com` `add-to-cart`.
