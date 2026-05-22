# Target.com — Add To Cart Reference

## Requirements

**Browser:** Required. Use only after the user explicitly chooses an item and quantity.

**Safety:** Write action. It schedules the Add to cart click and stops. It never proceeds to checkout, Circle enrollment, payment, or order placement. Run `cart-data` after navigation/confirmation to verify.

## Action: add-to-cart

**Navigate to:** a Target product page for the selected item.

**Code:**

```js
({
  name: "target-add-to-cart",
  description: "Add an explicitly requested Target item to cart without checking out",
  inputSchema: {
    type: "object",
    properties: {
      tcin: { type: "string" },
      quantity: { type: "number" },
      mode: { type: "string", enum: ["data", "display"] },
      clickDelayMs: { type: "number" }
    }
  },
  execute: function(params) {
    var tcin = (params && params.tcin) || "";
    var quantity = Math.max(1, Math.min(99, parseInt((params && params.quantity) || 1, 10) || 1));
    var clickDelayMs = Math.max(0, Math.min(2000, parseInt((params && params.clickDelayMs) || 100, 10) || 100));
    function clean(t) { return (t || "").replace(/\s+/g, " ").trim(); }
    function pageTcin() { return (location.href.match(/A-([0-9]+)/) || [])[1] || ""; }
    function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; }
    var data = { url: location.href, tcin: tcin || pageTcin(), quantity: quantity, attempted: false, clickScheduled: false, message: "", warnings: [] };
    if (tcin && pageTcin() && tcin !== pageTcin()) {
      data.message = "Current Target product page TCIN does not match requested TCIN.";
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    var select = document.querySelector('select[aria-label*="quantity" i], select[name*="quantity" i]');
    if (select) {
      select.value = String(quantity);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    var buttons = document.querySelectorAll('button, [role="button"]');
    var button = null;
    for (var i = 0; i < buttons.length; i++) {
      var label = clean(buttons[i].textContent || buttons[i].getAttribute("aria-label"));
      if (/add to cart|ship it|pick it up|add for/i.test(label) && visible(buttons[i]) && !buttons[i].disabled) { button = buttons[i]; break; }
    }
    if (!button) {
      data.message = "No enabled Target Add to cart control was visible.";
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    data.attempted = true;
    data.clickScheduled = true;
    data.message = "Add-to-cart click scheduled. Run cart-data after confirmation/navigation to verify.";
    setTimeout(function() { try { button.click(); } catch (e) {} }, clickDelayMs);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, tcin, quantity, attempted, clickScheduled, message, warnings }`
