# Booking.com — Hotel Data Reference

## Requirements

**Browser:** Required for every action. Booking serves bot-challenge pages to plain `fetch` requests (you'll see `?chal_t=` appended to URLs). Use Playwright, a built-in Chromium integration, or the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion (which runs scripts in the user's already-open Chrome session — no challenge to solve).

**Login:** Optional. Logged-in sessions get personalized prices, Genius discounts, and saved preferences. If the user wants logged-in pricing, ensure the bridge connects to a Chrome profile that's already signed in to booking.com — Booking's auth is cookie-based but the cookies are split across multiple HttpOnly entries, so a user-provided cookie injection isn't practical. The user's real Chrome session is the simplest path.

**Currency / language:** Booking auto-detects from IP and account settings. To force a currency, append `&selected_currency=EUR` (or USD, GBP, etc.) to any search/hotel URL.

## How to run this action

Once the right URL is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: hotel-data

Use when the user wants details for a specific property — name, address, score, rooms, amenities, photos.

**Navigate to:** `https://www.booking.com/hotel/<cc>/<slug>.html?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&group_adults=N&no_rooms=1` (the `checkin`/`checkout` params are required for room prices to render).

**Code:**

```js
({
  name: "booking-hotel-data",
  description: "Extract a Booking.com property's name, address, score, rooms, amenities, and photos",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data (default) returns JSON. display returns self-contained HTML." }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    data.url = window.location.href.split("?")[0];

    var ldNodes = document.querySelectorAll("script[type=\"application/ld+json\"]");
    var ld = null;
    for (var i = 0; i < ldNodes.length; i++) {
      try {
        var p = JSON.parse(ldNodes[i].textContent);
        if (p && p["@type"] === "Hotel") { ld = p; break; }
      } catch (e) {}
    }
    if (ld) {
      data.name = ld.name || "";
      data.description = ld.description || "";
      data.priceRange = ld.priceRange || "";
      if (ld.address) {
        data.address = ld.address.streetAddress || "";
        data.postalCode = ld.address.postalCode || "";
        data.country = ld.address.addressCountry || "";
        data.region = ld.address.addressRegion || "";
      }
      if (ld.aggregateRating) {
        data.reviewScore = ld.aggregateRating.ratingValue || "";
        data.reviewCount = ld.aggregateRating.reviewCount || "";
        data.reviewBest = ld.aggregateRating.bestRating || "";
      }
    }

    var nameEl = document.querySelector("h2.pp-header__title");
    if (nameEl && !data.name) data.name = nameEl.textContent.trim();

    var amenityEls = document.querySelectorAll("[data-testid=property-most-popular-facilities-wrapper] li");
    data.popularAmenities = [];
    for (var a = 0; a < amenityEls.length; a++) {
      var t = amenityEls[a].textContent.trim().replace(/\s+/g, " ");
      if (t) data.popularAmenities.push(t);
    }

    var imgs = document.querySelectorAll("img[src*=\"bstatic.com\"]");
    var seen = {};
    data.photos = [];
    for (var k = 0; k < imgs.length; k++) {
      var src = imgs[k].src.split("?")[0];
      if (src.indexOf("/hotel/") < 0 && src.indexOf("/xphoto/") < 0) continue;
      var hi = src.replace(/\/(square60|square100|square200|max300|max500|max800|max1024x768|max1280x900)\//, "/max1024x768/");
      if (seen[hi]) continue;
      seen[hi] = true;
      data.photos.push(hi);
    }

    var rows = document.querySelectorAll("#hprt-table tbody tr");
    data.rooms = [];
    var currentName = "";
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var nameLink = row.querySelector(".hprt-roomtype-link, .hprt-roomtype-name");
      if (nameLink) currentName = nameLink.textContent.trim().replace(/\s+/g, " ");
      var sel = row.querySelector("select[name^=nr_rooms_]");
      if (!sel) continue;
      var blockId = row.getAttribute("data-hotel-rounded") || (sel.name || "").replace(/^nr_rooms_/, "");
      var priceEl = row.querySelector(".bui-price-display__value, .prco-valign-middle-helper");
      var policyEls = row.querySelectorAll(".bui-list--text, .e2e2a3d8a5");
      var policies = [];
      for (var pi = 0; pi < policyEls.length; pi++) {
        var pt = policyEls[pi].textContent.trim().replace(/\s+/g, " ");
        if (pt && policies.indexOf(pt) < 0) policies.push(pt);
      }
      var maxQty = sel.options.length > 0 ? sel.options[sel.options.length - 1].value : "0";
      data.rooms.push({
        roomName: currentName,
        blockId: blockId,
        price: priceEl ? priceEl.textContent.trim() : "",
        maxQuantity: maxQty,
        policies: policies.slice(0, 4)
      });
    }

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,sans-serif;background:#fff;color:#1a1a1a;padding:16px;max-width:820px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 6px'>" + (data.name || "") + "</h2>";
      if (data.address) h += "<div style='color:#666;margin-bottom:8px'>" + data.address + "</div>";
      if (data.reviewScore) h += "<div style='margin-bottom:12px'><strong>" + data.reviewScore + "/" + (data.reviewBest || "10") + "</strong> (" + (data.reviewCount || 0) + " reviews)</div>";
      if (data.photos.length) {
        h += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px'>";
        for (var ph = 0; ph < Math.min(data.photos.length, 6); ph++) h += "<img src='" + data.photos[ph] + "' style='width:120px;height:90px;object-fit:cover;border-radius:6px'>";
        h += "</div>";
      }
      if (data.description) h += "<div style='margin-bottom:12px;line-height:1.5'>" + data.description.substring(0, 500) + (data.description.length > 500 ? "&hellip;" : "") + "</div>";
      if (data.popularAmenities.length) {
        h += "<h3 style='margin:12px 0 6px'>Popular amenities</h3><ul>";
        for (var am = 0; am < data.popularAmenities.length; am++) h += "<li>" + data.popularAmenities[am] + "</li>";
        h += "</ul>";
      }
      if (data.rooms.length) {
        h += "<h3 style='margin:12px 0 6px'>Rooms</h3>";
        for (var rm = 0; rm < data.rooms.length; rm++) {
          var ro = data.rooms[rm];
          h += "<div style='padding:8px 0;border-bottom:1px solid #eee'><strong>" + ro.roomName + "</strong> &mdash; " + ro.price + "<div style='color:#666;font-size:12px'>blockId: " + ro.blockId + "</div></div>";
        }
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, name, description, priceRange, address, postalCode, country, region, reviewScore, reviewCount, reviewBest, popularAmenities: [], photos: [], rooms: [{ roomName, blockId, price, maxQuantity, policies: [] }] }`

---

## Benchmark

- **With skill:** 2,969 API tokens, 1 API call, ~19.0s total on `17John` (2026-05-15 to 2026-05-19, 2 adults). Returned hotel metadata, amenities/photos, 9 room rows, and confirmed block `719613307_419807327_2_0_0` was available.
- **Without skill:** 4,219 API tokens, 2 API calls, ~35.6s total on the same URL. Confirmed the tracked block and prices, but missed hotel name, address, review fields, room names, quantities, and policies.
- **Comparison:** Skill used fewer tokens and less time while returning complete structured hotel data; the no-skill DOM-inspection path produced a partial availability result.
