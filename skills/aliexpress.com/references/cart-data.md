# Read Cart

Navigate to:

`https://shoppingcart.aliexpress.com/shopcart/shopcartDetail.htm`

Use the browser's redirected AliExpress cart URL if the session changes hosts or paths.

```js
({
  name: "aliexpress-cart-data",
  description: "Read visible AliExpress cart contents without changing the cart.",
  inputSchema: {
    type: "object",
    properties: {}
  },
  execute: function(params) {
    function textOf(node) {
      return node && node.textContent ? node.textContent.replace(/\s+/g, " ").trim() : "";
    }

    function attr(node, name) {
      return node && node.getAttribute ? node.getAttribute(name) : null;
    }

    function absUrl(url) {
      try {
        return url ? new URL(url, location.href).href : null;
      } catch (err) {
        return url || null;
      }
    }

    function extractItemId(url) {
      var match = String(url || "").match(/\/item\/(\d+)\.html/i) || String(url || "").match(/[?&]productId=(\d+)/i);
      return match ? match[1] : null;
    }

    function closestItem(node) {
      var current = node;
      var depth = 0;
      while (current && current !== document.body && depth < 8) {
        var raw = textOf(current);
        var cls = attr(current, "class") || "";
        if (
          /(\$|US \$|€|£|subtotal|quantity|qty|shipping)/i.test(raw) &&
          /(cart|item|product|shop|seller|list|order)/i.test(cls + " " + current.tagName)
        ) {
          return current;
        }
        current = current.parentElement;
        depth += 1;
      }
      return node;
    }

    function extractPrice(raw) {
      var match = String(raw || "").match(/(US\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|€\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|£\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
      return match ? match[1].replace(/\s+/g, " ").trim() : null;
    }

    var bodyText = textOf(document.body);
    var warnings = [];
    if (/captcha|x5sec|punish|verify|robot|unusual traffic|security check/i.test(bodyText + " " + location.href)) {
      warnings.push("AliExpress appears to be showing a captcha, x5 challenge, or anti-bot verification page.");
    }
    if (/sign\s*in|log\s*in/i.test(bodyText) && !/checkout|subtotal|cart/i.test(bodyText)) {
      warnings.push("The cart may require sign-in before item details are visible.");
    }

    var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="/item/"], a[href*="item/"]'));
    var seen = {};
    var items = [];
    var i;

    for (i = 0; i < links.length; i += 1) {
      var link = links[i];
      var productUrl = absUrl(attr(link, "href"));
      var itemId = extractItemId(productUrl);
      if (!itemId || seen[itemId]) continue;

      var root = closestItem(link);
      var raw = textOf(root);
      if (!raw || raw.length < 10) continue;

      var title = attr(link, "title") || textOf(link);
      var img = root.querySelector("img");
      if ((!title || title.length < 5) && img) title = attr(img, "alt") || "";
      title = title.replace(/\s+/g, " ").trim();

      seen[itemId] = true;
      items.push({
        itemId: itemId,
        title: title || null,
        quantity: (raw.match(/(?:qty|quantity)\D{0,10}([0-9]+)/i) || raw.match(/\bQty\s*:\s*([0-9]+)/i) || [null, null])[1],
        price: extractPrice(raw),
        productUrl: productUrl,
        rawText: raw.slice(0, 900)
      });
    }

    var subtotal = (bodyText.match(/(?:subtotal|total)\D{0,40}(US\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|€\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|£\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/i) || [null, null])[1];
    var checkoutButtonVisible = Array.prototype.slice.call(document.querySelectorAll('button, [role="button"], a')).some(function(node) {
      return /checkout|buy from this seller|place order/i.test(textOf(node));
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: location.href,
          signedIn: !/sign\s*in|log\s*in/i.test(bodyText),
          subtotal: subtotal || null,
          itemCount: items.length,
          checkoutButtonVisible: checkoutButtonVisible,
          items: items,
          warnings: warnings
        }, null, 2)
      }]
    };
  }
})
```

Returns: JSON text with visible cart items, subtotal, checkout visibility, and warnings.
