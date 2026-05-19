# X (Twitter) — Post Data Reference

## Requirements

**Auth:** X requires login to view most content. Ask the user for their `auth_token` cookie from x.com (DevTools → Application → Cookies → `auth_token`). Inject before navigating:

```js
await context.addCookies([{
  name: 'auth_token', value: '<user-provided>', domain: '.x.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: post-data

Use when the user wants the details of a specific post (content + engagement + author). Requires a direct post URL.

**Navigate to:** `https://x.com/<handle>/status/<id>` (the post's canonical URL).

**Code:**

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

**Returns:** `{ content, authorName, authorHandle, authorProfileUrl, verified, authorAvatarUrl, timestamp, url, replies, reposts, likes, bookmarks, views, photos, hasVideo }`

---

## Benchmark

- **With skill:** 1,987 tokens, ~1.27s API plus browser execution.
- **Without skill:** 14,333 tokens, ~35.1s total.
- **Comparison:** Skill found content, author, timestamp, URL, engagement metrics, and media; no-skill found partial content/author but missed several structured fields.

