---
name: browsing-booking
description: "Use when the user wants to interact with Booking.com — search for accommodations with full filter support (property type, stars, score, meal plan, facilities, district, etc.), extract a specific hotel's data (price, rooms, amenities, photos), extract reviews, or start a reservation up to (but not through) the payment step. Works on www.booking.com. A real browser is required (Booking is a JS-rendered SPA and serves bot challenges to plain fetches). Login is optional but improves prices and personalization."
---

# Booking.com — Browsing Skill

This skill covers four actions:

- **search** — query a destination + dates and get the list of properties, with full filter support
- **hotel-data** — extract a specific property's name, address, score, rooms, amenities, photos
- **reviews** — extract reviews for a property
- **book-room** — submit a reservation up to the guest-details step. **Stops before payment.** The user must finish the booking themselves (guest info, payment, captcha)

Decide which one to run from the user's intent, then follow the section below.

## Requirements (all actions)

**Browser:** Required for every action. Booking serves bot-challenge pages to plain `fetch` requests (you'll see `?chal_t=` appended to URLs). Use Playwright, a built-in Chromium integration, or the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion (which runs scripts in the user's already-open Chrome session — no challenge to solve).

**Login:** Optional. Logged-in sessions get personalized prices, Genius discounts, and saved preferences. If the user wants logged-in pricing, ensure the bridge connects to a Chrome profile that's already signed in to booking.com — Booking's auth is cookie-based but the cookies are split across multiple HttpOnly entries, so a user-provided cookie injection isn't practical. The user's real Chrome session is the simplest path.

**Currency / language:** Booking auto-detects from IP and account settings. To force a currency, append `&selected_currency=EUR` (or USD, GBP, etc.) to any search/hotel URL.

## How to run any action

Once the right URL is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/wpm` endpoint:

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

Use when the user wants to find accommodations matching destination + dates + criteria.

### URL

```
https://www.booking.com/searchresults.html
  ?ss=<destination>            (URL-encoded: "Paris", "New York", "Hôtel du Parc")
  &checkin=YYYY-MM-DD
  &checkout=YYYY-MM-DD
  &group_adults=N              (default 2)
  &group_children=N            (default 0)
  &age=A&age=B                 (one per child, ages 0-17, repeat the param)
  &no_rooms=N                  (default 1)
  &nflt=<filters>              (see Filters below — optional)
  &order=<sort>                (optional — see Sorting below)
  &offset=25                   (optional — pagination, results come 25 per page)
```

### Filters

Filters go in the `nflt` URL parameter. The format is:

```
nflt=key1=value1;key2=value2;key1=value3
```

(semicolons URL-encoded as `%3B`, equals as `%3D`)

Repeat a key to OR multiple values within the same group (e.g. `class=4;class=5` means "4 OR 5 stars"). Different keys AND together (e.g. `class=5;mealplan=1` means "5 stars AND breakfast included").

#### Global filter keys (stable across all destinations)

**Property type** — `ht_id`

| value | meaning |
|---|---|
| 204 | Hotels |
| 201 | Apartments |
| 213 | Villas |
| 208 | Bed and Breakfasts |
| 220 | Vacation Homes |
| 203 | Hostels |
| 226 | Love Hotels |
| 215 | Boats |
| 222 | Homestays |
| 3 | Entire homes & apartments |

**Star rating** — `class` (1–5)

| value | meaning |
|---|---|
| 1 | 1 star |
| 2 | 2 stars |
| 3 | 3 stars |
| 4 | 4 stars |
| 5 | 5 stars |

**Review score (minimum)** — `review_score`

| value | meaning |
|---|---|
| 60 | Pleasant: 6+ |
| 70 | Good: 7+ |
| 80 | Very Good: 8+ |
| 90 | Wonderful: 9+ |

**Meal plan** — `mealplan`

| value | meaning |
|---|---|
| 1 | Breakfast included |
| 9 | Breakfast & dinner included |
| 999 | Kitchen facilities |

**Free cancellation** — `fc=2`
**Online payment accepted** — `pmt=101`
**Sustainability certification** — `SustainablePropertyLevelFilter=4`
**Very good breakfast** — `rated_high=1`

**Distance from center** — `distance` (meters)

| value | meaning |
|---|---|
| 1000 | Less than 1 km |
| 3000 | Less than 3 km |
| 5000 | Less than 5 km |

**Bed type** — `tdb`

| value | meaning |
|---|---|
| 2 | Twin beds |
| 3 | Double bed |

**Stay type** — `stay_type`

| value | meaning |
|---|---|
| 1 | Pet friendly |
| 2 | Adults only |
| 4 | Travel Proud (LGBTQ+ friendly) |

**Hotel facility** — `hotelfacility`

| value | meaning | value | meaning |
|---|---|---|---|
| 2 | Parking | 433 | Swimming pool |
| 46 | Free parking | 107 | Free Wifi |
| 54 | Spa | 17 | Airport shuttle |
| 63 | Hot tub/Jacuzzi | 11 | Fitness center |
| 16 | Non-smoking rooms | 8 | 24-hour front desk |
| 3 | Restaurant | 182 | Electric vehicle charging station |
| 185 | Wheelchair accessible | 5 | Room service |

**Room facility** — `roomfacility`

| value | meaning | value | meaning |
|---|---|---|---|
| 38 | Private bathroom | 17 | Balcony |
| 11 | Air conditioning | 999 | Kitchen/Kitchenette |
| 93 | Private pool | 14 | Hot tub |
| 5 | Bathtub | 81 | View |
| 132 | Upper floors accessible by elevator | 123 | Terrace |
| 34 | Washing machine | 20 | Spa tub |
| 71 | Fireplace | 92 | Sauna |
| 109 | Lake view | 99 | Barbecue |
| 32 | Microwave | 124 | Towels |
| 22 | Refrigerator | 125 | Linens |
| 75 | Flat-screen TV | 120 | Coffee machine |
| 4 | Shower | 31 | Toilet |
| 86 | Electric kettle | | |

**Popular activities** — `popular_activities`

| value | meaning |
|---|---|
| 10 | Sauna |
| 54 | Spa |
| 11 | Fitness center |
| 55 | Massage |
| 253 | Fitness |

**Traveller experience type** — `traveller_experience_type`

| value | meaning |
|---|---|
| 0 | Luxury |
| 1 | Romantic |
| 2 | Boutique |
| 3 | Remote-work friendly |
| 4 | Wellness |

**Accessibility (property)** — `accessible_facilities`

| value | meaning |
|---|---|
| 211 | Visual aids (Braille) |
| 212 | Visual aids (tactile signs) |
| 213 | Auditory guidance |
| 186 | Toilet with grab rails |
| 187 | Raised toilet |
| 188 | Lowered sink |
| 189 | Bathroom emergency cord |

**Accessibility (room)** — `accessible_room_facilities`

| value | meaning |
|---|---|
| 131 | Entire unit located on ground floor |
| 132 | Upper floors accessible by elevator |
| 134 | Entire unit wheelchair accessible |
| 147 | Toilet with grab rails |
| 148 | Adapted bath |
| 149 | Roll-in shower |
| 150 | Walk-in shower |
| 151 | Raised toilet |
| 152 | Lower sink |
| 153 | Emergency cord in bathroom |
| 154 | Shower chair |

#### Destination-specific filter keys

These keys exist for every destination but the IDs are city-specific. You cannot hardcode them. To discover IDs for a given destination, run `search` once with no filter, read the page's `[data-filters-group=<key>] [data-filters-item]` attributes (each is `<group>:<key>=<value>` — strip the `<group>:` prefix to get the filter pair), then re-run search with the chosen IDs.

| key | meaning |
|---|---|
| `di` | District / neighborhood |
| `popular_nearby_landmarks` | Distance from a specific landmark/POI |
| `chaincode` | Hotel chain (most major chains have stable IDs but smaller regional brands vary) |

**Example: Paris districts** (`di`) — the values below work today but should be re-discovered per-search if your destination changes:

| value | meaning |
|---|---|
| 2281 | Paris City Center |
| 11167 | Champs Elysées |
| 7918 | Le Marais |
| 7917 | Les Halles |
| 11213 | Saint Germain des Pres |
| 7970 | Latin Quarter |
| 9580 | Guests' favorite area |

#### Building the `nflt` string

```js
function buildNflt(filters) {
  // filters: { class: [4,5], mealplan: 1, hotelfacility: [107, 433] }
  var parts = [];
  for (var key in filters) {
    var v = filters[key];
    var arr = Array.isArray(v) ? v : [v];
    for (var i = 0; i < arr.length; i++) parts.push(key + "=" + arr[i]);
  }
  return parts.join(";"); // pass to encodeURIComponent before adding to URL
}
```

### Sorting

`order=` parameter on the search URL:

| value | meaning |
|---|---|
| `popularity` | Top picks (default) |
| `price` | Price (low to high) |
| `class_asc` | Stars (low to high) |
| `class_descending` | Stars (high to low) |
| `bayesian_review_score` | Best reviewed |
| `distance_from_search` | Distance from your search location |

### Code

**Navigate to:** the search URL composed above. Wait ~5 seconds for results to render. Then run:

```js
({
  name: "booking-search",
  description: "Extract Booking.com search results from a /searchresults.html page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data (default) returns JSON. display returns self-contained HTML." }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    var u = new URL(window.location.href);
    data.url = u.href;
    data.query = u.searchParams.get("ss") || "";
    data.checkin = u.searchParams.get("checkin") || "";
    data.checkout = u.searchParams.get("checkout") || "";
    data.adults = u.searchParams.get("group_adults") || "";
    data.children = u.searchParams.get("group_children") || "";
    data.rooms = u.searchParams.get("no_rooms") || "";
    data.appliedFilters = u.searchParams.get("nflt") || "";
    data.sort = u.searchParams.get("order") || "";
    var h1 = document.querySelector("h1");
    data.totalResultsHeading = h1 ? h1.textContent.trim() : "";
    var cards = document.querySelectorAll("[data-testid=property-card]");
    data.results = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var titleEl = c.querySelector("[data-testid=title]");
      var linkEl = c.querySelector("a[data-testid=title-link]");
      var addrEl = c.querySelector("[data-testid=address-link]") || c.querySelector("[data-testid=address]");
      var distEl = c.querySelector("[data-testid=distance]");
      var priceEl = c.querySelector("[data-testid=price-and-discounted-price]");
      var origPriceEl = c.querySelector("[data-testid=strikethrough-price]");
      var scoreEl = c.querySelector("[data-testid=review-score]");
      var sponsoredEl = c.querySelector("[data-testid=sponsored-badge]");
      var imgEl = c.querySelector("img");
      var scoreText = scoreEl ? scoreEl.textContent.trim() : "";
      var scoreNum = (scoreText.match(/(\d+\.\d+)/) || [])[1] || "";
      var reviewCount = (scoreText.match(/([\d,]+)\s*review/i) || [])[1] || "";
      var reviewLabel = "";
      var labelMatch = scoreText.match(/(?:Scored\s+\d+\.\d+\s+)?(\d+\.\d+)?\s*([A-Za-z][A-Za-z\s]+?)\s+[\d,]+\s*review/i);
      if (labelMatch && labelMatch[2]) reviewLabel = labelMatch[2].trim();
      data.results.push({
        title: titleEl ? titleEl.textContent.trim() : "",
        url: linkEl ? (linkEl.href || "").split("?")[0] : "",
        address: addrEl ? addrEl.textContent.trim() : "",
        distance: distEl ? distEl.textContent.trim() : "",
        price: priceEl ? priceEl.textContent.trim() : "",
        originalPrice: origPriceEl ? origPriceEl.textContent.trim() : "",
        reviewScore: scoreNum,
        reviewLabel: reviewLabel,
        reviewCount: reviewCount,
        sponsored: !!sponsoredEl,
        thumbnail: imgEl ? imgEl.src : ""
      });
    }
    data.resultCount = data.results.length;
    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,sans-serif;background:#fff;color:#1a1a1a;padding:16px;max-width:780px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 12px'>" + data.query + " &mdash; " + data.resultCount + " results</h2>";
      for (var k = 0; k < data.results.length; k++) {
        var r = data.results[k];
        h += "<div style='display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #eee'>";
        if (r.thumbnail) h += "<img src='" + r.thumbnail + "' style='width:120px;height:90px;object-fit:cover;border-radius:6px'>";
        h += "<div style='flex:1'><div style='font-weight:600'><a href='" + r.url + "' style='color:#0071c2;text-decoration:none'>" + r.title + "</a></div>";
        h += "<div style='color:#666;font-size:13px;margin:4px 0'>" + r.address + " &middot; " + r.distance + "</div>";
        h += "<div style='display:flex;gap:12px;font-size:13px'><span><strong>" + r.price + "</strong></span>";
        if (r.reviewScore) h += "<span>★ " + r.reviewScore + " " + r.reviewLabel + " (" + r.reviewCount + ")</span>";
        h += "</div></div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, query, checkin, checkout, adults, children, rooms, appliedFilters, sort, totalResultsHeading, results: [{ title, url, address, distance, price, originalPrice, reviewScore, reviewLabel, reviewCount, sponsored, thumbnail }], resultCount }`

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

## Action: reviews

Use when the user wants reviews for a property.

**Navigate to:** the hotel's URL (same as `hotel-data`). Wait ~5 seconds for the page to render. The action will open the reviews modal automatically (which loads 10 detailed reviews) and scrape it; if a `[data-testid=review-card]` is already on the page (e.g. on `/reviewlist.html`), it scrapes that directly.

**Code:**

```js
({
  name: "booking-reviews",
  description: "Extract reviews from a Booking.com property page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data (default) returns JSON. display returns self-contained HTML." }
    }
  },
  execute: async function(params) {
    var mode = (params && params.mode) || "data";

    function scrapeCards() {
      var cards = document.querySelectorAll("[data-testid=review-card]");
      var out = [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        function txt(sel) {
          var e = c.querySelector(sel);
          return e ? e.textContent.trim().replace(/\s+/g, " ") : "";
        }
        var avatarFull = txt("[data-testid=review-avatar]");
        var roomName = txt("[data-testid=review-room-name]");
        var country = avatarFull.replace(/^\S+\s*/, "").trim();
        var name = avatarFull.split(/\s{1,}/)[0] || "";
        var scoreText = txt("[data-testid=review-score]");
        var scoreNum = (scoreText.match(/(\d+(?:\.\d+)?)/) || [])[1] || "";
        out.push({
          reviewerName: name,
          reviewerCountry: country,
          score: scoreNum,
          title: txt("[data-testid=review-title]"),
          positive: txt("[data-testid=review-positive-text]"),
          negative: txt("[data-testid=review-negative-text]"),
          roomName: roomName,
          stayDate: txt("[data-testid=review-stay-date]"),
          travelerType: txt("[data-testid=review-traveler-type]"),
          numNights: txt("[data-testid=review-num-nights]").replace(/\s*·\s*$/, ""),
          reviewedOn: txt("[data-testid=review-date]").replace(/^Reviewed:\s*/, ""),
          partnerReply: txt("[data-testid=review-partner-reply]").replace(/^Hotel response:\s*/, "").replace(/\.\.\.Continue reading$/, "")
        });
      }
      return out;
    }

    function scrapeFeatured() {
      var cards = document.querySelectorAll("[data-testid=featuredreview]");
      var out = [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var avatarFull = (c.querySelector("[data-testid=featuredreview-avatar]") || {}).textContent || "";
        avatarFull = avatarFull.trim().replace(/\s+/g, " ");
        var text = (c.querySelector("[data-testid=featuredreview-text]") || {}).textContent || "";
        text = text.trim().replace(/^["“]/, "").replace(/["”]$/, "");
        var name = avatarFull.split(/\s{1,}/)[0] || "";
        var country = avatarFull.replace(/^\S+\s*/, "").trim();
        out.push({ reviewerName: name, reviewerCountry: country, positive: text, source: "featured" });
      }
      return out;
    }

    var reviews = scrapeCards();
    if (reviews.length === 0) {
      var trigger = document.querySelector("[data-testid=review-score-read-all-actionable]");
      if (trigger) {
        trigger.click();
        await new Promise(function(res) { setTimeout(res, 2500); });
        reviews = scrapeCards();
      }
    }
    if (reviews.length === 0) reviews = scrapeFeatured();

    var data = { url: window.location.href.split("?")[0], reviews: reviews, count: reviews.length };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,sans-serif;background:#fff;color:#1a1a1a;padding:16px;max-width:780px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 12px'>Reviews (" + data.count + ")</h2>";
      for (var k = 0; k < reviews.length; k++) {
        var r = reviews[k];
        h += "<div style='padding:10px 0;border-bottom:1px solid #eee'>";
        h += "<div style='font-weight:600'>" + (r.reviewerName || "") + " <span style='color:#666;font-weight:normal'>" + (r.reviewerCountry || "") + "</span>";
        if (r.score) h += " <span style='color:#0071c2;font-weight:600;margin-left:8px'>" + r.score + "</span>";
        h += "</div>";
        if (r.title) h += "<div style='font-style:italic;margin:4px 0'>&ldquo;" + r.title + "&rdquo;</div>";
        if (r.positive) h += "<div style='margin:4px 0'><strong>+ </strong>" + r.positive + "</div>";
        if (r.negative) h += "<div style='margin:4px 0;color:#a00'><strong>&minus; </strong>" + r.negative + "</div>";
        if (r.partnerReply) h += "<div style='margin:6px 0 0;padding:6px 8px;background:#f5f5f5;font-size:13px'>Hotel reply: " + r.partnerReply + "</div>";
        var meta = [];
        if (r.roomName) meta.push(r.roomName);
        if (r.numNights) meta.push(r.numNights);
        if (r.stayDate) meta.push(r.stayDate);
        if (r.travelerType) meta.push(r.travelerType);
        if (r.reviewedOn) meta.push("reviewed " + r.reviewedOn);
        if (meta.length) h += "<div style='color:#888;font-size:12px;margin-top:4px'>" + meta.join(" · ") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, count, reviews: [{ reviewerName, reviewerCountry, score, title, positive, negative, roomName, stayDate, travelerType, numNights, reviewedOn, partnerReply }] }`. If the modal can't be opened, falls back to inline `featuredreview` cards which only have `{ reviewerName, reviewerCountry, positive, source: "featured" }`.

---

## Action: book-room

Use when the user wants to start a reservation. **This action stops at the guest-details page** — it submits the room-selection form and returns once Booking has navigated to `secure.booking.com/book.html?stage=1`. **The user must complete guest details, payment, and any captcha themselves.** Do not attempt to fill in payment information programmatically.

**Navigate to:** the hotel's URL (same as `hotel-data`). Wait ~5 seconds for the room table to render.

**Code:**

```js
({
  name: "booking-book-room",
  description: "Submit a Booking.com room reservation up to the guest-details page. Stops before payment/captcha.",
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string", description: "Exact block ID like 937895101_419838496_2_2_0 (the row's data-hotel-rounded attribute, also the suffix of the nr_rooms_<blockId> select name). Preferred over roomName for unambiguous selection — multiple rate plans for the same room have the same name but different blockIds." },
      roomName: { type: "string", description: "Substring match against room name (e.g. \"Deluxe\"). First matching row wins. Use blockId for precise control." },
      quantity: { type: "integer", minimum: 1, default: 1, description: "Number of rooms. Must be <= the row's max available." }
    }
  },
  execute: function(params) {
    var p = params || {};
    var qty = p.quantity || 1;
    var form = document.querySelector("#hprt-form");
    if (!form) return { content: [{ type: "text", text: JSON.stringify({ error: "reservation form #hprt-form not found — are you on a hotel page with check-in/check-out dates set?" }) }] };
    var rows = form.querySelectorAll("#hprt-table tbody tr");
    var matched = null;
    var matchedRoom = "";
    var matchedBlockId = "";
    var currentName = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var nameLink = row.querySelector(".hprt-roomtype-link, .hprt-roomtype-name");
      if (nameLink) currentName = nameLink.textContent.trim().replace(/\s+/g, " ");
      var blockId = row.getAttribute("data-hotel-rounded") || "";
      var sel = row.querySelector("select[name^=nr_rooms_]");
      if (!sel) continue;
      if (p.blockId) {
        if (blockId === p.blockId || sel.name === "nr_rooms_" + p.blockId) {
          matched = sel; matchedRoom = currentName; matchedBlockId = blockId; break;
        }
      } else if (p.roomName) {
        if (currentName.toLowerCase().indexOf(String(p.roomName).toLowerCase()) >= 0) {
          matched = sel; matchedRoom = currentName; matchedBlockId = blockId; break;
        }
      } else if (!matched) {
        matched = sel; matchedRoom = currentName; matchedBlockId = blockId;
      }
    }
    if (!matched) return { content: [{ type: "text", text: JSON.stringify({ error: "no matching room row", blockIdRequested: p.blockId, roomNameRequested: p.roomName }) }] };
    var maxQty = matched.options.length > 0 ? parseInt(matched.options[matched.options.length - 1].value, 10) : 0;
    if (parseInt(qty, 10) > maxQty) return { content: [{ type: "text", text: JSON.stringify({ error: "requested quantity " + qty + " exceeds max available " + maxQty + " for this row", room: matchedRoom, blockId: matchedBlockId }) }] };
    matched.value = String(qty);
    matched.dispatchEvent(new Event("change", { bubbles: true }));
    var btns = form.querySelectorAll("button");
    var reserveBtn = null;
    for (var k = 0; k < btns.length; k++) {
      if (/reserve/i.test(btns[k].textContent || "")) { reserveBtn = btns[k]; break; }
    }
    var result = {
      action: "submitted",
      selectedRoom: matchedRoom,
      selectedBlockId: matchedBlockId,
      selectedQuantity: qty,
      formAction: form.getAttribute("action"),
      stopsAt: "secure.booking.com/book.html?stage=1 (Your Details — guest info + payment)",
      handoffNote: "The page is navigating to the guest-details step. The user must finish: guest details, payment method, and any captcha. Do NOT attempt to fill in payment fields programmatically."
    };
    if (reserveBtn) reserveBtn.click(); else form.submit();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
})
```

**Returns:** `{ action: "submitted", selectedRoom, selectedBlockId, selectedQuantity, formAction, stopsAt, handoffNote }`. After ~5 seconds the page is at `secure.booking.com/book.html?stage=1`. Read `window.location.href` to confirm, then **hand control back to the user** — say something like "I've selected the room and started the reservation. Booking is now showing the guest-details page in your browser. Please fill in your details and payment to complete the booking."

---

## Reporting issues

If selectors break (Booking ships UI changes regularly), file an issue: https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose
