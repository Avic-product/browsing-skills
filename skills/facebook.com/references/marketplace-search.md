# Facebook Marketplace — Search Reference

## Requirements

**Auth:** A signed-in Facebook session is required for most Marketplace pages. Use a real browser profile that is already logged in to facebook.com. Cookie injection is not recommended because Facebook uses multiple session cookies, device/session checks, and sometimes interactive challenges.

**Browser:** A real browser is required. If your agent does not have browser access, ask the user to install the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion and run the action in the user's existing Chrome session.

**Safety:** This action only reads visible search results. It does not click listings, message sellers, save items, or purchase anything.

## How to run this action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: marketplace-search

Use when the user wants to search Facebook Marketplace and extract the currently visible listing cards.

**Navigate to:** `https://www.facebook.com/marketplace/search/?query=<query>` (URL-encode the query).

For category/location/filter workflows, let the user or browser session apply filters in the Marketplace UI, then run this action on the filtered results page.

**Code:**

```js
({
  name: "facebook-marketplace-search",
  description: "Extract visible listings from a Facebook Marketplace search results page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      limit: { type: "number", description: "Maximum listings to return from the visible page" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 40;
    var data = {
      url: window.location.href,
      query: "",
      totalResults: 0,
      results: []
    };
    var urlParams = new URLSearchParams(window.location.search);
    data.query = urlParams.get("query") || urlParams.get("q") || "";

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function absoluteUrl(url) {
      if (!url) return "";
      try { return new URL(url, window.location.origin).href.split("?")[0]; }
      catch (e) { return url; }
    }

    function firstImage(el) {
      var imgs = el.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].currentSrc || imgs[i].src || "";
        if (src && src.indexOf("static.xx.fbcdn.net") === -1) return src;
      }
      return "";
    }

    function splitLines(text) {
      var raw = clean(text).split(/(?=\$|Free\b|CA\$|A\$|€|£)| · | \| /);
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var item = clean(raw[i]);
        if (item && out.indexOf(item) === -1) out.push(item);
      }
      return out;
    }

    var links = document.querySelectorAll('a[href*="/marketplace/item/"]');
    var seen = {};
    for (var i = 0; i < links.length && data.results.length < limit; i++) {
      var link = links[i];
      var href = absoluteUrl(link.getAttribute("href"));
      if (!href || seen[href]) continue;
      seen[href] = true;

      var card = link;
      for (var depth = 0; depth < 6 && card.parentElement; depth++) {
        if (card.textContent && clean(card.textContent).length > 20 && card.querySelector("img")) break;
        card = card.parentElement;
      }

      var text = clean(card.textContent || link.textContent);
      var lines = splitLines(text);
      var price = "";
      var title = "";
      var location = "";
      var metadata = [];
      for (var j = 0; j < lines.length; j++) {
        if (!price && /(^|\s)(free|[$€£]|CA\$|A\$)\s*/i.test(lines[j])) price = lines[j];
        else if (!title) title = lines[j];
        else if (!location && !/\bSponsored\b/i.test(lines[j])) location = lines[j];
        else metadata.push(lines[j]);
      }
      if (!title && link.getAttribute("aria-label")) title = clean(link.getAttribute("aria-label"));

      data.results.push({
        title: title,
        price: price,
        location: location,
        listingUrl: href,
        imageUrl: firstImage(card),
        text: text,
        metadata: metadata
      });
    }
    data.totalResults = data.results.length;

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f7f8fa;color:#1c1e21;padding:20px;max-width:760px;margin:0 auto;">';
      h += '<h2 style="margin:0 0 14px;font-size:20px;">Marketplace search: ' + clean(data.query || "visible results") + '</h2>';
      for (var k = 0; k < data.results.length; k++) {
        var r = data.results[k];
        h += '<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid #ddd;">';
        if (r.imageUrl) h += '<img src="' + r.imageUrl + '" style="width:96px;height:96px;object-fit:cover;border-radius:6px;">';
        h += '<div><div style="font-weight:700;">' + (r.price || "") + '</div><div>' + (r.title || "Untitled listing") + '</div><div style="color:#606770;font-size:13px;">' + (r.location || "") + '</div></div></div>';
      }
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, results: [{ title, price, location, listingUrl, imageUrl, text, metadata }], totalResults }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `facebook.com` `marketplace-search`.

