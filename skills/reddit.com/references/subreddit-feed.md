# Reddit — Subreddit Feed Reference

## Requirements

**Auth:** Not required for public subreddits. Quarantined, private, age-gated, personalized, or blocked content may require the user's logged-in browser session.

**Browser:** Use a real browser. Reddit is a JavaScript-rendered app and can present bot or JavaScript challenge pages to plain HTTP fetches. Chrome Bridge works well when the user already has Reddit open in Chrome.

## How to run this action

Navigate first, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: subreddit-feed

Use when the user wants posts from a subreddit feed.

**Navigate to:** `https://www.reddit.com/r/<subreddit>/<sort>/`

Examples:

- `https://www.reddit.com/r/javascript/`
- `https://www.reddit.com/r/javascript/new/`
- `https://www.reddit.com/r/javascript/top/?t=week`

**Code:**

```js
({
  name: "reddit-subreddit-feed",
  description: "Extract visible posts from a Reddit subreddit feed",
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

    function clean(s) {
      return (s || "").replace(/\s+/g, " ").trim();
    }
    function abs(url) {
      if (!url) return "";
      try { return new URL(url, window.location.href).href.split("?")[0]; }
      catch (e) { return url; }
    }
    function attr(el, name) {
      return el && el.getAttribute ? el.getAttribute(name) || "" : "";
    }
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
      var authorLink = el.querySelector("a[href^='/user/'], a[href*='reddit.com/user/']");
      var title = attr(el, "post-title") || (titleLink ? clean(titleLink.textContent) : "");
      var permalink = attr(el, "permalink") || (titleLink ? titleLink.getAttribute("href") : "");
      var subreddit = attr(el, "subreddit-prefixed-name") || (subredditLink ? clean(subredditLink.textContent) : "");
      var author = attr(el, "author") || "";
      if (!author && authorLink) author = clean(authorLink.textContent).replace(/^u\//, "");
      return {
        id: attr(el, "id"),
        title: title,
        subreddit: subreddit,
        subredditName: attr(el, "subreddit-name"),
        author: author,
        postType: attr(el, "post-type"),
        domain: attr(el, "domain"),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        commentCount: numFrom(attr(el, "comment-count")),
        commentCountText: attr(el, "comment-count"),
        upvoteRatio: attr(el, "upvote-ratio") ? parseFloat(attr(el, "upvote-ratio")) : null,
        created: attr(el, "created-timestamp"),
        permalink: abs(permalink),
        contentUrl: abs(attr(el, "content-href")),
        thumbnailUrl: attr(el, "icon") || "",
        isPromoted: /promoted/i.test(clean(el.textContent)) || attr(el, "promoted") === "true",
        textPreview: clean(el.innerText || el.textContent).slice(0, 500)
      };
    }

    var data = {
      url: window.location.href,
      title: document.title,
      pageRecognized: /reddit/i.test(document.title + " " + document.body.innerText),
      extractedAt: new Date().toISOString(),
      posts: []
    };
    var m = window.location.pathname.match(/\/r\/([^\/]+)/i);
    data.subreddit = m ? "r/" + decodeURIComponent(m[1]) : "";
    data.sort = (window.location.pathname.match(/\/r\/[^\/]+\/([^\/]+)/i) || [])[1] || "hot";

    var nodes = document.querySelectorAll("shreddit-post, article[data-testid='post-container'], article");
    var seen = {};
    for (var i = 0; i < nodes.length && data.posts.length < limit; i++) {
      var p = postFrom(nodes[i]);
      if (!p.title && !p.permalink) continue;
      var key = p.permalink || p.id || p.title;
      if (seen[key]) continue;
      seen[key] = true;
      data.posts.push(p);
    }
    data.count = data.posts.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 12px;'>Reddit feed: " + esc(data.subreddit || "current page") + "</h2>";
      for (var j = 0; j < data.posts.length; j++) {
        var r = data.posts[j];
        h += "<div style='border-bottom:1px solid #ddd;padding:12px 0;'>";
        h += "<div style='font-weight:700;'>" + esc(r.title) + "</div>";
        h += "<div style='color:#666;font-size:13px;margin-top:4px;'>" + esc(r.subreddit || "") + " u/" + esc(r.author || "") + " score " + esc(r.scoreText || "") + " comments " + esc(r.commentCountText || "") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, subreddit, sort, posts: [{ id, title, subreddit, author, postType, domain, score, commentCount, upvoteRatio, created, permalink, contentUrl, thumbnailUrl, isPromoted, textPreview }], count }`
