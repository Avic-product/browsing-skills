# Facebook Marketplace — Seller Data Reference

## Requirements

**Auth:** A signed-in Facebook session is required for most Marketplace seller/profile pages. Use a real browser profile that is already logged in to facebook.com.

**Browser:** A real browser is required. If your agent does not have browser access, ask the user to install the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion and run the action in the user's existing Chrome session.

**Privacy:** Only extract information visible to the signed-in user. Do not bypass privacy controls or request hidden contact details.

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

## Action: marketplace-seller-data

Use when the user wants visible information from a Facebook Marketplace seller page or the seller section of a profile page.

**Navigate to:** A seller URL from a listing page, usually `https://www.facebook.com/marketplace/profile/<profile-id>/`, or a Facebook profile page that has Marketplace seller information visible.

**Code:**

```js
({
  name: "facebook-marketplace-seller-data",
  description: "Extract visible seller information and listing links from a Facebook Marketplace seller/profile page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      limit: { type: "number", description: "Maximum visible listings to return" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 30;

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

    var main = document.querySelector('[role="main"]') || document.body;
    var data = {
      url: window.location.href,
      name: "",
      profileUrl: window.location.href.split("?")[0],
      ratingText: "",
      marketplaceText: "",
      visibleListings: [],
      rawText: clean(main.textContent)
    };

    var heading = main.querySelector("h1, h2");
    data.name = heading ? clean(heading.textContent) : "";

    var nodes = main.querySelectorAll("span, div");
    for (var i = 0; i < nodes.length; i++) {
      var t = clean(nodes[i].textContent);
      if (!data.ratingText && /\b(\d+(\.\d+)?\s*(out of|\/)\s*5|rating|ratings|review|reviews)\b/i.test(t) && t.length < 160) data.ratingText = t;
      if (!data.marketplaceText && /\b(Marketplace|seller|joined|listings?|followers?)\b/i.test(t) && t.length < 220) data.marketplaceText = t;
    }

    var links = main.querySelectorAll('a[href*="/marketplace/item/"]');
    var seen = {};
    for (var j = 0; j < links.length && data.visibleListings.length < limit; j++) {
      var link = links[j];
      var href = absoluteUrl(link.getAttribute("href"));
      if (!href || seen[href]) continue;
      seen[href] = true;
      var card = link;
      for (var depth = 0; depth < 6 && card.parentElement; depth++) {
        if (card.textContent && clean(card.textContent).length > 15 && card.querySelector("img")) break;
        card = card.parentElement;
      }
      var text = clean(card.textContent || link.textContent);
      data.visibleListings.push({
        listingUrl: href,
        text: text,
        imageUrl: firstImage(card)
      });
    }

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#1c1e21;padding:22px;max-width:760px;margin:0 auto;">';
      h += '<h2 style="margin:0 0 8px;font-size:22px;">' + (data.name || "Marketplace seller") + '</h2>';
      h += '<div style="color:#606770;margin-bottom:8px;">' + (data.ratingText || data.marketplaceText || "") + '</div>';
      h += '<h3 style="font-size:16px;margin:18px 0 8px;">Visible listings</h3>';
      for (var k = 0; k < data.visibleListings.length; k++) {
        var r = data.visibleListings[k];
        h += '<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid #ddd;">';
        if (r.imageUrl) h += '<img src="' + r.imageUrl + '" style="width:72px;height:72px;object-fit:cover;border-radius:6px;">';
        h += '<div style="line-height:1.4;">' + r.text + '</div></div>';
      }
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, name, profileUrl, ratingText, marketplaceText, visibleListings: [{ listingUrl, text, imageUrl }], rawText }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `facebook.com` `marketplace-seller-data`.

