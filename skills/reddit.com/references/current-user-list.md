# Reddit — Current User List Reference

## Requirements

**Auth:** Requires a logged-in Reddit browser session for personal lists such as saved, upvoted, downvoted, hidden, and history. Do not ask users to paste Reddit passwords. Prefer Chrome Bridge against their already-authenticated Chrome tab.

**Safety:** This action is read-only. It does not save, unsave, vote, hide, delete, edit, follow, join, or message.

**Browser:** Use a real browser or Chrome Bridge. These personal pages are rendered by Reddit's app and may redirect or show an empty state when the user is logged out.

## How to run this action

Navigate first, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: current-user-list

Use when the user wants visible items from one of their own Reddit lists.

**Navigate to:**

- `https://www.reddit.com/user/<username>/saved/`
- `https://www.reddit.com/user/<username>/upvoted/`
- `https://www.reddit.com/user/<username>/downvoted/`
- `https://www.reddit.com/user/<username>/hidden/`
- `https://www.reddit.com/user/<username>/history/`

**Code:**

```js
({
  name: "reddit-current-user-list",
  description: "Extract visible items from a logged-in Reddit personal list",
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
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function postFrom(el) {
      var titleLink = el.querySelector("a[href*='/comments/']");
      var subredditLink = el.querySelector("a[href^='/r/'], a[href*='reddit.com/r/']");
      return {
        kind: "post",
        id: attr(el, "id"),
        title: attr(el, "post-title") || (titleLink ? clean(titleLink.textContent) : ""),
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

    var pathParts = window.location.pathname.split("/").filter(Boolean);
    var data = {
      url: window.location.href,
      title: document.title,
      username: pathParts[0] === "user" ? decodeURIComponent(pathParts[1] || "") : "",
      list: pathParts[0] === "user" ? (pathParts[2] || "overview") : "",
      pageRecognized: /reddit/i.test(document.title + " " + document.body.innerText),
      loggedOutLikely: /log in|sign up/i.test(document.body.innerText || "") && document.querySelectorAll("shreddit-post, shreddit-comment").length === 0,
      extractedAt: new Date().toISOString(),
      items: []
    };

    var seen = {};
    var posts = document.querySelectorAll("shreddit-post, article[data-testid='post-container'], article");
    for (var i = 0; i < posts.length && data.items.length < limit; i++) {
      var p = postFrom(posts[i]);
      if (!p.title && !p.permalink) continue;
      var key = p.permalink || p.id || p.title;
      if (seen[key]) continue;
      seen[key] = true;
      data.items.push(p);
    }
    var comments = document.querySelectorAll("shreddit-comment");
    for (var j = 0; j < comments.length && data.items.length < limit; j++) {
      var c = commentFrom(comments[j]);
      if (!c.body && !c.permalink) continue;
      var ckey = c.permalink || c.id || c.body;
      if (seen[ckey]) continue;
      seen[ckey] = true;
      data.items.push(c);
    }
    data.count = data.items.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 12px;'>Reddit " + esc(data.list) + " list</h2>";
      h += "<div style='color:#666;font-size:13px;margin-bottom:16px;'>Visible items: " + data.count + "</div>";
      for (var k = 0; k < data.items.length; k++) {
        var r = data.items[k];
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

**Returns:** `{ username, list, loggedOutLikely, items: [{ kind: "post" | "comment", title/body, subreddit, author, score, created, permalink, contentUrl }], count }`
