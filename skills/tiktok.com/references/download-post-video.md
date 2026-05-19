# TikTok — Download Post Video Reference

## Requirements

**Auth:** Public TikTok post pages may work without login. TikTok Studio analytics pages require a logged-in creator account that has access to the target post. Run this action in an already-authenticated browser session. Do not paste or commit auth cookies/session data.

**Browser:** Required. Use Playwright with a persistent signed-in Chrome profile, a built-in browser integration, or the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion to execute inside the user's real signed-in Chrome session.

**Scope:** This action reads the currently loaded TikTok page and optionally triggers a browser download for the visible playable video. It does not edit the post, delete media, publish, message users, follow accounts, or perform account-management actions.

**Download behavior:** TikTok often exposes the playing video as a `blob:` URL backed by the live page's media pipeline. A `blob:` URL can only be used inside the current browser page/session and may not be reusable by an external process. When a signed CDN URL is available, the action prefers that because it is more useful outside the page.

## How to run this action

Once the TikTok post page or TikTok Studio analytics page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
var result = await page.evaluate(async function(code) {
  var tool = eval(code);
  return await tool.execute({ mode: "data", download: false });
}, scriptCode);

var data = JSON.parse(result.content[0].text);
```

Set `download: true` to click a temporary download link in the browser. This can open Chrome's normal download flow depending on Chrome/TikTok/CORS behavior.

---

## Action: download-post-video

Use when the user wants to download or extract the playable video from a TikTok post page or from the preview player on a TikTok Studio analytics page.

**Navigate to:**

- Public post: `https://www.tiktok.com/@<username>/video/<post-id>`
- Studio analytics: `https://www.tiktok.com/tiktokstudio/analytics/<post-id>/overview`

**Code:**

```js
({
  name: "tiktok-download-post-video",
  description: "Extract playable/downloadable video candidates from the current TikTok post or Studio analytics page and optionally trigger a browser download",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." },
      download: { type: "boolean", description: "When true, click a temporary anchor for the best media candidate to trigger Chrome's download flow." },
      filename: { type: "string", description: "Optional download filename. Defaults to tiktok-<postId>.mp4 when a post ID is known." },
      allowBlobDownload: { type: "boolean", description: "Allow browser download attempts from blob: URLs. Defaults to true." }
    }
  },
  execute: function(params) {
    params = params || {};
    var mode = params.mode || "data";
    var shouldDownload = params.download === true;
    var allowBlobDownload = params.allowBlobDownload !== false;

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function esc(text) {
      return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function postIdFromUrl(url) {
      var match = (url || window.location.href).match(/\/video\/(\d+)/) || (url || window.location.href).match(/\/analytics\/([^/?#]+)/);
      return match ? match[1] : "";
    }

    function safeUrl(url) {
      if (!url || typeof url !== "string") return "";
      if (url.indexOf("//") === 0) return window.location.protocol + url;
      if (url.indexOf("\\u002F") !== -1) {
        try { url = JSON.parse('"' + url.replace(/"/g, '\\"') + '"'); } catch (e) {}
      }
      if (!/^(https?:|blob:|data:)/i.test(url)) return "";
      return url;
    }

    function isVideoLike(url, key) {
      url = url || "";
      key = key || "";
      if (/^blob:/.test(url)) return true;
      if (/\/api\//i.test(url)) return false;
      if (/mime_type=video|video_mp4|video\/mp4|\.mp4(\?|$)|v16|v19|tos-.*-ve|bytevc|playwm|playAddr|downloadAddr/i.test(url)) return true;
      if (/playAddr|downloadAddr|bitrate|video|Video|Url|url/i.test(key) && /tiktokcdn|byteoversea|ibyteimg|tos-|akamaized/i.test(url)) return true;
      return false;
    }

    function pushCandidate(out, seen, source, url, meta) {
      url = safeUrl(url);
      if (!url || !isVideoLike(url, meta && meta.key)) return;
      if (seen[url]) return;
      seen[url] = true;
      var reusable = !/^blob:/.test(url) && !/^data:/.test(url);
      out.push({
        source: source,
        url: url,
        reusableOutsidePage: reusable,
        isBlob: /^blob:/.test(url),
        isDataUrl: /^data:/.test(url),
        key: meta && meta.key || "",
        width: meta && meta.width || null,
        height: meta && meta.height || null,
        duration: meta && isFinite(meta.duration) ? meta.duration : null,
        quality: meta && meta.quality || "",
        mimeType: meta && meta.mimeType || "",
        note: reusable ? "" : "This URL is only usable inside the current browser page/session."
      });
    }

    function walkJson(value, path, out, seen, depth) {
      if (!value || depth > 10 || out.length > 120) return;
      if (typeof value === "string") {
        if (isVideoLike(value, path)) pushCandidate(out, seen, "page-json", value, { key: path });
        return;
      }
      if (typeof value !== "object") return;
      if (Object.prototype.toString.call(value) === "[object Array]") {
        for (var i = 0; i < value.length; i++) walkJson(value[i], path + "." + i, out, seen, depth + 1);
        return;
      }
      for (var k in value) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
        walkJson(value[k], path ? path + "." + k : k, out, seen, depth + 1);
        if (out.length > 120) break;
      }
    }

    function parsePageJson(out, seen) {
      var ids = ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE", "__NEXT_DATA__"];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el || !el.textContent) continue;
        try { walkJson(JSON.parse(el.textContent), ids[i], out, seen, 0); } catch (e) {}
      }
      var scripts = document.querySelectorAll("script");
      for (var j = 0; j < scripts.length && out.length < 120; j++) {
        var text = scripts[j].textContent || "";
        if (!/playAddr|downloadAddr|bitrateInfo|mime_type=video|video_mp4|tiktokcdn|byteoversea/i.test(text)) continue;
        var urls = text.match(/https?:\\?\/\\?\/[^"'\\s<>]+/g) || [];
        for (var u = 0; u < urls.length; u++) {
          var url = urls[u].replace(/\\\//g, "/");
          pushCandidate(out, seen, "script-text", url, { key: "script" });
        }
      }
    }

    function collectCandidates() {
      var out = [];
      var seen = {};
      var videos = document.querySelectorAll("video");
      for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        var rect = v.getBoundingClientRect();
        var meta = {
          key: "video[" + i + "]",
          width: v.videoWidth || Math.round(rect.width) || null,
          height: v.videoHeight || Math.round(rect.height) || null,
          duration: v.duration,
          mimeType: "video"
        };
        pushCandidate(out, seen, "video.currentSrc", v.currentSrc || "", meta);
        pushCandidate(out, seen, "video.src", v.src || "", meta);
        var sources = v.querySelectorAll("source[src]");
        for (var s = 0; s < sources.length; s++) {
          pushCandidate(out, seen, "video.source", sources[s].src || sources[s].getAttribute("src"), {
            key: "video[" + i + "].source[" + s + "]",
            width: meta.width,
            height: meta.height,
            duration: meta.duration,
            mimeType: sources[s].type || ""
          });
        }
      }

      var resources = [];
      try { resources = performance.getEntriesByType("resource") || []; } catch (e) {}
      for (var r = 0; r < resources.length; r++) {
        var name = resources[r].name || "";
        if (isVideoLike(name, "performance.resource")) {
          pushCandidate(out, seen, "performance", name, { key: "performance.resource" });
        }
      }

      parsePageJson(out, seen);

      out.sort(function(a, b) {
        function score(c) {
          var s = 0;
          if (c.reusableOutsidePage) s += 100;
          if (/downloadAddr/i.test(c.key)) s += 30;
          if (/playAddr/i.test(c.key)) s += 20;
          if (/mime_type=video|video_mp4|\.mp4/i.test(c.url)) s += 10;
          if (c.isBlob) s -= 20;
          return s;
        }
        return score(b) - score(a);
      });
      return out;
    }

    function inferCaption() {
      var selectors = [
        "[data-e2e='browse-video-desc']",
        "[data-e2e='video-desc']",
        "h1",
        "meta[property='og:description']"
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (!el) continue;
        var text = el.getAttribute("content") || el.innerText || el.textContent || "";
        text = clean(text);
        if (text) return text;
      }
      return clean(document.title).replace(/\| TikTok$/i, "");
    }

    function makeFilename(postId, caption) {
      var base = params.filename || ("tiktok-" + (postId || "video") + ".mp4");
      base = base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
      if (base.toLowerCase().indexOf(".mp4") === -1 && base.toLowerCase().indexOf(".mov") === -1) base += ".mp4";
      return base || "tiktok-video.mp4";
    }

    function triggerDownload(candidate, filename) {
      if (!candidate || !candidate.url) return { attempted: false, reason: "No candidate URL available." };
      if (candidate.isBlob && !allowBlobDownload) return { attempted: false, reason: "Best candidate is a blob URL and allowBlobDownload is false." };
      try {
        var a = document.createElement("a");
        a.href = candidate.url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          try { a.remove(); } catch (e) {}
        }, 1000);
        return {
          attempted: true,
          filename: filename,
          source: candidate.source,
          isBlob: candidate.isBlob,
          reusableOutsidePage: candidate.reusableOutsidePage,
          note: candidate.isBlob ? "Chrome may download from the live page blob only while this page/session remains open." : "Chrome download was triggered from a reusable media URL."
        };
      } catch (e) {
        return { attempted: false, reason: e && e.message ? e.message : String(e) };
      }
    }

    var postId = postIdFromUrl(window.location.href);
    var candidates = collectCandidates();
    var best = null;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].reusableOutsidePage || (allowBlobDownload && candidates[i].isBlob)) {
        best = candidates[i];
        break;
      }
    }

    var caption = inferCaption();
    var filename = makeFilename(postId, caption);
    var data = {
      url: window.location.href,
      title: document.title,
      postId: postId,
      caption: caption,
      pageRecognized: /tiktok/i.test(window.location.hostname) && (document.querySelectorAll("video").length > 0 || /TikTok Studio|TikTok/i.test(document.body.innerText || document.title)),
      videoElementCount: document.querySelectorAll("video").length,
      candidates: candidates,
      bestCandidate: best,
      download: shouldDownload ? triggerDownload(best, filename) : { attempted: false, reason: "download parameter was false." },
      extractedAt: new Date().toISOString()
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:900px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 8px;'>TikTok video download candidates</h2>";
      h += "<div style='color:#666;margin-bottom:14px;'>Post " + esc(postId || "unknown") + " · " + candidates.length + " candidate(s)</div>";
      if (best) h += "<div style='padding:10px;border:1px solid #ddd;margin-bottom:12px;'><strong>Best:</strong> " + esc(best.source) + " · reusable outside page: " + esc(String(best.reusableOutsidePage)) + "</div>";
      for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        h += "<div style='border-bottom:1px solid #eee;padding:10px 0;'>";
        h += "<div><strong>" + esc(c.source) + "</strong> " + (c.isBlob ? "<span style='color:#a66;'>(blob)</span>" : "") + "</div>";
        h += "<div style='font-size:12px;word-break:break-all;color:#555;'>" + esc(c.url) + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, postId, caption, videoElementCount, candidates, bestCandidate, download, extractedAt }`

Each candidate includes `{ source, url, reusableOutsidePage, isBlob, key, width, height, duration, mimeType, note }`. When `download: true`, the `download` object reports whether the browser download click was attempted.
