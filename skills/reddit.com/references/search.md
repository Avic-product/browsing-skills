# Reddit — Search Reference

## Requirements

**Auth:** Not required for public search results. Logged-in sessions may show personalized ranking or mature/private content.

**Browser:** Use a real browser or Chrome Bridge. Reddit search is rendered client-side and may challenge plain fetches.

## How to run this action

Navigate first, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: search

Use when the user wants to search Reddit globally or within a subreddit.

**Navigate to:**

- Global: `https://www.reddit.com/search/?q=<query>&type=link`
- Subreddit: `https://www.reddit.com/r/<subreddit>/search/?q=<query>&restrict_sr=1`

**Code:**

```js
({
  name: "reddit-search",
  description: "Extract visible Reddit search results",
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
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function attr(el, name) { return el && el.getAttribute ? el.getAttribute(name) || "" : ""; }
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
        kind: "post",
        id: attr(el, "id"),
        title: title,
        subreddit: subreddit,
        author: author,
        postType: attr(el, "post-type"),
        domain: attr(el, "domain"),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        commentCount: numFrom(attr(el, "comment-count")),
        commentCountText: attr(el, "comment-count"),
        created: attr(el, "created-timestamp"),
        permalink: abs(permalink),
        contentUrl: abs(attr(el, "content-href")),
        textPreview: clean(el.innerText || el.textContent).slice(0, 500)
      };
    }

    var paramsObj = new URLSearchParams(window.location.search);
    var data = {
      url: window.location.href,
      title: document.title,
      query: paramsObj.get("q") || "",
      type: paramsObj.get("type") || "",
      pageRecognized: /reddit/i.test(document.title + " " + document.body.innerText),
      extractedAt: new Date().toISOString(),
      results: []
    };
    var scope = window.location.pathname.match(/\/r\/([^\/]+)\/search/i);
    data.subredditScope = scope ? "r/" + decodeURIComponent(scope[1]) : "";

    var postNodes = document.querySelectorAll("shreddit-post, article[data-testid='post-container'], article");
    var seen = {};
    for (var i = 0; i < postNodes.length && data.results.length < limit; i++) {
      var p = postFrom(postNodes[i]);
      if (!p.title && !p.permalink) continue;
      var key = p.permalink || p.id || p.title;
      if (seen[key]) continue;
      seen[key] = true;
      data.results.push(p);
    }

    var links = document.querySelectorAll("a[href^='/r/'], a[href^='/user/'], a[href*='reddit.com/r/'], a[href*='reddit.com/user/']");
    for (var j = 0; j < links.length && data.results.length < limit; j++) {
      var href = links[j].getAttribute("href") || "";
      var text = clean(links[j].textContent);
      if (!text) continue;
      var isCommunity = /\/r\/[^\/]+\/?$/i.test(href);
      var isUser = /\/user\/[^\/]+\/?$/i.test(href);
      if (!isCommunity && !isUser) continue;
      var url = abs(href);
      if (seen[url]) continue;
      seen[url] = true;
      data.results.push({ kind: isCommunity ? "community" : "user", name: text, url: url });
    }

    data.count = data.results.length;
    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 12px;'>Reddit search: " + esc(data.query) + "</h2>";
      for (var k = 0; k < data.results.length; k++) {
        var r = data.results[k];
        h += "<div style='border-bottom:1px solid #ddd;padding:12px 0;'>";
        h += "<div style='font-weight:700;'>" + esc(r.title || r.name || "") + "</div>";
        h += "<div style='color:#666;font-size:13px;margin-top:4px;'>" + esc(r.kind) + " " + esc(r.subreddit || "") + " " + esc(r.author ? "u/" + r.author : "") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ query, type, subredditScope, results: [{ kind, title, subreddit, author, score, commentCount, permalink, contentUrl, textPreview } | { kind, name, url }], count }`
