# LinkedIn — Job Data Reference

## Requirements

**Auth:** Not required. LinkedIn job pages are public. If the page is blocked or unavailable for any reason, the skill returns an error.

**Browser:** Not required. The skill uses a plain `fetch` request — no Chrome Bridge needed.

## How to run

Via Claude Code — just provide the job URL:

```
Get data from this LinkedIn job: https://www.linkedin.com/jobs/view/4375223373
```

Or in a script, call the action directly with the job URL as a parameter.

If the page is blocked, the skill returns:
```json
{ "error": "Page requires login or is unavailable" }
```

---

## Action: job-data

**Navigate to:** `https://www.linkedin.com/jobs/view/<job-id>` (the job's canonical URL).

**Code:**

```js
({
  name: "linkedin-job-data",
  description: "Extract job data from a LinkedIn job posting page including title, company, location, description, employment type, years of experience and industry",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The LinkedIn job URL e.g. https://www.linkedin.com/jobs/view/4375223373"
      }
    },
    required: ["url"]
  },
  execute: async function(params) {
    var url = params.url;
    var data = {};

    // Fetch the job page
    var response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    });

    // Check if page is gated or unavailable
    if (!response.ok || response.url.includes("authwall")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Page requires login or is unavailable" }) }] };
    }

    var html = await response.text();

    // Primary source: JSON-LD structured data (most reliable)
    var jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    var jsonLd = null;

    if (jsonLdMatch) {
      try {
        jsonLd = JSON.parse(jsonLdMatch[1]);
      } catch(e) {}
    }

    if (jsonLd) {
      data.title = jsonLd.title || "";
      data.company = (jsonLd.hiringOrganization && jsonLd.hiringOrganization.name) || "";
      data.location = (jsonLd.jobLocation && jsonLd.jobLocation.address && jsonLd.jobLocation.address.addressLocality) || "";
      data.description = jsonLd.description || "";
      data.employmentType = jsonLd.employmentType || "";
      data.datePosted = jsonLd.datePosted || "";
    }

    // Fallback if JSON-LD missing
    if (!data.title) {
      var titleMatch = html.match(/<title>(.*?)<\/title>/);
      data.title = titleMatch ? titleMatch[1].replace(" | LinkedIn", "").trim() : "";
    }

    if (!data.description) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Could not extract job description" }) }] };
    }

    // Parse years of experience from description
    var expMatch = data.description.match(/(\d+\+?\s*(?:to|-)\s*\d+|\d+\+?)\s*years?\s*(?:of\s*)?(?:experience|exp)/i);
    data.yearsOfExperience = expMatch ? expMatch[0].trim() : "";

    // Classify industry from description + title
    var text = (data.title + " " + data.description).toLowerCase();

    var industries = [
      { name: "Cyber", keywords: ["cyber", "security", "siem", "soc", "threat", "vulnerability", "firewall", "pentest"] },
      { name: "AdTech", keywords: ["adtech", "ad tech", "programmatic", "dsp", "ssp", "rtb", "advertising technology"] },
      { name: "EdTech", keywords: ["edtech", "ed tech", "education technology", "lms", "e-learning", "elearning"] },
      { name: "FinTech", keywords: ["fintech", "fin tech", "payments", "banking", "lending", "insurance tech"] },
      { name: "HealthTech", keywords: ["healthtech", "health tech", "medical", "clinical", "ehr", "healthcare"] },
      { name: "eCommerce", keywords: ["ecommerce", "e-commerce", "marketplace", "retail tech", "shopify"] },
      { name: "Networking", keywords: ["networking", "network", "routing", "switching", "sdwan", "sd-wan", "lan", "wan", "cisco", "juniper"] },
      { name: "Telecom", keywords: ["telecom", "telecommunications", "carrier", "5g", "4g", "lte", "mvno", "telco"] },
      { name: "B2B SaaS", keywords: ["b2b", "saas", "enterprise software", "crm", "erp", "platform"] }
    ];

    data.industry = "Other";
    for (var i = 0; i < industries.length; i++) {
      var keywords = industries[i].keywords;
      for (var j = 0; j < keywords.length; j++) {
        if (text.indexOf(keywords[j]) !== -1) {
          data.industry = industries[i].name;
          break;
        }
      }
      if (data.industry !== "Other") break;
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ title, company, location, description, employmentType, datePosted, yearsOfExperience, industry }`

**Notes:** Primary extraction is via JSON-LD (`<script type="application/ld+json">` on the job page). No browser or login required for public job postings. If LinkedIn blocks access for any reason, an error object is returned instead.

---

## Reporting issues

If this breaks (LinkedIn changes their JSON-LD or blocks fetch requests), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `job-data`.
