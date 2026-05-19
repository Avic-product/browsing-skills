# X (Twitter) — Search Reference

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

## Benchmark

- **With skill:** 1,699 tokens, ~6.4s total.
- **Without skill:** 3,907 tokens, ~15.8s total.
- **Comparison:** Skill returned valid structured search results; no-skill inspected DOM but mangled author fields, reported totalResults: 0, and missed most engagement metrics.

