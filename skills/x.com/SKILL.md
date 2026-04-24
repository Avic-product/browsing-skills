---
name: browsing-x
description: "Use when the user wants to interact with X (formerly Twitter) — search for posts, extract a specific post's data (content + engagement + author), or extract a user's profile (bio, followers, etc.). Works on x.com and twitter.com. Requires a logged-in session (auth_token cookie) and a real browser — X is a JS-rendered SPA."
---

# X (Twitter) — Browsing Skill

This skill covers three actions on X:
- **search** — search for a query and get the list of results
- **post-data** — extract a single post's content, author, and engagement
- **profile-data** — extract a user's profile

Decide which one to run from the user's intent. Then follow the section below for that action.

## Requirements (all actions)

**Auth:** X requires login to view most content. Ask the user for their `auth_token` cookie from x.com (DevTools → Application → Cookies → `auth_token`). Inject before navigating:

```js
await context.addCookies([{
  name: 'auth_token', value: '<user-provided>', domain: '.x.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion.

## How to run any action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/wpm` endpoint):

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

Use when the user wants to search X for a topic, phrase, person, etc.

**Navigate to:** `https://x.com/search?q=<query>&src=typed_query` (URL-encode the query).

**Code:**

```js
({
  name: "x-search",
  description: "Extract search results from an X (Twitter) search page",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["data", "display"] } } },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    var urlParams = new URLSearchParams(window.location.search);
    data.query = urlParams.get("q") || "";
    data.url = window.location.href;
    var articles = document.querySelectorAll("article[data-testid=tweet]");
    data.results = [];
    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      var result = {};
      var textEl = a.querySelector("[data-testid=tweetText]");
      result.content = textEl ? textEl.textContent.trim() : "";
      var nameEl = a.querySelector("[data-testid=User-Name]");
      if (nameEl) {
        var nameLink = nameEl.querySelector("a span");
        result.authorName = nameLink ? nameLink.textContent.trim() : "";
        var spans = nameEl.querySelectorAll("span");
        for (var j = 0; j < spans.length; j++) { if (spans[j].textContent.startsWith("@")) { result.authorHandle = spans[j].textContent.trim(); break; } }
        var link = nameEl.querySelector("a[href]");
        if (link) result.authorProfileUrl = link.href.split("?")[0];
      }
      result.verified = a.querySelector("[data-testid=icon-verified]") !== null;
      var timeEl = a.querySelector("time");
      if (timeEl) result.timestamp = timeEl.getAttribute("datetime") || "";
      var statusLink = a.querySelector("a[href*=\"/status/\"]");
      if (statusLink) result.postUrl = statusLink.href.split("?")[0];
      var metrics = { reply: "replies", retweet: "reposts", like: "likes" };
      var keys = Object.keys(metrics);
      for (var k = 0; k < keys.length; k++) {
        var btn = a.querySelector("[data-testid=" + keys[k] + "]");
        if (btn) { var bp = btn.closest("button"); result[metrics[keys[k]]] = bp ? bp.textContent.trim() : "0"; }
      }
      var photos = a.querySelectorAll("[data-testid=tweetPhoto]");
      result.hasMedia = photos.length > 0 || a.querySelector("[data-testid=videoPlayer]") !== null;
      data.results.push(result);
    }
    data.totalResults = data.results.length;
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">Search: " + data.query + " (" + data.totalResults + " results)</h2>";
      for (var m = 0; m < data.results.length; m++) {
        var r = data.results[m];
        h += "<div style=\"padding:12px 0;border-bottom:1px solid #222;\">";
        h += "<div style=\"font-weight:600;\">" + (r.authorName||"") + " <span style=\"color:#888;font-weight:normal;\">" + (r.authorHandle||"") + "</span></div>";
        h += "<div style=\"margin:8px 0;line-height:1.5;\">" + r.content.substring(0,280) + "</div>";
        h += "<div style=\"color:#888;font-size:13px;display:flex;gap:16px;\">";
        h += "<span>\uD83D\uDCAC " + (r.replies||"0") + "</span><span>\uD83D\uDD04 " + (r.reposts||"0") + "</span><span>\u2764\uFE0F " + (r.likes||"0") + "</span>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```

**Returns:** `{ query, results: [{ content, authorName, authorHandle, authorProfileUrl, verified, timestamp, postUrl, replies, reposts, likes, hasMedia }], totalResults }`

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

## Action: profile-data

Use when the user wants info about a specific X user (bio, followers, etc.). Requires the user's handle.

**Navigate to:** `https://x.com/<handle>` (no trailing path).

**Code:**

```js
({
  name: "x-profile-data",
  description: "Extract profile data from an X user page",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["data", "display"] } } },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    var nameEl = document.querySelector("[data-testid=UserName]");
    if (nameEl) {
      var nameSpan = nameEl.querySelector("span");
      data.displayName = nameSpan ? nameSpan.textContent.trim() : "";
      var spans = nameEl.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) { if (spans[i].textContent.startsWith("@")) { data.handle = spans[i].textContent.trim(); break; } }
    }
    data.verified = document.querySelector("[data-testid=UserName] [data-testid=icon-verified]") !== null;
    data.url = window.location.href.split("?")[0];
    var bio = document.querySelector("[data-testid=UserDescription]");
    data.bio = bio ? bio.textContent.trim() : "";
    var joinDate = document.querySelector("[data-testid=UserJoinDate]");
    data.joinDate = joinDate ? joinDate.textContent.trim().replace("Joined ", "") : "";
    var followLinks = document.querySelectorAll("a[href*=\"/verified_followers\"], a[href*=\"/following\"], a[href*=\"/followers\"]");
    for (var j = 0; j < followLinks.length; j++) {
      var href = followLinks[j].getAttribute("href");
      var text = followLinks[j].textContent.trim();
      if (href.includes("following")) data.following = text.replace(" Following", "");
      if (href.includes("followers") || href.includes("verified_followers")) data.followers = text.replace(" Followers", "");
    }
    var primaryCol = document.querySelector("[data-testid=primaryColumn]");
    if (primaryCol) {
      var avatarImgs = primaryCol.querySelectorAll("img[src*=profile_images]");
      if (avatarImgs.length > 0) data.avatarUrl = avatarImgs[0].src.replace(/_bigger|_normal|_x96|_200x200|_400x400/g, "");
    }
    var headerItems = document.querySelector("[data-testid=UserProfileHeader_Items]");
    if (headerItems) {
      var headerLinks = headerItems.querySelectorAll("a[href]");
      for (var k = 0; k < headerLinks.length; k++) {
        var lhref = headerLinks[k].getAttribute("href");
        if (lhref && !lhref.includes("x.com") && !lhref.includes("twitter.com")) data.website = headerLinks[k].textContent.trim();
      }
    }
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";
      h += "<div style=\"display:flex;align-items:center;gap:16px;margin-bottom:16px;\">";
      if (data.avatarUrl) h += "<img src=\"" + data.avatarUrl + "\" style=\"width:64px;height:64px;border-radius:50%;\">";
      h += "<div><div style=\"font-weight:600;font-size:20px;\">" + (data.displayName||"") + (data.verified?" \u2713":"") + "</div>";
      h += "<div style=\"color:#888;\">" + (data.handle||"") + "</div></div></div>";
      if (data.bio) h += "<div style=\"margin-bottom:16px;\">" + data.bio + "</div>";
      h += "<div style=\"display:flex;gap:20px;margin-bottom:12px;\"><span><strong>" + (data.following||"0") + "</strong> Following</span><span><strong>" + (data.followers||"0") + "</strong> Followers</span></div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```

**Returns:** `{ displayName, handle, verified, url, bio, joinDate, following, followers, avatarUrl, website }`

---

## Reporting issues

If one of these actions breaks (selectors changed, X updated their UI), file an issue: https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose
