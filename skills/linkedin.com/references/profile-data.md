# LinkedIn — Profile Data Reference

## Requirements

**Auth:** Required. You must be logged in to LinkedIn in your Chrome browser before running this skill. The skill runs inside your existing logged-in Chrome tab via Chrome Bridge — no credentials are passed to the script.

**Browser:** Required. LinkedIn profile pages are fully JS-rendered — plain `fetch` will not return profile data. Use Chrome Bridge with your authenticated Chrome session.

**Chrome Bridge:** Must be running. Start it with:

```bash
cd chrome-bridge/server
node bridge.js
```

That's it. The skill automatically finds the LinkedIn tab and runs the action in it.

## How to run

1. Make sure you are logged in to LinkedIn in Chrome
2. Navigate to the target profile URL in Chrome
3. Make sure Chrome Bridge is running:

```bash
cd chrome-bridge/server
node bridge.js
```

The skill automatically finds the LinkedIn tab and runs the action in it.

Or via `page.evaluate()` in Playwright:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for HTML output instead of JSON.

---

## Action: profile-data

**Navigate to:** `https://www.linkedin.com/in/<username>/` (the profile's canonical URL).

**Code:**

```js
({
  name: "linkedin-profile-data",
  description: "Extract profile data from a LinkedIn profile page including name, headline, location, connection degree, about, experience, education and skills",
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

    // Name
    var nameEl = document.querySelector("h1.text-heading-xlarge");
    data.name = nameEl ? nameEl.textContent.trim() : "";

    // Headline
    var headlineEl = document.querySelector(".text-body-medium.break-words");
    data.headline = headlineEl ? headlineEl.textContent.trim() : "";

    // Location
    var locationEl = document.querySelector(".text-body-small.inline.t-black--light.break-words");
    data.location = locationEl ? locationEl.textContent.trim() : "";

    // Connection degree (1st / 2nd / 3rd)
    var degreeEl = document.querySelector(".dist-value");
    data.connectionDegree = degreeEl ? degreeEl.textContent.trim() : "";

    // About
    var aboutEl = document.querySelector("#about ~ div .full-width.t-14");
    data.about = aboutEl ? aboutEl.textContent.trim() : "";

    // Experience
    data.experience = [];
    var expItems = document.querySelectorAll("#experience ~ div .pvs-list__item--line-separated");
    for (var i = 0; i < expItems.length; i++) {
      var titleEl = expItems[i].querySelector(".t-bold span[aria-hidden='true']");
      var companyEl = expItems[i].querySelector(".t-14.t-normal span[aria-hidden='true']");
      var datesEl = expItems[i].querySelector(".t-14.t-normal.t-black--light span[aria-hidden='true']");
      data.experience.push({
        title: titleEl ? titleEl.textContent.trim() : "",
        company: companyEl ? companyEl.textContent.trim() : "",
        dates: datesEl ? datesEl.textContent.trim() : ""
      });
    }

    // Education
    data.education = [];
    var eduItems = document.querySelectorAll("#education ~ div .pvs-list__item--line-separated");
    for (var j = 0; j < eduItems.length; j++) {
      var schoolEl = eduItems[j].querySelector(".t-bold span[aria-hidden='true']");
      var degreeEl = eduItems[j].querySelector(".t-14.t-normal span[aria-hidden='true']");
      var eduDatesEl = eduItems[j].querySelector(".t-14.t-normal.t-black--light span[aria-hidden='true']");
      data.education.push({
        school: schoolEl ? schoolEl.textContent.trim() : "",
        degree: degreeEl ? degreeEl.textContent.trim() : "",
        dates: eduDatesEl ? eduDatesEl.textContent.trim() : ""
      });
    }

    // Skills
    data.skills = [];
    var skillItems = document.querySelectorAll("#skills ~ div .pvs-list__item--line-separated");
    for (var k = 0; k < skillItems.length; k++) {
      var skillEl = skillItems[k].querySelector(".t-bold span[aria-hidden='true']");
      if (skillEl) data.skills.push(skillEl.textContent.trim());
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";

      // Header
      h += "<h2 style=\"color:#70b5f9;margin:0 0 4px;\">" + (data.name || "Unknown") + "</h2>";
      h += "<div style=\"color:#aaa;margin-bottom:4px;\">" + (data.headline || "") + "</div>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:4px;\">" + (data.location || "") + "</div>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:16px;\">Connection: " + (data.connectionDegree || "N/A") + "</div>";

      // About
      if (data.about) {
        h += "<h3 style=\"color:#e0e0e0;border-bottom:1px solid #333;padding-bottom:8px;\">About</h3>";
        h += "<p style=\"color:#ccc;line-height:1.6;\">" + data.about + "</p>";
      }

      // Experience
      if (data.experience.length) {
        h += "<h3 style=\"color:#e0e0e0;border-bottom:1px solid #333;padding-bottom:8px;\">Experience</h3>";
        for (var e = 0; e < data.experience.length; e++) {
          h += "<div style=\"margin-bottom:12px;\">";
          h += "<div style=\"font-weight:600;\">" + (data.experience[e].title || "") + "</div>";
          h += "<div style=\"color:#aaa;\">" + (data.experience[e].company || "") + "</div>";
          h += "<div style=\"color:#888;font-size:13px;\">" + (data.experience[e].dates || "") + "</div>";
          h += "</div>";
        }
      }

      // Education
      if (data.education.length) {
        h += "<h3 style=\"color:#e0e0e0;border-bottom:1px solid #333;padding-bottom:8px;\">Education</h3>";
        for (var ed = 0; ed < data.education.length; ed++) {
          h += "<div style=\"margin-bottom:12px;\">";
          h += "<div style=\"font-weight:600;\">" + (data.education[ed].school || "") + "</div>";
          h += "<div style=\"color:#aaa;\">" + (data.education[ed].degree || "") + "</div>";
          h += "<div style=\"color:#888;font-size:13px;\">" + (data.education[ed].dates || "") + "</div>";
          h += "</div>";
        }
      }

      // Skills
      if (data.skills.length) {
        h += "<h3 style=\"color:#e0e0e0;border-bottom:1px solid #333;padding-bottom:8px;\">Skills</h3>";
        h += "<div style=\"display:flex;flex-wrap:wrap;gap:8px;\">";
        for (var s = 0; s < data.skills.length; s++) {
          h += "<span style=\"background:#1d2226;border:1px solid #444;padding:4px 10px;border-radius:20px;font-size:13px;\">" + data.skills[s] + "</span>";
        }
        h += "</div>";
      }

      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, headline, location, connectionDegree, about, experience[ { title, company, dates } ], education[ { school, degree, dates } ], skills[ ] }`

**Notes:** LinkedIn profile pages are fully JS-rendered and login-gated. A real authenticated browser session via Chrome Bridge is required. The skill automatically finds the LinkedIn tab — no manual tab ID needed.

---

## Reporting issues

If this breaks (LinkedIn changes their DOM), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `profile-data`.
