# TikTok Studio — Get Posts List Reference

## Requirements

**Auth:** TikTok Studio content management requires a logged-in creator account. Run this action in an already-authenticated browser session. Do not paste or commit auth cookies/session data.

**Browser:** Required. Use Playwright with a persistent signed-in Chrome profile, a built-in browser integration, or the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion to execute inside the user's real signed-in Chrome session.

**Scope:** This action only reads the currently visible posts table. It does not click rows, open menus, edit posts, delete posts, promote posts, download media, or scroll aggressively. If more rows are needed, manually scroll/load the page first, then run the action.

## How to run this action

Once the content page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
var result = await page.evaluate(async function(code) {
  var tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

var data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: get-posts-list

Use when the user wants the TikTok Studio posts/content list and visible table metrics.

**Navigate to:** `https://www.tiktok.com/tiktokstudio/content`

**Code:**

```js
({
  name: "tiktok-get-posts-list",
  description: "Extract the visible TikTok Studio posts/content table",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function linesFrom(node) {
      var raw = (node && (node.innerText || node.textContent)) || "";
      var parts = raw.split(/\n+/);
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var item = clean(parts[i]);
        if (item) out.push(item);
      }
      return out;
    }

    function imageIn(node) {
      var imgs = (node || document).querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].currentSrc || imgs[i].src || "";
        if (src && src.indexOf("data:") !== 0) return src;
      }
      return "";
    }

    function postIdFromUrl(url) {
      var match = (url || "").match(/\/video\/(\d+)/);
      return match ? match[1] : "";
    }

    function numeric(text) {
      return /^\d+([,.]\d+)?[KMB]?$/.test(text || "");
    }

    function parseRow(row) {
      var lines = linesFrom(row);
      if (lines.length < 6 || !/^\d+:\d+/.test(lines[0])) return null;

      var link = row.querySelector('a[href*="/video/"]');
      var postUrl = link ? link.href.split("?")[0] : "";
      var post = {
        postId: postIdFromUrl(postUrl),
        postUrl: postUrl,
        duration: lines[0],
        caption: "",
        pinned: false,
        createdAt: "",
        privacy: "",
        views: "",
        likes: "",
        comments: "",
        thumbnailUrl: imageIn(row),
        rawText: clean(row.innerText || row.textContent)
      };

      var i = 1;
      post.caption = lines[i] || "";
      i++;
      if (lines[i] === "Pinned") {
        post.pinned = true;
        i++;
      }
      post.createdAt = lines[i] || "";
      i++;
      post.privacy = lines[i] || "";
      i++;
      var nums = [];
      for (; i < lines.length; i++) if (numeric(lines[i])) nums.push(lines[i]);
      post.views = nums[0] || "";
      post.likes = nums[1] || "";
      post.comments = nums[2] || "";
      return post;
    }

    var rows = document.querySelectorAll('[data-tt="components_PostTable_Absolute"], [data-tt="components_RowLayout_FlexRow"]');
    var seen = {};
    var posts = [];
    for (var i = 0; i < rows.length; i++) {
      var post = parseRow(rows[i]);
      if (!post) continue;
      var key = post.postId || post.rawText;
      if (seen[key]) continue;
      seen[key] = true;
      posts.push(post);
    }

    var lines = linesFrom(document.body);
    var data = {
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      authenticated: !/log in|login|sign up|continue with/i.test(clean(document.body.innerText || document.body.textContent || "")),
      pageRecognized: /Posts \(Created on\)|Views|Likes|Comments|Privacy|Drafts/.test(clean(document.body.innerText || document.body.textContent || "")),
      postsCountVisible: posts.length,
      postsTotalLabel: "",
      draftsTotalLabel: "",
      columns: ["caption", "createdAt", "privacy", "views", "likes", "comments"],
      posts: posts
    };

    for (var j = 0; j < lines.length; j++) {
      if (/^Posts\s+\d+/.test(lines[j])) data.postsTotalLabel = lines[j];
      if (/^Drafts\s+\d+/.test(lines[j])) data.draftsTotalLabel = lines[j];
    }

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:22px;max-width:980px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 8px;font-size:22px;'>TikTok Studio posts</h2>";
      h += "<div style='color:#666;margin-bottom:14px;'>" + (data.postsTotalLabel || data.postsCountVisible + " visible posts") + (data.draftsTotalLabel ? " · " + data.draftsTotalLabel : "") + "</div>";
      h += "<table style='border-collapse:collapse;width:100%;font-size:13px;'><thead><tr><th style='text-align:left;border-bottom:1px solid #ddd;padding:6px;'>Post</th><th style='text-align:left;border-bottom:1px solid #ddd;padding:6px;'>Created</th><th style='text-align:right;border-bottom:1px solid #ddd;padding:6px;'>Views</th><th style='text-align:right;border-bottom:1px solid #ddd;padding:6px;'>Likes</th><th style='text-align:right;border-bottom:1px solid #ddd;padding:6px;'>Comments</th></tr></thead><tbody>";
      for (var k = 0; k < posts.length; k++) {
        var p = posts[k];
        h += "<tr><td style='border-bottom:1px solid #eee;padding:6px;'>" + (p.pinned ? "<strong>Pinned</strong> · " : "") + p.duration + " · " + p.caption + "</td><td style='border-bottom:1px solid #eee;padding:6px;'>" + p.createdAt + "</td><td style='border-bottom:1px solid #eee;padding:6px;text-align:right;'>" + p.views + "</td><td style='border-bottom:1px solid #eee;padding:6px;text-align:right;'>" + p.likes + "</td><td style='border-bottom:1px solid #eee;padding:6px;text-align:right;'>" + p.comments + "</td></tr>";
      }
      h += "</tbody></table></div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, capturedAt, authenticated, pageRecognized, postsCountVisible, postsTotalLabel, draftsTotalLabel, columns, posts: [{ postId, postUrl, duration, caption, pinned, createdAt, privacy, views, likes, comments, thumbnailUrl, rawText }] }`
