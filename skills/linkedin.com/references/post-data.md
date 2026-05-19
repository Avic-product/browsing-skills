# LinkedIn — Post Data Reference

## Requirements

**Auth:** Not required for public posts. If the post is private/restricted, ask the user for their `li_at` session cookie (DevTools → Application → Cookies → `li_at`). Inject before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '<user-provided>', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** Not required for the main extraction path (uses JSON-LD embedded in the page, works with plain `fetch`). A real browser is recommended if you need the repost count, which relies on DOM fallbacks.

## How to run

### Without a browser (lightweight)

```js
// fetch the post URL, then run the code against a DOM shim that supports document.querySelectorAll
// returns content, author, reactions, comments from JSON-LD. Repost count will be 0.
```

### With a browser (full extraction)

Navigate to the post, then execute via `page.evaluate()` or chrome-bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output.

---

## Action: post-data

**Navigate to:** `https://www.linkedin.com/posts/<post-slug>` or `https://www.linkedin.com/feed/update/<urn>` (the post's canonical URL).

**Code:**

```js
({
  name: "linkedin-post-data",
  description: "Extract post content, reactions, comments, reposts, author name and profile link from a LinkedIn post",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};

    // Primary source: JSON-LD structured data (most reliable)
    var scripts = document.querySelectorAll("script[type=\"application/ld+json\"]");
    var jsonLd = null;
    for (var i = 0; i < scripts.length; i++) {
      try {
        var parsed = JSON.parse(scripts[i].textContent);
        if (parsed["@type"] === "SocialMediaPosting" || parsed.articleBody) {
          jsonLd = parsed;
          break;
        }
      } catch (e) {}
    }

    if (jsonLd) {
      data.content = jsonLd.articleBody || "";
      data.headline = jsonLd.headline || "";
      data.datePublished = jsonLd.datePublished || "";
      data.url = jsonLd["@id"] || window.location.href;
      data.commentCount = jsonLd.commentCount || 0;

      if (jsonLd.author) {
        data.authorName = jsonLd.author.name || "";
        data.authorProfileUrl = jsonLd.author.url || "";
      }

      var stats = jsonLd.interactionStatistic || [];
      for (var j = 0; j < stats.length; j++) {
        var type = stats[j].interactionType || "";
        if (type.indexOf("LikeAction") !== -1) {
          data.reactionCount = stats[j].userInteractionCount || 0;
        }
        if (type.indexOf("ShareAction") !== -1) {
          data.repostCount = stats[j].userInteractionCount || 0;
        }
      }
    }

    // DOM fallbacks
    if (!data.authorName) {
      var actorEl = document.querySelector(".update-components-actor__name .visually-hidden, .feed-shared-actor__name .visually-hidden");
      if (actorEl) data.authorName = actorEl.textContent.trim();
    }

    if (!data.authorProfileUrl) {
      var actorLink = document.querySelector(".update-components-actor__container-link, .feed-shared-actor__container-link");
      if (actorLink) data.authorProfileUrl = actorLink.href.split("?")[0];
    }

    if (!data.content) {
      var textEl = document.querySelector(".feed-shared-update-v2__description .break-words, .update-components-text .break-words");
      if (textEl) data.content = textEl.textContent.trim();
    }

    // Repost count from DOM (not available in JSON-LD)
    if (!data.repostCount) {
      var socialBar = document.querySelectorAll(".social-details-social-counts__item, [class*=\"social-counts\"] button, [class*=\"social-counts\"] span");
      for (var k = 0; k < socialBar.length; k++) {
        var txt = socialBar[k].textContent.trim().toLowerCase();
        if (txt.indexOf("repost") !== -1) {
          var match = txt.match(/([\d,]+)/);
          if (match) data.repostCount = parseInt(match[1].replace(/,/g, ""), 10);
        }
      }
    }

    // Defaults
    if (!data.reactionCount) data.reactionCount = 0;
    if (!data.repostCount) data.repostCount = 0;
    if (!data.commentCount) data.commentCount = 0;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";
      h += "<div style=\"margin-bottom:16px;\">";
      h += "<a href=\"" + (data.authorProfileUrl || "#") + "\" style=\"color:#70b5f9;text-decoration:none;font-weight:600;font-size:18px;\">" + (data.authorName || "Unknown") + "</a>";
      if (data.datePublished) h += "<div style=\"color:#888;font-size:13px;margin-top:4px;\">" + new Date(data.datePublished).toLocaleDateString() + "</div>";
      h += "</div>";
      h += "<div style=\"white-space:pre-wrap;line-height:1.6;margin-bottom:20px;\">" + (data.content || "") + "</div>";
      h += "<div style=\"display:flex;gap:20px;padding-top:12px;border-top:1px solid #333;color:#aaa;font-size:14px;\">";
      h += "<span>\uD83D\uDC4D " + data.reactionCount + " reactions</span>";
      h += "<span>\uD83D\uDCAC " + data.commentCount + " comments</span>";
      h += "<span>\uD83D\uDD04 " + data.repostCount + " reposts</span>";
      h += "</div></div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ content, headline, datePublished, url, authorName, authorProfileUrl, reactionCount, commentCount, repostCount }`

**Notes:** Primary extraction is via JSON-LD (`<script type="application/ld+json">` on the post page). DOM fallbacks fill in missing fields. Repost count lives only in DOM — without a real browser it'll come back as 0.

---

## Reporting issues

If this breaks (LinkedIn changes their JSON-LD or DOM), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `post-data`.

