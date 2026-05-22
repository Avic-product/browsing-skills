# Amazon.com — Grocery Storefront Reference

## Requirements

**Browser:** Required for reliable grocery storefront extraction. Amazon Fresh and Whole Foods pages render modules client-side and vary heavily by location, account, and experiments.

**Login / location:** Strongly recommended. Without a selected address or eligible service area, grocery product cards may show limited data, out-of-stock messaging, or no personalized availability.

**Safety:** This action only reads visible storefront modules, navigation, and product cards. It does not add items, clip coupons, change address, select delivery windows, or buy anything.

## How to run this action

Once the storefront or grocery page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: grocery-storefront

Use when the user wants to inspect Amazon Fresh, Whole Foods, grocery deals, aisles, storefront modules, or visible grocery product cards.

**Navigate to:** one of:

- `https://www.amazon.com/amazonfresh`
- `https://www.amazon.com/fmc/storefront/fresh?almBrandId=QW1hem9uIEZyZXNo`
- `https://www.amazon.com/wholefoods`
- A grocery aisle, deal, merchcontent, Past Purchases, Repeat Items, or search page that is already open in the user's browser session.

**Code:**

```js
({
  name: "amazon-grocery-storefront",
  description: "Extract visible Amazon Fresh or Whole Foods storefront modules, links, and grocery product cards",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      limit: { type: "number", description: "Maximum product cards to return" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 80;

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function dedupeRepeated(text) {
      text = clean(text);
      if (text.length > 4 && text.length % 2 === 0) {
        var half = text.slice(0, text.length / 2);
        if (half === text.slice(text.length / 2)) return half;
      }
      return text;
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

    function headingFor(node) {
      var current = node;
      for (var depth = 0; depth < 8 && current; depth++) {
        var heading = current.querySelector && current.querySelector("h1, h2, h3, [role='heading']");
        var text = clean(heading ? heading.textContent : "");
        if (text) return clean(text.replace(/\s*See more\s*$/i, ""));
        current = current.parentElement;
      }
      return "";
    }

    function firstImage(root) {
      var img = root.querySelector("img");
      return img ? img.currentSrc || img.src || img.getAttribute("data-src") || "" : "";
    }

    function priceFrom(root) {
      var offscreen = root.querySelector(".a-price .a-offscreen");
      if (offscreen) return clean(offscreen.textContent);
      var t = clean(root.textContent);
      var m = t.match(/(?:[$€£]|USD|EUR|GBP)\s?[0-9][0-9.,]*/);
      return m ? m[0] : "";
    }

    function cardTitle(root) {
      var selectors = [".p13nTitle", ".a-truncate-full", "a[aria-label]", "img[alt]"];
      for (var i = 0; i < selectors.length; i++) {
        var el = root.querySelector(selectors[i]);
        var t = clean(el ? el.textContent || el.getAttribute("aria-label") || el.getAttribute("alt") : "");
        if (t) return dedupeRepeated(t);
      }
      return "";
    }

    var bodyText = document.body ? document.body.textContent || "" : "";
    function pageStateBrand() {
      var states = document.querySelectorAll('script[type="a-state"]');
      for (var i = 0; i < states.length; i++) {
        var attr = states[i].getAttribute("data-a-state") || "";
        if (attr.indexOf("FMCPageState") !== -1) {
          try {
            var parsed = JSON.parse(states[i].textContent || "{}");
            if (parsed.displayName) return parsed.displayName;
          } catch (e) {}
        }
      }
      return "";
    }

    var accountText = clean((document.querySelector("#nav-link-accountList") || {}).textContent || "");
    var data = {
      url: window.location.href,
      title: document.title,
      brand: pageStateBrand() || (/amazonfresh|amazon fresh|almBrandId=QW1hem9uIEZyZXNo/i.test(bodyText + " " + window.location.href) ? "Amazon Fresh" : (/whole foods/i.test(bodyText + " " + window.location.href) ? "Whole Foods Market" : "")),
      locationText: clean((document.querySelector("#glow-ingress-line2") || {}).textContent || ""),
      signedIn: !/sign\s*in|signin|hello,\s*sign/i.test(accountText),
      navigationLinks: [],
      modules: [],
      products: [],
      totalProducts: 0,
      warnings: []
    };

    var navLinks = document.querySelectorAll("a[href*='almBrandId'], a[href*='/fmc/'], a[href*='/afx/'], a[href*='/repeatitems/'], a[href*='/wholefoods'], a[href*='/cart/localmarket']");
    var seenLinks = {};
    for (var i = 0; i < navLinks.length && data.navigationLinks.length < 60; i++) {
      var href = absUrl(navLinks[i].getAttribute("href"));
      var text = clean(navLinks[i].textContent || navLinks[i].getAttribute("aria-label"));
      if (/\/ap\/(?:signin|register)/i.test(href) || /^hello,\s*sign in|^sign in$|^start here\.?$/i.test(text)) continue;
      if (!href || seenLinks[href + text]) continue;
      seenLinks[href + text] = true;
      data.navigationLinks.push({ text: text, url: href });
    }

    var moduleRoots = document.querySelectorAll("[data-card-metrics-id], .alm-carousel-desktop, .alm-cards-carousel-ro-container, [data-carouselHeadingAttributesString]");
    for (var m = 0; m < moduleRoots.length && data.modules.length < 30; m++) {
      var root = moduleRoots[m];
      var heading = headingFor(root);
      var metricId = root.getAttribute("data-card-metrics-id") || "";
      var productCount = root.querySelectorAll("[data-csa-c-item-id*='asin'], [data-asin], a[href*='/dp/']").length;
      if (heading || metricId || productCount) data.modules.push({ heading: heading, metricId: metricId, productCount: productCount });
    }

    var cards = document.querySelectorAll("[data-csa-c-item-id*='asin'], [data-csa-c-item-type='asin'], [data-asin], li.a-carousel-card, [id^='almAtcBadge-']");
    var seen = {};
    for (var c = 0; c < cards.length && data.products.length < limit; c++) {
      var card = cards[c];
      var container = card;
      for (var d = 0; d < 4 && container.parentElement; d++) {
        if (container.querySelector && container.querySelector("a[href*='/dp/']") && clean(container.textContent).length > 20) break;
        container = container.parentElement;
      }
      var attr = card.getAttribute("data-csa-c-item-id") || card.getAttribute("data-asin") || card.id || "";
      var match = attr.match(/([A-Z0-9]{10})/);
      var link = container.querySelector("a[href*='/dp/'], a[href*='/gp/product/']");
      var href = absUrl(link ? link.getAttribute("href") : "");
      var asinFromUrl = href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      var asin = match ? match[1] : (asinFromUrl ? asinFromUrl[1].toUpperCase() : "");
      var title = cardTitle(container);
      var key = asin || href || title;
      if (!key || seen[key]) continue;
      seen[key] = true;
      var text = clean(container.textContent);
      data.products.push({
        asin: asin,
        title: dedupeRepeated(title),
        price: priceFrom(container),
        availability: (text.match(/\b(out of stock|in stock|available|currently unavailable|pickup|delivery)\b/i) || [""])[0],
        moduleHeading: headingFor(container),
        productUrl: href,
        imageUrl: firstImage(container),
        inCart: /in cart|data-isItemInCart="true"/i.test(text + " " + container.outerHTML),
        rawText: text
      });
    }
    data.totalProducts = data.products.length;

    if (data.totalProducts === 0) data.warnings.push("No grocery product cards were visible. Select a delivery location, sign in if needed, or open a Fresh/Whole Foods aisle or storefront page.");
    if (/captcha|enter the characters you see below|robot check/i.test(bodyText)) data.warnings.push("Amazon appears to be showing a bot check or CAPTCHA page.");

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:20px;max-width:900px;margin:0 auto;">';
      h += '<h2 style="font-size:20px;margin:0 0 12px;">' + (data.brand || "Amazon grocery") + '</h2>';
      for (var i2 = 0; i2 < data.products.length; i2++) {
        var p = data.products[i2];
        h += '<div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid #ddd;">';
        if (p.imageUrl) h += '<img src="' + p.imageUrl + '" style="width:76px;height:76px;object-fit:contain;">';
        h += '<div><div style="font-weight:700;">' + (p.title || p.asin || "Grocery item") + '</div>';
        h += '<div>' + [p.price, p.availability, p.moduleHeading].filter(Boolean).join(" · ") + '</div></div></div>';
      }
      if (data.warnings.length) h += '<p style="color:#8a5200;">' + data.warnings.join(" ") + '</p>';
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, title, brand, locationText, signedIn, navigationLinks, modules, products: [{ asin, title, price, availability, moduleHeading, productUrl, imageUrl, inCart, rawText }], totalProducts, warnings }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `amazon.com` `grocery-storefront`.
