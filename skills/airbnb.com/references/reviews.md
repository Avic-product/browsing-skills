# Airbnb — Reviews Reference

## Requirements

**Browser:** Required. Reviews are rendered client-side and often load inside a dialog.

**Login:** Not required for public listing reviews.

**Page state:** Start on a listing page. This action tries to click a visible reviews button automatically. If Airbnb changes the button text, manually open the reviews dialog first, scroll it to load more reviews, then run the action.

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

## Action: reviews

Use when the user wants reviews for a specific Airbnb listing.

**Navigate to:** `https://www.airbnb.com/rooms/<listing-id>`

**Code:**

```js
({
  name: "airbnb-reviews",
  description: "Extract visible reviews from an Airbnb listing page or reviews dialog",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      limit: { type: "number", description: "Maximum visible reviews to return" },
      openDialog: { type: "boolean", description: "Whether to try opening the reviews dialog before scraping" }
    }
  },
  execute: async function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 40;
    var openDialog = !params || params.openDialog !== false;

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function uniqPushReview(arr, review) {
      var key = (review.reviewerName || "") + "|" + (review.date || "") + "|" + (review.text || "").substring(0, 80);
      for (var i = 0; i < arr.length; i++) {
        var existing = (arr[i].reviewerName || "") + "|" + (arr[i].date || "") + "|" + (arr[i].text || "").substring(0, 80);
        if (existing === key) return;
      }
      if (review.text || review.reviewerName) arr.push(review);
    }

    async function sleep(ms) {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    function clickReviewsButton() {
      var explicit = document.querySelector('button[aria-label*="Show all"][aria-label*="reviews"], button[aria-label*="Show all"][aria-label*="Reviews"]');
      if (explicit) {
        try {
          if (explicit.scrollIntoView) explicit.scrollIntoView({ block: "center" });
          explicit.click();
          return true;
        } catch (explicitError) {}
      }
      var buttons = document.querySelectorAll("button, a");
      for (var i = 0; i < buttons.length; i++) {
        var text = clean(buttons[i].textContent || buttons[i].getAttribute("aria-label"));
        var aria = clean(buttons[i].getAttribute("aria-label"));
        if (/show all\s+\d*[\d,]*\s*reviews?/i.test(text) || /show all\s+\d*[\d,]*\s*reviews?/i.test(aria)) {
          try {
            if (buttons[i].scrollIntoView) buttons[i].scrollIntoView({ block: "center" });
            buttons[i].click();
            return true;
          } catch (e) {}
        }
      }
      for (var j = 0; j < buttons.length; j++) {
        var fallbackText = clean(buttons[j].textContent || buttons[j].getAttribute("aria-label"));
        var fallbackAria = clean(buttons[j].getAttribute("aria-label"));
        if (/\d[\d,]*\s+reviews?|reviews?\s*\(/i.test(fallbackText) || /\d[\d,]*\s+reviews?/i.test(fallbackAria)) {
          try {
            if (buttons[j].scrollIntoView) buttons[j].scrollIntoView({ block: "center" });
            buttons[j].click();
            return true;
          } catch (e2) {}
        }
      }
      return false;
    }

    function scrapeReviews() {
      var root = document.querySelector('[role="dialog"]') || document.querySelector("main") || document.body;
      var candidates = root.querySelectorAll('[data-review-id], [id^="review_"], div[role="listitem"], section li, article, [itemprop="review"]');
      var out = [];
      for (var i = 0; i < candidates.length && out.length < limit; i++) {
        var el = candidates[i];
        var text = clean(el.innerText || el.textContent);
        if (!text || text.length < 40) continue;
        var looksLikeReview = /Rating,\s*\d+(?:\.\d+)?\s*stars?/i.test(text) || /\bStayed\b/i.test(text);
        if (!looksLikeReview && !/\b(ago|20\d{2}|January\s*\d{4}|February\s*\d{4}|March\s*\d{4}|April\s*\d{4}|May\s*\d{4}|June\s*\d{4}|July\s*\d{4}|August\s*\d{4}|September\s*\d{4}|October\s*\d{4}|November\s*\d{4}|December\s*\d{4})\b/i.test(text)) continue;
        if (!looksLikeReview && !/\b(stay|host|place|home|clean|location|recommend|comfortable|apartment|house|room|Airbnb|guest|check-in|walk|neighborhood|amenities|metro|area)\b/i.test(text)) continue;

        var heading = el.querySelector("h2, h3, [dir='auto']");
        var reviewerName = heading ? clean(heading.innerText || heading.textContent) : "";
        var dateMatch = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\b|\b\d+\s+(?:days?|weeks?|months?|years?)\s+ago\b/i);
        var ratingMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:out of 5|stars?)/i);
        var reviewText = text;
        if (!reviewerName) {
          var nameMatch = text.match(/^(.+?)\s+(?:Rating,|\d+\s+years?\s+on Airbnb|[A-Z][a-z]+,\s+[A-Z])/);
          if (nameMatch) reviewerName = clean(nameMatch[1]);
        }
        if (reviewerName) reviewText = clean(reviewText.replace(reviewerName, ""));
        if (dateMatch) reviewText = clean(reviewText.replace(dateMatch[0], ""));
        reviewText = clean(reviewText.replace(/Rating,\s*\d+(?:\.\d+)?\s*stars?\s*,?\s*·?/i, "").replace(/Stayed\s+[^.]+?\s+/i, ""));
        uniqPushReview(out, {
          reviewerName: reviewerName,
          date: dateMatch ? dateMatch[0] : "",
          rating: ratingMatch ? ratingMatch[1] : "",
          text: reviewText
        });
      }
      return out;
    }

    var reviews = scrapeReviews();
    if (openDialog) {
      clickReviewsButton();
      for (var waitCount = 0; waitCount < 12 && reviews.length === 0; waitCount++) {
        await sleep(500);
        reviews = scrapeReviews();
      }
    }

    if (reviews.length === 0) reviews = scrapeReviews();
    var data = {
      url: window.location.href.split("#")[0],
      listingId: (window.location.href.match(/\/rooms\/(\d+)/) || [])[1] || "",
      count: reviews.length,
      reviews: reviews
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#222;padding:22px;max-width:820px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 12px;font-size:22px;'>Airbnb reviews (" + data.count + ")</h2>";
      for (var k = 0; k < reviews.length; k++) {
        var r = reviews[k];
        h += "<div style='padding:12px 0;border-top:1px solid #ddd;'>";
        h += "<div style='font-weight:700;'>" + (r.reviewerName || "Guest") + "</div>";
        h += "<div style='color:#555;font-size:13px;margin-bottom:6px;'>" + (r.date || "") + (r.rating ? " · " + r.rating + " stars" : "") + "</div>";
        h += "<div style='line-height:1.5;'>" + r.text + "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, listingId, count, reviews: [{ reviewerName, date, rating, text }] }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `airbnb.com` `reviews`.

