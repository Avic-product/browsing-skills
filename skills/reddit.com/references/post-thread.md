# Reddit — Post Thread Reference

## Requirements

**Auth:** Not required for public posts. Private, quarantined, age-gated, removed, or mature threads may require the user's logged-in browser session and preferences.

**Browser:** Use a real browser or Chrome Bridge. Reddit post pages render nested comments with web components, and many comment bodies are projected into slots.

## How to run this action

Navigate first, wait until comments are visible, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: post-thread

Use when the user wants a Reddit post and its visible comments.

**Navigate to:** `https://www.reddit.com/r/<subreddit>/comments/<post-id>/<slug>/`

**Code:**

```js
({
  name: "reddit-post-thread",
  description: "Extract a Reddit post and visible nested comments",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      commentLimit: { type: "number" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var commentLimit = params && params.commentLimit ? params.commentLimit : 200;

    function clean(s) { return (s || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim(); }
    function flat(s) { return (s || "").replace(/\s+/g, " ").trim(); }
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
      v = flat(v);
      if (!v) return null;
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function firstText(root, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = root.querySelector(selectors[i]);
        if (el && clean(el.innerText || el.textContent)) return clean(el.innerText || el.textContent);
      }
      return "";
    }
    function postFrom(el) {
      if (!el) return {};
      var titleLink = el.querySelector("a[href*='/comments/']");
      return {
        id: attr(el, "id"),
        title: attr(el, "post-title") || (titleLink ? flat(titleLink.textContent) : document.title.replace(/ : r\/.*$/i, "")),
        subreddit: attr(el, "subreddit-prefixed-name"),
        subredditName: attr(el, "subreddit-name"),
        author: attr(el, "author"),
        postType: attr(el, "post-type"),
        domain: attr(el, "domain"),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        commentCount: numFrom(attr(el, "comment-count")),
        commentCountText: attr(el, "comment-count"),
        upvoteRatio: attr(el, "upvote-ratio") ? parseFloat(attr(el, "upvote-ratio")) : null,
        created: attr(el, "created-timestamp"),
        permalink: abs(attr(el, "permalink") || window.location.pathname),
        contentUrl: abs(attr(el, "content-href")),
        body: firstText(el, ["[slot='text-body']", "[slot='post-body']", ".md", "div[data-post-click-location='text-body']"])
      };
    }
    function commentBody(el) {
      var body = firstText(el, ["[slot='comment']", "div[slot='comment']", ".md"]);
      if (body) return body;
      var clone = el.cloneNode(true);
      var remove = clone.querySelectorAll("shreddit-comment, [slot='commentAvatar'], [slot='commentMeta'], [slot='actionRow'], faceplate-tracker, button");
      for (var i = 0; i < remove.length; i++) remove[i].parentNode && remove[i].parentNode.removeChild(remove[i]);
      return clean(clone.innerText || clone.textContent);
    }
    function commentFrom(el) {
      return {
        id: attr(el, "thingid"),
        author: attr(el, "author"),
        depth: numFrom(attr(el, "depth")),
        score: numFrom(attr(el, "score")),
        scoreText: attr(el, "score"),
        created: attr(el, "created"),
        permalink: abs(attr(el, "permalink")),
        postId: attr(el, "postid"),
        collapsed: el.hasAttribute("collapsed"),
        body: commentBody(el)
      };
    }

    var postEl = document.querySelector("shreddit-post") || document.querySelector("article");
    var data = {
      url: window.location.href,
      title: document.title,
      pageRecognized: /reddit/i.test(document.title + " " + document.body.innerText),
      extractedAt: new Date().toISOString(),
      post: postFrom(postEl),
      comments: []
    };

    var comments = document.querySelectorAll("shreddit-comment");
    for (var i = 0; i < comments.length && data.comments.length < commentLimit; i++) {
      var c = commentFrom(comments[i]);
      if (!c.author && !c.body) continue;
      data.comments.push(c);
    }
    data.commentCountVisible = data.comments.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 8px;'>" + esc(data.post.title || "Reddit post") + "</h2>";
      h += "<div style='color:#666;font-size:13px;margin-bottom:16px;'>" + esc(data.post.subreddit || "") + " u/" + esc(data.post.author || "") + " comments " + data.commentCountVisible + "</div>";
      for (var j = 0; j < data.comments.length; j++) {
        var r = data.comments[j];
        h += "<div style='border-left:2px solid #ddd;margin:8px 0 8px " + Math.min((r.depth || 0) * 18, 90) + "px;padding:8px 0 8px 10px;'>";
        h += "<div style='font-weight:700;font-size:13px;'>u/" + esc(r.author || "") + " <span style='color:#666;font-weight:400;'>score " + esc(r.scoreText || "") + "</span></div>";
        h += "<div style='white-space:pre-wrap;margin-top:4px;'>" + esc((r.body || "").slice(0, 1000)) + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ post: { title, subreddit, author, score, commentCount, created, permalink, contentUrl, body }, comments: [{ id, author, depth, score, created, permalink, collapsed, body }], commentCountVisible }`
