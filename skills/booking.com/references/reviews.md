# Booking.com — Reviews Reference

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

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `booking.com` `reviews`.

