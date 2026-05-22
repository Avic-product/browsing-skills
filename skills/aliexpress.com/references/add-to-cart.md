# Add to Cart

Navigate to:

An AliExpress product detail page, typically:

`https://www.aliexpress.com/item/<itemId>.html`

Only use this action when the user explicitly asks to add the specific item. If required options such as color, size, ship-from, or bundle are not selected, stop and report that selection is needed.

```js
({
  name: "aliexpress-add-to-cart",
  description: "Click Add to cart for the current AliExpress product page. Never checks out or places an order.",
  inputSchema: {
    type: "object",
    properties: {
      itemId: { type: "string", description: "Optional expected AliExpress item ID for the current page." },
      quantity: { type: "number", description: "Desired quantity. The action attempts to set it when a visible quantity input exists." }
    }
  },
  execute: function(params) {
    var expectedItemId = params && params.itemId ? String(params.itemId) : null;
    var quantity = params && params.quantity ? Number(params.quantity) : 1;
    if (!quantity || quantity < 1) quantity = 1;

    function textOf(node) {
      return node && node.textContent ? node.textContent.replace(/\s+/g, " ").trim() : "";
    }

    function attr(node, name) {
      return node && node.getAttribute ? node.getAttribute(name) : null;
    }

    function extractItemId(url) {
      var match = String(url || "").match(/\/item\/(\d+)\.html/i) || String(url || "").match(/[?&]productId=(\d+)/i);
      return match ? match[1] : null;
    }

    function isVisible(node) {
      if (!node || !node.getBoundingClientRect) return false;
      var rect = node.getBoundingClientRect();
      var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
      return rect.width > 0 && rect.height > 0 && (!style || (style.visibility !== "hidden" && style.display !== "none"));
    }

    function findButton(pattern) {
      var nodes = Array.prototype.slice.call(document.querySelectorAll('button, [role="button"], a, div'));
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var label = textOf(node) || attr(node, "aria-label") || attr(node, "title") || "";
        if (isVisible(node) && pattern.test(label)) return node;
      }
      return null;
    }

    function setQuantity(value) {
      var inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="number"], input[aria-label*="quantity" i], input[class*="quantity" i], input[class*="qty" i]'));
      var i;
      for (i = 0; i < inputs.length; i += 1) {
        if (isVisible(inputs[i])) {
          inputs[i].focus();
          inputs[i].value = String(value);
          inputs[i].dispatchEvent(new Event("input", { bubbles: true }));
          inputs[i].dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    }

    var bodyText = textOf(document.body);
    var warnings = [];
    if (/captcha|x5sec|punish|verify|robot|unusual traffic|security check/i.test(bodyText + " " + location.href)) {
      warnings.push("AliExpress appears to be showing a captcha, x5 challenge, or anti-bot verification page.");
    }

    var itemId = extractItemId(location.href);
    if (expectedItemId && itemId && expectedItemId !== itemId) {
      warnings.push("Expected itemId " + expectedItemId + " but page itemId is " + itemId + ".");
    }

    var addButton = findButton(/add\s+to\s+cart/i);
    var buyNowButton = findButton(/buy\s+now/i);
    var optionsLikelyMissing = /select|please choose|choose color|choose size|ship from/i.test(bodyText) && !addButton;
    var quantitySet = quantity > 1 ? setQuantity(quantity) : false;
    var clickScheduled = false;

    if (addButton && warnings.length === 0) {
      setTimeout(function() {
        addButton.click();
      }, 250);
      clickScheduled = true;
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: location.href,
          itemId: itemId,
          quantity: quantity,
          quantitySet: quantitySet,
          attempted: Boolean(addButton),
          clickScheduled: clickScheduled,
          buyNowVisible: Boolean(buyNowButton),
          optionsLikelyMissing: optionsLikelyMissing,
          message: addButton ? "Add to cart click scheduled. This action never checks out or places an order." : "No visible Add to cart button found. Select required options or resolve page prompts, then retry.",
          warnings: warnings
        }, null, 2)
      }]
    };
  }
})
```

Returns: JSON text describing whether the Add to cart click was scheduled and any warnings.
