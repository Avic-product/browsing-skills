# TikTok Studio — Get Post Analytics Reference

## Requirements

**Auth:** TikTok Studio analytics require a logged-in creator account that has access to the target post. Run this action in an already-authenticated browser session. The `__tea_session_id_*` and `STM_TAB_ID_KEY` values sometimes visible in browser storage are telemetry/session-storage values and are not enough by themselves; in an isolated Playwright browser they redirect to TikTok login.

**Browser:** Required. Use Playwright with a persistent signed-in Chrome profile, a built-in browser integration, or the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion to execute inside the user's real signed-in Chrome session.

**Scope:** This action reads the currently visible TikTok Studio analytics page. It does not change tabs, edit the post, download media, message users, or perform account actions. If the user needs data from the Viewers or Engagement tabs, navigate to that tab first or extend this action later to click tabs deliberately.

## Playwright preparation

Use a signed-in persistent profile. Do not hardcode or commit cookies/session data.

```js
var { chromium } = require("playwright-core");

var context = await chromium.launchPersistentContext("/path/to/signed-in/chrome-profile", {
  headless: false,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  viewport: { width: 1920, height: 1200 }
});

var page = await context.newPage();
await page.goto("https://www.tiktok.com/tiktokstudio/analytics/<post-id>/overview", {
  waitUntil: "domcontentloaded"
});
await page.waitForTimeout(8000);
```

If this lands on `/login`, the browser context is not authenticated enough for TikTok Studio. Use Chrome Bridge or export/import the actual signed-in browser cookies/profile through your normal secure workflow.

## How to run this action

Once the analytics page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
var result = await page.evaluate(async function(code) {
  var tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

var data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: get-post-analytics

Use when the user wants all visible analytics from a TikTok Studio post analytics page.

**Navigate to:** `https://www.tiktok.com/tiktokstudio/analytics/<post-id>/overview`

Example: `https://www.tiktok.com/tiktokstudio/analytics/<post-id>/overview`

**Code:**

```js
({
  name: "tiktok-get-post-analytics",
  description: "Extract visible TikTok Studio analytics for a single post",
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

    function uniqPush(arr, value) {
      if (value && arr.indexOf(value) === -1) arr.push(value);
    }

    function camel(label) {
      return clean(label).toLowerCase().replace(/[^a-z0-9]+(.)/g, function(_, c) { return c ? c.toUpperCase() : ""; });
    }

    function getPostId() {
      var match = window.location.href.match(/\/analytics\/([^/?#]+)/);
      return match ? match[1] : "";
    }

    function currentTab() {
      var match = window.location.pathname.match(/\/analytics\/[^/]+\/([^/?#]+)/);
      return match ? match[1] : "";
    }

    function findValueAfterLabel(label, root) {
      var scanLines = linesFrom(root || document.body);
      var normalized = clean(label).toLowerCase();
      for (var i = 0; i < scanLines.length; i++) {
        var line = scanLines[i];
        if (line.toLowerCase() === normalized) {
          for (var j = i + 1; j < scanLines.length; j++) {
            if (scanLines[j].toLowerCase() !== normalized) return scanLines[j];
          }
        }
        if (line.toLowerCase().indexOf(normalized + " ") === 0) {
          return clean(line.substring(label.length));
        }
      }
      return "";
    }

    function findCompactValue(label, text) {
      var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var re = new RegExp(escaped + "\\s*([^A-Za-z\\n]+(?:[A-Za-z%:.0-9<>]+)?)", "i");
      var match = (text || "").match(re);
      return match ? clean(match[1]) : "";
    }

    function findSectionByHeading(heading) {
      var nodes = document.querySelectorAll("h1, h2, h3, div, section, article");
      var target = heading.toLowerCase();
      for (var i = 0; i < nodes.length; i++) {
        var own = clean(nodes[i].innerText || nodes[i].textContent);
        if (own.toLowerCase() === target || own.toLowerCase().indexOf(target) === 0) {
          var node = nodes[i];
          for (var depth = 0; depth < 6 && node; depth++) {
            var text = clean(node.innerText || node.textContent);
            if (text.length > heading.length + 20) return node;
            node = node.parentElement;
          }
        }
      }
      return null;
    }

    function imageIn(node) {
      var imgs = (node || document).querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].currentSrc || imgs[i].src || "";
        if (src && src.indexOf("data:") !== 0) return src;
      }
      return "";
    }

    function extractPostCard() {
      var data = { title: "", postedOn: "", thumbnailUrl: "", engagement: {} };
      var candidates = document.querySelectorAll("div, section, article");
      var card = null;
      var bestLength = Infinity;
      for (var i = 0; i < candidates.length; i++) {
        var text = clean(candidates[i].innerText || candidates[i].textContent);
        var numericCount = (text.match(/\b\d+([,.]\d+)?[KMB]?\b/g) || []).length;
        if (/Posted on\s+\d+\/\d+\/\d+/i.test(text) && imageIn(candidates[i]) && numericCount >= 5 && text.length < bestLength) {
          card = candidates[i];
          bestLength = text.length;
        }
      }
      if (!card) return data;
      var cardLines = linesFrom(card);
      for (var j = 0; j < cardLines.length; j++) {
        if (!data.title && !/^Posted on/i.test(cardLines[j]) && !/^\d+([,.]\d+)?[KMB]?$/.test(cardLines[j]) && !/^(Upload|Back|Overview|Viewers|Engagement)$/i.test(cardLines[j])) data.title = cardLines[j];
        var posted = cardLines[j].match(/Posted on\s+(.+)$/i);
        if (posted) data.postedOn = clean(posted[1]);
      }
      data.thumbnailUrl = imageIn(card);

      var numeric = [];
      for (var k = 0; k < cardLines.length; k++) {
        if (/^\d+([,.]\d+)?[KMB]?$/.test(cardLines[k])) numeric.push(cardLines[k]);
      }
      var names = ["views", "likes", "comments", "shares", "favorites"];
      var start = Math.max(0, numeric.length - names.length);
      for (var n = 0; n < names.length && start + n < numeric.length; n++) data.engagement[names[n]] = numeric[start + n];
      return data;
    }

    function extractSummaryMetrics() {
      var labels = ["Video views", "Total play time", "Average watch time", "Watched full video", "New followers"];
      var metrics = {};
      for (var i = 0; i < labels.length; i++) {
        var value = findValueAfterLabel(labels[i], document.body);
        if (!value) value = findCompactValue(labels[i], document.body.innerText || document.body.textContent || "");
        metrics[camel(labels[i])] = { label: labels[i], value: value };
      }
      return metrics;
    }

    function extractTrafficSources() {
      var labels = ["For You", "Personal profile", "Other", "Direct messages", "Following", "Sound", "Search"];
      var section = findSectionByHeading("Traffic source") || document.body;
      var sectionLines = linesFrom(section);
      var out = [];
      for (var i = 0; i < labels.length; i++) {
        var pct = "";
        for (var j = 0; j < sectionLines.length; j++) {
          if (sectionLines[j].toLowerCase() === labels[i].toLowerCase()) {
            for (var k = j + 1; k < Math.min(sectionLines.length, j + 5); k++) {
              if (/<?\d+(\.\d+)?%/.test(sectionLines[k])) { pct = sectionLines[k]; break; }
            }
          }
          if (!pct && sectionLines[j].toLowerCase().indexOf(labels[i].toLowerCase()) === 0) {
            var match = sectionLines[j].match(/(<?\d+(?:\.\d+)?%)/);
            if (match) pct = match[1];
          }
        }
        if (pct) out.push({ source: labels[i], percent: pct });
      }
      return out;
    }

    function extractSearchQueries() {
      var section = findSectionByHeading("Search queries");
      if (!section) return { available: false, message: "" };
      var sectionLines = linesFrom(section);
      var queries = [];
      var unavailable = "";
      for (var i = 0; i < sectionLines.length; i++) {
        if (/low traffic|available once|not enough/i.test(sectionLines[i])) unavailable = sectionLines[i];
        if (/%$/.test(sectionLines[i]) && i > 0) queries.push({ query: sectionLines[i - 1], percent: sectionLines[i] });
      }
      return { available: queries.length > 0, message: unavailable, queries: queries };
    }

    function extractRetention() {
      var section = findSectionByHeading("Retention rate");
      if (!section) return { note: "", visibleValues: [] };
      var sectionLines = linesFrom(section);
      var values = [];
      var note = "";
      for (var i = 0; i < sectionLines.length; i++) {
        if (/stopped watching|lost interest/i.test(sectionLines[i])) note = sectionLines[i];
        if (/^\d+:\d+/.test(sectionLines[i]) || /^\d+(\.\d+)?%$/.test(sectionLines[i]) || /^100%$|^50%$/.test(sectionLines[i])) uniqPush(values, sectionLines[i]);
      }
      return { note: note, visibleValues: values };
    }

    function extractRetentionCurve() {
      return extractEChartCurve("videoRetention");
    }

    function extractEChartCurve(instanceKey) {
      var instance = window.eChartInstances && window.eChartInstances[instanceKey];
      if (!instance || typeof instance.getOption !== "function") return [];
      var option;
      try { option = instance.getOption(); } catch (e) { return []; }
      var xData = option && option.xAxis && option.xAxis[0] && option.xAxis[0].data ? option.xAxis[0].data : [];
      var yData = option && option.series && option.series[0] && option.series[0].data ? option.series[0].data : [];
      var points = [];
      for (var i = 0; i < yData.length; i++) {
        var rawX = xData[i];
        var ms = "";
        if (rawX && typeof rawX === "object" && rawX.value !== undefined) ms = rawX.value;
        else if (rawX !== undefined) ms = rawX;
        var second = ms !== "" && !isNaN(Number(ms)) ? Math.round(Number(ms) / 1000) : i;
        var raw = Number(yData[i]);
        points.push({
          second: second,
          percent: isNaN(raw) ? "" : Math.round(raw * 1000) / 10,
          retentionRate: isNaN(raw) ? "" : Math.round(raw * 1000) / 10,
          raw: yData[i]
        });
      }
      return points;
    }

    function valueAfterLine(lines, label) {
      var target = label.toLowerCase();
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === target && i + 1 < lines.length) return lines[i + 1];
      }
      return "";
    }

    function parsePercentRows(lines, startLabel, stopLabels) {
      var out = [];
      var start = -1;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === startLabel.toLowerCase()) { start = i + 1; break; }
      }
      if (start < 0) return out;
      for (var j = start; j < lines.length - 1; j++) {
        var label = lines[j];
        if (stopLabels && stopLabels.indexOf(label) >= 0) break;
        var value = lines[j + 1];
        if (/^<?\d+(\.\d+)?%$/.test(value)) {
          out.push({ label: label, percent: value });
          j++;
        }
      }
      return out;
    }

    function extractViewersTab() {
      var lines = linesFrom(document.body);
      var data = {
        totalViewers: "",
        totalViewersDelta: "",
        totalViewersComparison: "",
        viewerTypes: {
          newVsReturning: [],
          followersVsNonFollowers: []
        },
        age: [],
        gender: [],
        locations: []
      };
      data.totalViewers = valueAfterLine(lines, "Total viewers");
      for (var i = 0; i < lines.length; i++) {
        if (lines[i] === "Total viewers") {
          data.totalViewersDelta = lines[i + 2] || "";
          data.totalViewersComparison = lines[i + 3] || "";
          break;
        }
      }

      var viewerIndex = -1;
      for (var v = 0; v < lines.length; v++) if (lines[v] === "Viewer types") { viewerIndex = v; break; }
      if (viewerIndex >= 0) {
        var firstPercents = [];
        var firstLabels = [];
        for (var p = viewerIndex + 1; p < lines.length && p < viewerIndex + 9; p++) {
          if (/^<?\d+(\.\d+)?%$/.test(lines[p])) firstPercents.push(lines[p]);
          else if (lines[p] && !/^<?\d+(\.\d+)?%$/.test(lines[p])) firstLabels.push(lines[p]);
        }
        if (firstPercents.length >= 2 && firstLabels.length >= 2) {
          data.viewerTypes.newVsReturning.push({ type: firstLabels[0], percent: firstPercents[0] });
          data.viewerTypes.newVsReturning.push({ type: firstLabels[1], percent: firstPercents[1] });
        }
        if (firstPercents.length >= 4 && firstLabels.length >= 4) {
          data.viewerTypes.followersVsNonFollowers.push({ type: firstLabels[2], percent: firstPercents[2] });
          data.viewerTypes.followersVsNonFollowers.push({ type: firstLabels[3], percent: firstPercents[3] });
        }
      }

      data.age = parsePercentRows(lines, "Age", ["Gender", "Locations"]);
      data.gender = parsePercentRows(lines, "Gender", ["Locations"]);
      data.locations = parsePercentRows(lines, "Locations", []);
      return data;
    }

    function extractEngagementTab() {
      var lines = linesFrom(document.body);
      var data = {
        likes: {
          note: "",
          visibleValues: [],
          curve: extractEChartCurve("videoLike")
        },
        topWordsUsedInComments: {
          available: false,
          message: "",
          words: []
        }
      };
      for (var i = 0; i < lines.length; i++) {
        if (/Most viewers liked/i.test(lines[i])) data.likes.note = lines[i];
        if (/^\d+:\d+$/.test(lines[i]) || /^<?\d+(\.\d+)?%$/.test(lines[i]) || /^\d+:\d+\s+\(\d+(\.\d+)?%\)$/.test(lines[i])) uniqPush(data.likes.visibleValues, lines[i]);
        if (/enough data for analysis/i.test(lines[i])) data.topWordsUsedInComments.message = lines[i];
      }
      var wordRows = parsePercentRows(lines, "Top words used in comments", []);
      for (var w = 0; w < wordRows.length; w++) {
        if (wordRows[w].label !== "-" && wordRows[w].percent !== "-%") data.topWordsUsedInComments.words.push({ word: wordRows[w].label, percent: wordRows[w].percent });
      }
      data.topWordsUsedInComments.available = data.topWordsUsedInComments.words.length > 0;
      return data;
    }

    function extractVisibleChartLabels() {
      var labels = [];
      var nodes = document.querySelectorAll("svg text, canvas + *, div, span");
      for (var i = 0; i < nodes.length; i++) {
        var t = clean(nodes[i].innerText || nodes[i].textContent);
        if (/^(May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr)\s+\d{1,2}$/.test(t) || /^\d+(\.\d+)?[KMB]?$/.test(t)) uniqPush(labels, t);
      }
      return labels.slice(0, 80);
    }

    function extractSidebarPosts() {
      var out = [];
      var sidebar = document.querySelector("aside") || document.querySelector('[role="navigation"]') || document.body;
      var imgs = sidebar.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var item = imgs[i];
        var node = item;
        for (var depth = 0; depth < 5 && node.parentElement; depth++) {
          var text = clean(node.innerText || node.textContent);
          if (text.length > 8) break;
          node = node.parentElement;
        }
        var title = clean(node.innerText || node.textContent);
        if (title && out.length < 30) out.push({ title: title, thumbnailUrl: item.currentSrc || item.src || "" });
      }
      return out;
    }

    var bodyText = clean(document.body.innerText || document.body.textContent || "");
    var data = {
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      postId: getPostId(),
      tab: currentTab(),
      authenticated: !/log in|login|sign up|continue with/i.test(bodyText),
      pageRecognized: /TikTok Studio|Video views|Total play time|Retention rate|Traffic source|Watched full video|Total viewers|Viewer types|Top words used in comments|Most viewers liked/i.test(bodyText),
      post: extractPostCard(),
      summaryMetrics: extractSummaryMetrics(),
      retentionRate: extractRetention(),
      retentionCurve: extractRetentionCurve(),
      viewers: currentTab() === "viewers" ? extractViewersTab() : null,
      engagement: currentTab() === "engagement" ? extractEngagementTab() : null,
      trafficSources: extractTrafficSources(),
      searchQueries: extractSearchQueries(),
      visibleChartLabels: extractVisibleChartLabels(),
      sidebarPosts: extractSidebarPosts(),
      rawText: bodyText
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:22px;max-width:920px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 8px;font-size:22px;'>TikTok post analytics</h2>";
      h += "<div style='color:#666;margin-bottom:14px;'>Post " + data.postId + " · " + data.tab + "</div>";
      h += "<h3 style='font-size:16px;margin:16px 0 6px;'>Post</h3>";
      h += "<div style='display:flex;gap:12px;align-items:center;'>";
      if (data.post.thumbnailUrl) h += "<img src='" + data.post.thumbnailUrl + "' style='width:72px;height:72px;object-fit:cover;border-radius:6px;'>";
      h += "<div><strong>" + (data.post.title || "Untitled post") + "</strong><div style='color:#666;'>" + (data.post.postedOn || "") + "</div></div></div>";
      h += "<h3 style='font-size:16px;margin:18px 0 6px;'>Overview</h3><ul>";
      for (var key in data.summaryMetrics) h += "<li><strong>" + data.summaryMetrics[key].label + ":</strong> " + (data.summaryMetrics[key].value || "") + "</li>";
      h += "</ul>";
      if (data.trafficSources.length) {
        h += "<h3 style='font-size:16px;margin:18px 0 6px;'>Traffic source</h3><ul>";
        for (var i = 0; i < data.trafficSources.length; i++) h += "<li>" + data.trafficSources[i].source + ": " + data.trafficSources[i].percent + "</li>";
        h += "</ul>";
      }
      if (data.retentionRate.note || data.retentionCurve.length) {
        h += "<h3 style='font-size:16px;margin:18px 0 6px;'>Retention</h3>";
        if (data.retentionRate.note) h += "<p>" + data.retentionRate.note + "</p>";
        if (data.retentionCurve.length) h += "<div style='color:#666;font-size:13px;'>" + data.retentionCurve.length + " retention points extracted</div>";
      }
      if (data.viewers) {
        h += "<h3 style='font-size:16px;margin:18px 0 6px;'>Viewers</h3>";
        h += "<div>Total viewers: " + (data.viewers.totalViewers || "") + "</div>";
      }
      if (data.engagement) {
        h += "<h3 style='font-size:16px;margin:18px 0 6px;'>Engagement</h3>";
        if (data.engagement.likes.note) h += "<p>" + data.engagement.likes.note + "</p>";
        if (data.engagement.likes.curve.length) h += "<div style='color:#666;font-size:13px;'>" + data.engagement.likes.curve.length + " like-timing points extracted</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, capturedAt, postId, tab, authenticated, pageRecognized, post: { title, postedOn, thumbnailUrl, engagement }, summaryMetrics, retentionRate, retentionCurve: [{ second, percent, retentionRate, raw }], viewers, engagement, trafficSources, searchQueries, visibleChartLabels, sidebarPosts, rawText }`
