# Airbnb — Listing Data Reference

## Requirements

**Browser:** Required. Airbnb listing pages are JavaScript-rendered; wait for the page to hydrate before running the action.

**Login:** Not required for most public listings. Logged-in sessions can change personalization, saved-state UI, and price presentation, but this action reads only visible listing content.

**Page state:** For maximum detail, scroll through the listing page before running. If amenities or description are collapsed, use the Airbnb UI to open those sections first, then run the action.

## How to run this action

Once the listing page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: listing-data

Use when the user wants details for a specific Airbnb stay.

**Navigate to:** `https://www.airbnb.com/rooms/<listing-id>?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=N`

**Code:**

```js
({
  name: "airbnb-listing-data",
  description: "Extract visible details from an Airbnb listing page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      includeImages: { type: "boolean", description: "Whether to include visible photo URLs" }
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

    function meta(name) {
      var el = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
      return el ? clean(el.getAttribute("content")) : "";
    }

    function parseJsonLd() {
      var nodes = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < nodes.length; i++) {
        try {
          var parsed = JSON.parse(nodes[i].textContent);
          if (parsed && (parsed["@type"] === "Product" || parsed["@type"] === "LodgingBusiness" || parsed.name)) return parsed;
          if (Array.isArray(parsed)) {
            for (var j = 0; j < parsed.length; j++) if (parsed[j] && parsed[j].name) return parsed[j];
          }
        } catch (e) {}
      }
      return null;
    }

    function headingText() {
      var h1 = document.querySelector("h1");
      return h1 ? clean(h1.textContent) : "";
    }

    function collectTextMatches(regex, maxLen) {
      var out = [];
      var nodes = document.querySelectorAll("section, div, span, li");
      for (var i = 0; i < nodes.length; i++) {
        var text = clean(nodes[i].textContent);
        if (text && text.length <= maxLen && regex.test(text)) uniqPush(out, text);
      }
      return out;
    }

    function firstNodeText(regex, maxLen) {
      var nodes = document.querySelectorAll("h1, h2, h3, section, div, span, li");
      for (var i = 0; i < nodes.length; i++) {
        var text = clean(nodes[i].textContent);
        if (text && text.length <= maxLen && regex.test(text)) return text;
      }
      return "";
    }

    var data = {
      url: window.location.href.split("#")[0],
      listingId: "",
      title: "",
      description: "",
      location: "",
      host: "",
      rating: "",
      reviewCount: "",
      capacity: "",
      bedrooms: "",
      beds: "",
      baths: "",
      amenities: [],
      highlights: [],
      photos: [],
      coordinates: null,
      rawText: ""
    };

    var idMatch = window.location.href.match(/\/rooms\/(\d+)/);
    data.listingId = idMatch ? idMatch[1] : "";
    var main = document.querySelector("main") || document.querySelector('[role="main"]') || document.body;
    data.rawText = clean(main.textContent);

    var ld = parseJsonLd();
    if (ld) {
      data.title = clean(ld.name || "");
      data.description = clean(ld.description || "");
      if (ld.aggregateRating) {
        data.rating = clean(String(ld.aggregateRating.ratingValue || ""));
        data.reviewCount = clean(String(ld.aggregateRating.reviewCount || ""));
      }
      if (ld.geo) data.coordinates = { latitude: ld.geo.latitude || "", longitude: ld.geo.longitude || "" };
    }

    if (!data.title) data.title = headingText() || meta("og:title").replace(" - Airbnb", "");
    if (!data.description) data.description = meta("og:description") || meta("description");

    var allText = data.rawText;
    var hostedText = firstNodeText(/Hosted by/i, 120);
    var hosted = (hostedText || allText).match(/Hosted by\s+([^·\n]+?)(?:\s+\d|\s+Superhost|$)/i);
    data.host = hosted ? clean(hosted[1]) : "";
    var rating = allText.match(/(\d+(?:\.\d+)?)\s*(?:out of 5|stars?)/i) || allText.match(/★\s*(\d+(?:\.\d+)?)/);
    if (!data.rating && rating) data.rating = rating[1];
    var reviewText = firstNodeText(/\breviews?\b/i, 120);
    var reviews = reviewText.match(/(?:^|\D)(\d{1,4}(?:,\d{3})*)\s+reviews?\b/i);
    if (!reviews) reviews = allText.match(/(?:^|\D)(\d{1,4}(?:,\d{3})*)\s+reviews?\b/i);
    if (!data.reviewCount && reviews) data.reviewCount = reviews[1];

    var capacity = allText.match(/(\d+)\s+guests?/i);
    var bedrooms = allText.match(/(\d+)\s+bedrooms?/i);
    var beds = allText.match(/(\d+)\s+beds?/i);
    var baths = allText.match(/(\d+(?:\.\d+)?)\s+(?:shared\s+|private\s+)?baths?/i);
    data.capacity = capacity ? capacity[0] : "";
    data.bedrooms = bedrooms ? bedrooms[0] : "";
    data.beds = beds ? beds[0] : "";
    data.baths = baths ? baths[0] : "";

    var locationCandidates = collectTextMatches(/\b(home|rental|condo|apartment|villa|cabin|loft|house|room)\b.*,\s*[A-Z]|,\s*[A-Z][a-z]+/i, 120);
    data.location = locationCandidates.length ? locationCandidates[0] : "";

    var amenityNodes = document.querySelectorAll('[data-section-id*="AMENITIES"] li, [aria-label*="amenit"] li, [id*="amenit"] li');
    for (var i = 0; i < amenityNodes.length; i++) {
      var am = clean(amenityNodes[i].textContent);
      if (am && am.length < 80) uniqPush(data.amenities, am);
    }
    if (data.amenities.length === 0) {
      var common = ["Wifi", "Kitchen", "Washer", "Dryer", "Air conditioning", "Heating", "Dedicated workspace", "TV", "Hair dryer", "Iron", "Pool", "Hot tub", "Free parking", "Paid parking", "Smoke alarm", "Carbon monoxide alarm"];
      for (var c = 0; c < common.length; c++) {
        if (new RegExp("\\b" + common[c].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(allText)) uniqPush(data.amenities, common[c]);
      }
    }

    data.highlights = collectTextMatches(/\b(Self check-in|Great location|Free cancellation|Superhost|Guest favorite|Highly rated|Park for free|Dive right in)\b/i, 120).slice(0, 12);

    if (includeImages) {
      var imgs = main.querySelectorAll("img");
      for (var p = 0; p < imgs.length; p++) {
        var src = imgs[p].currentSrc || imgs[p].src || "";
        if (src && src.indexOf("muscache.com") >= 0) uniqPush(data.photos, src);
      }
    }

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#222;padding:22px;max-width:860px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 8px;font-size:24px;'>" + (data.title || "Airbnb listing") + "</h2>";
      h += "<div style='color:#555;margin-bottom:10px;'>" + (data.location || "") + "</div>";
      if (data.photos.length) h += "<img src='" + data.photos[0] + "' style='width:100%;max-height:420px;object-fit:cover;border-radius:10px;margin-bottom:16px;'>";
      h += "<div style='margin-bottom:8px;'>" + [data.capacity, data.bedrooms, data.beds, data.baths].filter(Boolean).join(" · ") + "</div>";
      if (data.rating || data.reviewCount) h += "<div style='margin-bottom:12px;'>Rating: " + (data.rating || "") + " (" + (data.reviewCount || "0") + " reviews)</div>";
      if (data.description) h += "<p style='line-height:1.5;'>" + data.description.substring(0, 700) + (data.description.length > 700 ? "..." : "") + "</p>";
      if (data.amenities.length) h += "<h3 style='font-size:16px;margin:16px 0 6px;'>Amenities</h3><div>" + data.amenities.slice(0, 20).join(" · ") + "</div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, listingId, title, description, location, host, rating, reviewCount, capacity, bedrooms, beds, baths, amenities, highlights, photos, coordinates, rawText }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `airbnb.com` `listing-data`.

