# Reddit — User Profile Reference

## Requirements

**Auth:** Not required for public profiles. Suspended, private, mature, blocked, or logged-in-only profile details may require the user's existing browser session.

**Browser:** Use a real browser or Chrome Bridge. Reddit profile pages render activity feeds client-side.

## How to run this action

Navigate first, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: user-profile

Use when the user wants visible profile metadata and recent visible Reddit activity for a user.

**Navigate to:** `https://www.reddit.com/user/<username>/`

Optional tabs include `/submitted/`, `/comments/`, and `/overview/`.

**Code:**

```js
({
  name: "reddit-user-profile",
  description: "Extract visible Reddit user profile metadata and recent activity",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      limit: { type: "number" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = params && params.limit ? params.limit : 50;

    function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
    function abs(url) {
      if (!url) return "";
      try { return new URL(url, window.location.href).href.split("?")[0]; }
      catch (e) { return url; }
    }
    function attr(el, name) { return el && el.getAttribute ? el.getAttribute(name) || "" : ""; }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function numFrom(v) {
      v = clean(v);
      if (!v) return null;
      if (!v) return null;
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function postFrom(el) {
      var titleLink = el.querySelector("a[href*='/comments/']");
      var subredditLink = el.querySelector("a[href^='/r/'], a[href*='reddit.com/r/']");
      var title = attr(el, "post-title") || (titleLink ? clean(titleLink.textContent) : "");
      return {
        kind: "post",
        id: attr(el, "id"),
        title: title,
        subreddit: attr(el, "subreddit-prefixed-name") || (subredditLink ? clean(subredditLink.textContent) : ""),
        author: attr(el, "author"),
        postType: attr(el, "post-type"),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        commentCount: numFrom(attr(el, "comment-count")),
        commentCountText: attr(el, "comment-count"),
        created: attr(el, "created-timestamp"),
        permalink: abs(attr(el, "permalink") || (titleLink ? titleLink.getAttribute("href") : "")),
        contentUrl: abs(attr(el, "content-href")),
        textPreview: clean(el.innerText || el.textContent).slice(0, 500)
      };
    }
    function commentFrom(el) {
      var bodyEl = el.querySelector("[slot='comment'], div[slot='comment'], .md");
      return {
        kind: "comment",
        id: attr(el, "thingid"),
        author: attr(el, "author"),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        created: attr(el, "created"),
        permalink: abs(attr(el, "permalink")),
        body: bodyEl ? clean(bodyEl.innerText || bodyEl.textContent) : clean(el.innerText || el.textContent).slice(0, 1000)
      };
    }

    var pathUser = (window.location.pathname.match(/\/user\/([^\/]+)/i) || [])[1] || "";
    var bodyText = document.body.innerText || "";
    var data = {
      url: window.location.href,
      title: document.title,
      username: pathUser ? decodeURIComponent(pathUser) : "",
      pageRecognized: /reddit/i.test(document.title + " " + bodyText),
      extractedAt: new Date().toISOString(),
      profileText: clean(bodyText).slice(0, 2000),
      stats: {},
      links: [],
      activity: []
    };

    var karmaMatch = bodyText.match(/([0-9,.]+[KM]?)\s+(Post\s+Karma|Comment\s+Karma|Karma)/ig) || [];
    for (var i = 0; i < karmaMatch.length; i++) {
      var m = karmaMatch[i].match(/([0-9,.]+[KM]?)\s+(.+)/i);
      if (m) data.stats[clean(m[2]).replace(/\s+/g, "_").toLowerCase()] = m[1];
    }
    var cake = bodyText.match(/Cake\s+day\s+([A-Za-z0-9,\s]+)/i);
    if (cake) data.stats.cakeDay = clean(cake[1]);

    var links = document.querySelectorAll("a[href]");
    var seen = {};
    for (var j = 0; j < links.length && data.links.length < 30; j++) {
      var href = links[j].getAttribute("href") || "";
      var text = clean(links[j].textContent);
      if (!text || !/^https?:\/\//i.test(abs(href))) continue;
      var url = abs(href);
      if (seen[url]) continue;
      seen[url] = true;
      data.links.push({ text: text, url: url });
    }

    var postNodes = document.querySelectorAll("shreddit-post, article[data-testid='post-container'], article");
    for (var k = 0; k < postNodes.length && data.activity.length < limit; k++) {
      var p = postFrom(postNodes[k]);
      if (p.title || p.permalink) data.activity.push(p);
    }
    var commentNodes = document.querySelectorAll("shreddit-comment");
    for (var n = 0; n < commentNodes.length && data.activity.length < limit; n++) {
      var c = commentFrom(commentNodes[n]);
      if (c.body || c.permalink) data.activity.push(c);
    }
    data.count = data.activity.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 12px;'>u/" + esc(data.username) + "</h2>";
      h += "<div style='color:#666;font-size:13px;margin-bottom:16px;'>Visible activity: " + data.count + "</div>";
      for (var q = 0; q < data.activity.length; q++) {
        var r = data.activity[q];
        h += "<div style='border-bottom:1px solid #ddd;padding:12px 0;'>";
        h += "<div style='font-weight:700;'>" + esc((r.title || r.body || "").slice(0, 240)) + "</div>";
        h += "<div style='color:#666;font-size:13px;margin-top:4px;'>" + esc(r.kind) + " " + esc(r.subreddit || "") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ username, stats, links, activity: [{ kind: "post" | "comment", title/body, subreddit, score, created, permalink }], count }`
