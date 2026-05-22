# Search Products

Navigate to:

`https://www.aliexpress.com/w/wholesale-<query>.html`

For regional sessions, AliExpress may redirect to a country-specific host such as `www.aliexpress.us`. Use the browser's resulting URL.

```js
({
  name: "aliexpress-search",
  description: "Search AliExpress visible product listings and return normalized results.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query to inspect." },
      maxResults: { type: "number", description: "Maximum number of visible results to return. Defaults to 20." }
    },
    required: ["query"]
  },
  execute: function(params) {
    var query = params && params.query ? String(params.query) : "";
    var maxResults = params && params.maxResults ? Number(params.maxResults) : 20;
    if (!maxResults || maxResults < 1) maxResults = 20;

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

    function closestCard(node) {
      var current = node;
      var depth = 0;
      while (current && current !== document.body && depth < 8) {
        var raw = textOf(current);
        var cls = attr(current, "class") || "";
        if (
          /(\$|US \$|€|£|AU \$|CA \$|\bAED\b|\bSAR\b)/i.test(raw) &&
          /(item|product|search|card|gallery|manhattan|list|grid)/i.test(cls + " " + current.tagName)
        ) {
          return current;
        }
        current = current.parentElement;
        depth += 1;
      }
      return node;
    }

    function extractItemId(url) {
      var match = String(url || "").match(/\/item\/(\d+)\.html/i) || String(url || "").match(/[?&]productId=(\d+)/i);
      return match ? match[1] : null;
    }

    function extractPrice(raw) {
      var text = raw || "";
      var patterns = [
        /(US\s*\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
        /(\$\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
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

    function firstImage(card, link) {
      var img = card.querySelector("img") || (link ? link.querySelector("img") : null);
      var url = attr(img, "src") || attr(img, "data-src") || attr(img, "data-spm-anchor-id");
      if (url && /^\/\//.test(url)) url = location.protocol + url;
      return url || null;
    }

    var pageText = textOf(document.body);
    var warnings = [];
    if (/captcha|x5sec|punish|verify|robot|unusual traffic|security check/i.test(pageText + " " + location.href)) {
      warnings.push("AliExpress appears to be showing a captcha, x5 challenge, or anti-bot verification page.");
    }

    var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="/item/"], a[href*="item/"]'));
    var seen = {};
    var results = [];
    var i;

    for (i = 0; i < links.length && results.length < maxResults; i += 1) {
      var link = links[i];
      var productUrl = absUrl(attr(link, "href"));
      var itemId = extractItemId(productUrl);
      if (!productUrl || !itemId || seen[itemId]) continue;

      var card = closestCard(link);
      var raw = textOf(card);
      if (!raw || raw.length < 10) continue;

      var title = attr(link, "title") || textOf(link);
      var img = card.querySelector("img") || link.querySelector("img");
      if ((!title || title.length < 6) && img) title = attr(img, "alt") || "";
      title = title.replace(/\s+/g, " ").trim();
      if (!title || title.length < 4) continue;

      seen[itemId] = true;
      results.push({
        itemId: itemId,
        title: title,
        price: extractPrice(raw),
        rating: (raw.match(/([0-5](?:\.[0-9])?)\s*(?:stars?|rating)/i) || [null, null])[1],
        sold: (raw.match(/([0-9,.]+[KkMm]?)\s*sold/i) || [null, null])[1],
        shipping: (raw.match(/(?:free\s+shipping|shipping[^|]{0,60})/i) || [null])[0],
        sponsored: /(^|\s)(ad|sponsored)(\s|$)/i.test(raw),
        productUrl: productUrl,
        imageUrl: firstImage(card, link),
        rawText: raw.slice(0, 900)
      });
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: location.href,
          query: query,
          results: results,
          totalResults: results.length,
          warnings: warnings
        }, null, 2)
      }]
    };
  }
})
```

Returns: JSON text with `url`, `query`, `results`, `totalResults`, and `warnings`.
