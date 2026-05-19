# Booking.com — Search Reference

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

## Benchmark

- **With skill:** 3,903 tokens, ~9.5s total.
- **Without skill:** 49,290 tokens, ~82.5s total.
- **Comparison:** Skill returned 25 clean property cards with title, URL, address, price, review score/count, and thumbnail. No-skill eventually returned 25 cards but needed 11 API calls, missed address/distance, kept noisy URLs, and confused review score/count.

