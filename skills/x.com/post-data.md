---
name: x-post-data
description: Extract post content, author info, engagement metrics, and media from an X (Twitter) post
urlPatterns:
  - https://x.com/*/status/*
  - https://twitter.com/*/status/*
auth:
  required: true
  hint: Requires auth_token session cookie from x.com
requiresBrowser: true
tags:
  - x
  - twitter
  - webmcp
  - extractor
returns: '{ content, authorName, authorHandle, authorProfileUrl, verified, authorAvatarUrl, timestamp, url, replies, reposts, likes, bookmarks, views, photos, hasVideo }'
---

# x-post-data

Extract post content, author info, engagement metrics, and media from an X (Twitter) post

## Returns

`{ content, authorName, authorHandle, authorProfileUrl, verified, authorAvatarUrl, timestamp, url, replies, reposts, likes, bookmarks, views, photos, hasVideo }`

## Code

```js
({
  name: "x-post-data",
  description: "Extract post content, author info, engagement metrics, and media from an X (Twitter) post",
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

    var tweet = document.querySelector("article[data-testid=tweet]");
    if (!tweet) return { content: [{ type: "text", text: JSON.stringify({ error: "No tweet found on page" }) }] };

    var textEl = tweet.querySelector("[data-testid=tweetText]");
    data.content = textEl ? textEl.textContent.trim() : "";

    var nameEl = tweet.querySelector("[data-testid=User-Name]");
    if (nameEl) {
      var nameLink = nameEl.querySelector("a span");
      data.authorName = nameLink ? nameLink.textContent.trim() : "";
      var spans = nameEl.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) {
        var t = spans[i].textContent.trim();
        if (t.startsWith("@")) { data.authorHandle = t; break; }
      }
      var link = nameEl.querySelector("a[href]");
      if (link) data.authorProfileUrl = link.href.split("?")[0];
    }

    data.verified = tweet.querySelector("[data-testid=icon-verified]") !== null;

    var avatarImg = tweet.querySelector("[data-testid=Tweet-User-Avatar] img");
    if (avatarImg) data.authorAvatarUrl = avatarImg.src;

    var timeEl = tweet.querySelector("time");
    if (timeEl) {
      data.timestamp = timeEl.getAttribute("datetime") || "";
      data.timeDisplay = timeEl.textContent.trim();
    }

    data.url = window.location.href.split("?")[0];

    var metrics = { reply: "replies", retweet: "reposts", like: "likes", bookmark: "bookmarks" };
    var keys = Object.keys(metrics);
    for (var j = 0; j < keys.length; j++) {
      var btn = tweet.querySelector("[data-testid=" + keys[j] + "]");
      if (btn) {
        var btnParent = btn.closest("button");
        var val = btnParent ? btnParent.textContent.trim() : "";
        data[metrics[keys[j]]] = val || "0";
      }
    }

    var allSpans = tweet.querySelectorAll("span");
    for (var k = 0; k < allSpans.length; k++) {
      var sv = allSpans[k].textContent;
      if (sv.includes("Views") || sv.includes("views")) {
        var vMatch = allSpans[k].parentElement.textContent.trim().match(/^([\d,.]+[KMB]?)/i);
        if (vMatch) data.views = vMatch[1];
        break;
      }
    }

    var photos = tweet.querySelectorAll("[data-testid=tweetPhoto] img");
    if (photos.length > 0) {
      data.photos = [];
      for (var m = 0; m < photos.length; m++) data.photos.push(photos[m].src);
    }
    data.hasVideo = tweet.querySelector("[data-testid=videoPlayer]") !== null;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";
      h += "<div style=\"display:flex;align-items:center;gap:12px;margin-bottom:16px;\">";
      if (data.authorAvatarUrl) h += "<img src=\"" + data.authorAvatarUrl + "\" style=\"width:48px;height:48px;border-radius:50%;\">";
      h += "<div><div style=\"font-weight:600;font-size:16px;\">" + (data.authorName || "") + (data.verified ? " \u2713" : "") + "</div>";
      h += "<div style=\"color:#888;font-size:14px;\">" + (data.authorHandle || "") + "</div></div></div>";
      h += "<div style=\"white-space:pre-wrap;line-height:1.6;margin-bottom:16px;font-size:15px;\">" + (data.content || "") + "</div>";
      if (data.timeDisplay) h += "<div style=\"color:#888;font-size:13px;margin-bottom:12px;\">" + data.timeDisplay + "</div>";
      h += "<div style=\"display:flex;gap:20px;padding-top:12px;border-top:1px solid #333;color:#aaa;font-size:14px;\">";
      h += "<span>\uD83D\uDCAC " + (data.replies || "0") + "</span>";
      h += "<span>\uD83D\uDD04 " + (data.reposts || "0") + "</span>";
      h += "<span>\u2764\uFE0F " + (data.likes || "0") + "</span>";
      h += "<span>\uD83D\uDCBE " + (data.bookmarks || "0") + "</span>";
      if (data.views) h += "<span>\uD83D\uDC41 " + data.views + "</span>";
      h += "</div></div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```
