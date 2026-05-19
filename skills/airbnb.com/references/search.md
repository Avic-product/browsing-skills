# Airbnb — Search Reference

## Requirements

**Browser:** Required. Airbnb search pages are JavaScript-rendered and the useful listing cards usually appear after hydration. Use Playwright, a built-in Chromium integration, or the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion.

**Login:** Not required for normal public stay search. Logged-in sessions may show personalized results, saved-list buttons, or different prices, but this action reads only visible public result cards.

**Currency / language:** Airbnb auto-detects from IP, locale, and cookies. To make output easier to compare, use the same browser profile and region for repeated runs.

## How to run this action

Navigate to the search URL, wait for results to render, optionally scroll to load more cards, then execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: search

Use when the user wants to find Airbnb stays matching destination, dates, guest count, and filters.

### URL

```
https://www.airbnb.com/s/<destination>/homes
  ?checkin=YYYY-MM-DD
  &checkout=YYYY-MM-DD
  &adults=N
  &children=N
  &infants=N
  &pets=N
  &price_min=N
  &price_max=N
  &room_types[]=Entire%20home%2Fapt
  &room_types[]=Private%20room
  &min_beds=N
  &min_bedrooms=N
  &min_bathrooms=N
```

The destination path is flexible: `/s/Paris--France/homes`, `/s/New-York--NY--United-States/homes`, or `/s/<URL-encoded query>/homes`. Airbnb may rewrite the URL with internal place IDs and map bounds after search.

**Code:**

```js
({
  name: "airbnb-search",
  description: "Extract visible stay cards from an Airbnb search results page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      limit: { type: "number", description: "Maximum visible result cards to return" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 40;

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
        if (src && src.indexOf("muscache.com") >= 0) return src;
      }
      return "";
    }

    function normalizeRoomUrl(url) {
      var abs = absoluteUrl(url);
      var match = abs.match(/\/rooms\/(\d+)/);
      return match ? "https://www.airbnb.com/rooms/" + match[1] : abs;
    }

    function splitCardText(text) {
      var compact = clean(text);
      compact = compact.replace(/Guest favorite/g, "Guest favorite|");
      compact = compact.replace(/Superhost/g, "Superhost|");
      compact = compact.replace(/(\d+(?:\.\d+)?)\s*out of 5/g, "$1 out of 5|");
      compact = compact.replace(/(\$|€|£|CA\$|A\$)\s?([0-9][0-9,.]*)/g, "|$1$2");
      compact = compact.replace(/Show price breakdown/g, "|Show price breakdown");
      var raw = compact.split("|");
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var item = clean(raw[i]);
        if (item && out.indexOf(item) === -1) out.push(item);
      }
      return out;
    }

    function parseLocationTitle(text) {
      var out = { location: "", title: "" };
      var t = clean(text).replace(/Guest favorite/g, "").replace(/Superhost/g, "");
      var types = "Apartment|Condo|Home|House|Villa|Cabin|Loft|Guesthouse|Guest suite|Townhouse|Rental unit|Room|Place|Bed and breakfast|Tiny home|Cottage|Serviced apartment";
      var re = new RegExp("^((?:" + types + ") in )([^0-9€$£]+?)(?:\\d+\\s*(?:bedroom|bed|bath|guest)|Studio|Individual host|Professional host|Hosted by|€|\\$|£|Show price)", "i");
      var match = t.match(re);
      if (match) {
        var prefix = clean(match[1]);
        var rest = clean(match[2]);
        var boundary = rest.search(/[a-zà-ÿ][A-Z]/);
        if (boundary >= 0) {
          out.location = prefix + " " + clean(rest.substring(0, boundary + 1));
          out.title = clean(rest.substring(boundary + 1));
        } else {
          out.location = prefix + " " + rest;
        }
      }
      return out;
    }

    var data = {
      url: window.location.href,
      query: "",
      checkin: "",
      checkout: "",
      adults: "",
      children: "",
      results: [],
      totalResults: 0
    };

    var paramsObj = new URLSearchParams(window.location.search);
    data.checkin = paramsObj.get("checkin") || paramsObj.get("check_in") || "";
    data.checkout = paramsObj.get("checkout") || paramsObj.get("check_out") || "";
    data.adults = paramsObj.get("adults") || "";
    data.children = paramsObj.get("children") || "";
    var pathMatch = window.location.pathname.match(/\/s\/([^/]+)/);
    data.query = pathMatch ? decodeURIComponent(pathMatch[1]).replace(/--/g, ", ").replace(/-/g, " ") : "";

    var links = document.querySelectorAll('a[href*="/rooms/"]');
    var seen = {};
    for (var i = 0; i < links.length && data.results.length < limit; i++) {
      var link = links[i];
      var roomUrl = normalizeRoomUrl(link.getAttribute("href"));
      var idMatch = roomUrl.match(/\/rooms\/(\d+)/);
      if (!idMatch || seen[roomUrl]) continue;
      seen[roomUrl] = true;

      var card = link;
      for (var depth = 0; depth < 7 && card.parentElement; depth++) {
        if (card.querySelector("img") && clean(card.textContent).length > 25) break;
        card = card.parentElement;
      }

      var text = clean(card.textContent || link.textContent);
      var lines = splitCardText(text);
      var result = {
        listingId: idMatch[1],
        title: "",
        subtitle: "",
        location: "",
        price: "",
        rating: "",
        badges: [],
        listingUrl: roomUrl,
        imageUrl: firstImage(card),
        text: text
      };

      var aria = clean(link.getAttribute("aria-label"));
      if (aria && aria.indexOf("Show all photos") === -1) result.title = aria;

      var parsed = parseLocationTitle(text);
      if (parsed.location) result.location = parsed.location;
      if (parsed.title) result.title = parsed.title;

      for (var j = 0; j < lines.length; j++) {
        if (/Show price breakdown/i.test(lines[j])) continue;
        if (!result.price && /^(Price: )?([$€£]|CA\$|A\$|USD|EUR|GBP)/i.test(lines[j])) result.price = lines[j].replace(/^Price:\s*/i, "");
        else if (!result.rating && /(\d+(?:\.\d+)?)\s*(out of 5|stars?)|★/.test(lines[j])) result.rating = lines[j];
        else if (/Guest favorite|Superhost/i.test(lines[j])) result.badges.push(lines[j]);
        else if (!result.location) result.location = lines[j];
        else if (!result.title) result.title = lines[j];
        else if (!result.subtitle) result.subtitle = lines[j];
      }

      data.results.push(result);
    }
    data.totalResults = data.results.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#222;padding:20px;max-width:860px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 14px;font-size:22px;'>Airbnb search: " + (data.query || "visible results") + "</h2>";
      for (var k = 0; k < data.results.length; k++) {
        var r = data.results[k];
        h += "<div style='display:flex;gap:12px;padding:12px 0;border-top:1px solid #ddd;'>";
        if (r.imageUrl) h += "<img src='" + r.imageUrl + "' style='width:128px;height:96px;object-fit:cover;border-radius:8px;'>";
        h += "<div><div style='font-weight:700;'>" + (r.title || r.location || "Airbnb stay") + "</div>";
        h += "<div style='color:#555;'>" + (r.subtitle || "") + "</div>";
        h += "<div style='margin-top:6px;'>" + (r.price || "") + "</div>";
        if (r.rating) h += "<div style='color:#555;font-size:13px;'>" + r.rating + "</div>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, checkin, checkout, adults, children, results: [{ listingId, title, subtitle, location, price, rating, badges, listingUrl, imageUrl, text }], totalResults }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `airbnb.com` `search`.

