# Facebook Marketplace — Listing Data Reference

## Requirements

**Auth:** A signed-in Facebook session is required for most Marketplace listings. Use a real browser profile that is already logged in to facebook.com.

**Browser:** A real browser is required. If your agent does not have browser access, ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion and run the action in the user's existing Chrome session.

**Safety:** This action only reads visible listing details. It does not message sellers, make offers, save items, or purchase anything.

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

## Action: marketplace-listing-data

Use when the user wants details from a specific Facebook Marketplace listing.

**Navigate to:** `https://www.facebook.com/marketplace/item/<listing-id>/`

**Code:**

```js
({
  name: "facebook-marketplace-listing-data",
  description: "Extract visible details from a Facebook Marketplace listing page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      includeImages: { type: "boolean", description: "Whether to include visible image URLs" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var includeImages = !params || params.includeImages !== false;

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function uniqPush(arr, value) {
      if (value && arr.indexOf(value) === -1) arr.push(value);
    }

    function absoluteUrl(url) {
      if (!url) return "";
      try { return new URL(url, window.location.origin).href.split("?")[0]; }
      catch (e) { return url; }
    }

    function textNear(label) {
      var all = document.querySelectorAll('span, div, h1, h2, h3');
      var needle = label.toLowerCase();
      for (var i = 0; i < all.length; i++) {
        var t = clean(all[i].textContent);
        if (t.toLowerCase() === needle && all[i].parentElement) {
          var parentText = clean(all[i].parentElement.textContent);
          var value = clean(parentText.replace(new RegExp("^" + label + "\\s*", "i"), ""));
          if (value && value.toLowerCase() !== needle) return value;
          var next = all[i].parentElement.nextElementSibling;
          if (next) return clean(next.textContent);
        }
      }
      return "";
    }

    var data = {
      url: window.location.href,
      listingId: "",
      title: "",
      price: "",
      location: "",
      sellerName: "",
      sellerProfileUrl: "",
      description: "",
      condition: "",
      category: "",
      availability: "",
      images: [],
      details: {},
      rawText: ""
    };

    var idMatch = window.location.href.match(/\/marketplace\/item\/([^/?#]+)/);
    data.listingId = idMatch ? idMatch[1] : "";
    var main = document.querySelector('[role="main"]') || document.body;
    data.rawText = clean(main.textContent);

    var h1 = main.querySelector("h1");
    data.title = h1 ? clean(h1.textContent) : "";

    var textNodes = main.querySelectorAll("span, div");
    for (var i = 0; i < textNodes.length; i++) {
      var text = clean(textNodes[i].textContent);
      if (!data.price && /^(free|[$€£]|CA\$|A\$)\s*/i.test(text) && text.length < 80) data.price = text;
      if (!data.availability && /\b(sold|pending|available|listed)\b/i.test(text) && text.length < 80) data.availability = text;
    }

    data.location = textNear("Location") || textNear("Seller's location");
    data.condition = textNear("Condition");
    data.category = textNear("Category");
    data.description = textNear("Description");

    var sellerLinks = main.querySelectorAll('a[href*="/marketplace/profile/"], a[href*="facebook.com/profile.php"], a[href^="/profile.php"], a[href^="/people/"]');
    if (sellerLinks.length > 0) {
      data.sellerProfileUrl = absoluteUrl(sellerLinks[0].getAttribute("href"));
      data.sellerName = clean(sellerLinks[0].textContent || sellerLinks[0].getAttribute("aria-label"));
    }

    if (includeImages) {
      var imgs = main.querySelectorAll("img");
      for (var j = 0; j < imgs.length; j++) {
        var src = imgs[j].currentSrc || imgs[j].src || "";
        if (src && src.indexOf("static.xx.fbcdn.net") === -1) uniqPush(data.images, src);
      }
    }

    var possibleLabels = ["Brand", "Size", "Color", "Material", "Model", "Vehicle type", "Year", "Mileage", "Fuel type", "Transmission", "Bedrooms", "Bathrooms"];
    for (var k = 0; k < possibleLabels.length; k++) {
      var val = textNear(possibleLabels[k]);
      if (val) data.details[possibleLabels[k]] = val;
    }

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#1c1e21;padding:22px;max-width:760px;margin:0 auto;">';
      h += '<h2 style="margin:0 0 8px;font-size:22px;">' + (data.title || "Marketplace listing") + '</h2>';
      h += '<div style="font-weight:700;font-size:18px;margin-bottom:8px;">' + (data.price || "") + '</div>';
      h += '<div style="color:#606770;margin-bottom:14px;">' + (data.location || "") + '</div>';
      if (data.images.length) h += '<img src="' + data.images[0] + '" style="width:100%;max-height:360px;object-fit:cover;border-radius:8px;margin-bottom:16px;">';
      h += '<p style="line-height:1.5;">' + (data.description || "") + '</p>';
      h += '<div style="color:#606770;">Seller: ' + (data.sellerName || "Unknown") + '</div></div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, listingId, title, price, location, sellerName, sellerProfileUrl, description, condition, category, availability, images, details, rawText }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `facebook.com` `marketplace-listing-data`.

