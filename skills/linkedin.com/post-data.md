---
name: linkedin-post-data
description: Extract post content, author info, engagement metrics, and timestamp from a LinkedIn post
urlPatterns:
  - https://www.linkedin.com/posts/*
  - https://www.linkedin.com/feed/update/*
auth:
  required: false
  hint: Login not required for public posts. For private posts, provide li_at session cookie.
requiresBrowser: false
tags:
  - linkedin
  - webmcp
  - extractor
returns: "{ content, headline, datePublished, url, authorName, authorProfileUrl, reactionCount, commentCount, repostCount }"
---

# linkedin-post-data

Extracts structured data from a LinkedIn post page.

## Returns

- `content` — the full post text
- `headline` — short headline
- `datePublished` — ISO timestamp when the post was published
- `url` — canonical post URL
- `authorName` — name of the post author
- `authorProfileUrl` — URL to the author's profile
- `reactionCount` — number of reactions (likes)
- `commentCount` — number of comments
- `repostCount` — number of reposts/shares (from DOM; not in JSON-LD)

## Notes

- Primary source is JSON-LD (`<script type="application/ld+json">`), which LinkedIn embeds on public post pages.
- Falls back to DOM selectors for fields missing from JSON-LD (author info, repost count).
- Works without login on public posts; for private posts provide `li_at` session cookie.

## Code

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
