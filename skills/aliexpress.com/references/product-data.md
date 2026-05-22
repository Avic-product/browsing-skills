# Get Product Data

Navigate to:

An AliExpress product detail page, typically:

`https://www.aliexpress.com/item/<itemId>.html`

```js
({
  name: "aliexpress-product-data",
  description: "Extract visible product data from an AliExpress product detail page.",
  inputSchema: {
    type: "object",
    properties: {
      itemId: { type: "string", description: "Optional expected AliExpress item ID." }
    }
  },
  execute: function(params) {
    var expectedItemId = params && params.itemId ? String(params.itemId) : null;

    function textOf(node) {
      return node && node.textContent ? node.textContent.replace(/\s+/g, " ").trim() : "";
    }

    function attr(node, name) {
      return node && node.getAttribute ? node.getAttribute(name) : null;
    }

    function pickText(selectors) {
      var i;
      for (i = 0; i < selectors.length; i += 1) {
        var node = document.querySelector(selectors[i]);
        var value = textOf(node);
        if (value) return value;
      }
      return null;
    }

    function pickAttr(selectors, name) {
      var i;
      for (i = 0; i < selectors.length; i += 1) {
        var node = document.querySelector(selectors[i]);
        var value = attr(node, name);
        if (value) return value;
      }
      return null;
    }

    function extractItemId(url) {
      var match = String(url || "").match(/\/item\/(\d+)\.html/i) || String(url || "").match(/[?&]productId=(\d+)/i);
      return match ? match[1] : null;
    }

    function absUrl(url) {
      try {
        return url ? new URL(url, location.href).href : null;
      } catch (err) {
        return url || null;
      }
    }

    function extractPrice(raw) {
      var text = raw || "";
      var patterns = [
        /(US\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?(?:\s*-\s*US\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)?)/i,
        /(\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?(?:\s*-\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)?)/,
        /(€\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
        /(£\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/
      ];
      var i;
      for (i = 0; i < patterns.length; i += 1) {
        var match = text.match(patterns[i]);
        if (match) return match[1].replace(/\s+/g, " ").trim();
      }
      return null;
    }

    function visibleButtons() {
      return Array.prototype.slice.call(document.querySelectorAll('button, [role="button"], a')).filter(function(node) {
        var box = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
        return box.width > 0 && box.height > 0 && textOf(node);
      });
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

    var title = pickText(["h1", '[class*="title"] h1', '[data-pl="product-title"]']) ||
      pickAttr(['meta[property="og:title"]', 'meta[name="title"]'], "content");

    var price = pickText(['[class*="price"]', '[data-pl*="price"]']) ||
      pickAttr(['meta[property="product:price:amount"]', 'meta[property="og:price:amount"]'], "content") ||
      extractPrice(bodyText);

    var seller = pickText(['[class*="store-name"]', '[class*="seller"]', 'a[href*="/store/"]']);
    var rating = (bodyText.match(/([0-5](?:\.[0-9])?)\s*(?:stars?|rating)/i) || [null, null])[1];
    var reviewCount = (bodyText.match(/([0-9,.]+)\s*(?:reviews?|ratings?)/i) || [null, null])[1];
    var sold = (bodyText.match(/([0-9,.]+[KkMm]?)\s*sold/i) || [null, null])[1];
    var shipping = (bodyText.match(/(?:free\s+shipping|shipping[^.]{0,120}|delivery[^.]{0,120})/i) || [null])[0];

    var variantNodes = Array.prototype.slice.call(document.querySelectorAll('[class*="sku"], [class*="option"], [class*="spec"], [class*="variant"] button, [class*="variant"] img'));
    var variants = [];
    var seenVariant = {};
    var i;
    for (i = 0; i < variantNodes.length && variants.length < 40; i += 1) {
      var variantText = textOf(variantNodes[i]) || attr(variantNodes[i], "alt") || attr(variantNodes[i], "title");
      if (variantText && !seenVariant[variantText]) {
        seenVariant[variantText] = true;
        variants.push(variantText.slice(0, 120));
      }
    }

    var imageNodes = Array.prototype.slice.call(document.querySelectorAll('img[src*="alicdn"], img[data-src*="alicdn"], meta[property="og:image"]'));
    var images = [];
    var seenImage = {};
    for (i = 0; i < imageNodes.length && images.length < 20; i += 1) {
      var imageUrl = attr(imageNodes[i], "content") || attr(imageNodes[i], "src") || attr(imageNodes[i], "data-src");
      if (imageUrl && /^\/\//.test(imageUrl)) imageUrl = location.protocol + imageUrl;
      imageUrl = absUrl(imageUrl);
      if (imageUrl && !seenImage[imageUrl]) {
        seenImage[imageUrl] = true;
        images.push(imageUrl);
      }
    }

    var buttons = visibleButtons();
    var buttonText = buttons.map(function(button) { return textOf(button); }).join(" | ");
    var addToCartAvailable = /add\s+to\s+cart/i.test(buttonText);
    var buyNowVisible = /buy\s+now/i.test(buttonText);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: location.href,
          itemId: itemId,
          title: title,
          price: price,
          seller: seller,
          rating: rating,
          reviewCount: reviewCount,
          sold: sold,
          shipping: shipping,
          variants: variants,
          images: images,
          addToCartAvailable: addToCartAvailable,
          buyNowVisible: buyNowVisible,
          warnings: warnings
        }, null, 2)
      }]
    };
  }
})
```

Returns: JSON text with visible product details and warnings.
