# LinkedIn — Job Data Reference

## Requirements

**Auth:** Not required. LinkedIn job pages are public. If the page is blocked or unavailable for any reason, the skill returns an error.

**Browser:** Not required. The skill uses Python `requests` — runs directly in the terminal, no Chrome Bridge needed.

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

```python
import requests
import json
import re

def execute(params):
    url = params.get("url", "")
    data = {}

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
    except Exception as e:
        return { "error": f"Request failed: {str(e)}" }

    # Check if page is gated or unavailable
    if not response.ok or "authwall" in response.url:
        return { "error": "Page requires login or is unavailable" }

    html = response.text

    # Primary source: JSON-LD structured data
    match = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', html)
    json_ld = None

    if match:
        try:
            json_ld = json.loads(match.group(1))
        except:
            pass

    if json_ld:
        data["title"] = json_ld.get("title", "")
        data["company"] = (json_ld.get("hiringOrganization") or {}).get("name", "")
        location = json_ld.get("jobLocation") or {}
        address = location.get("address") or {}
        data["location"] = address.get("addressLocality", "")
        data["description"] = json_ld.get("description", "")
        data["employmentType"] = json_ld.get("employmentType", "")
        data["datePosted"] = json_ld.get("datePosted", "")

    # Fallback for title
    if not data.get("title"):
        title_match = re.search(r"<title>(.*?)</title>", html)
        data["title"] = title_match.group(1).replace(" | LinkedIn", "").strip() if title_match else ""

    if not data.get("description"):
        return { "error": "Could not extract job description" }

    # Parse years of experience
    exp_match = re.search(r"(\d+\+?\s*(?:to|-)\s*\d+|\d+\+?)\s*years?\s*(?:of\s*)?(?:experience|exp)", data["description"], re.IGNORECASE)
    data["yearsOfExperience"] = exp_match.group(0).strip() if exp_match else ""

    # Classify industry
    text = (data["title"] + " " + data["description"]).lower()

    industries = [
        { "name": "Cyber", "keywords": ["cyber", "security", "siem", "soc", "threat", "vulnerability", "firewall", "pentest"] },
        { "name": "AdTech", "keywords": ["adtech", "ad tech", "programmatic", "dsp", "ssp", "rtb", "advertising technology"] },
        { "name": "EdTech", "keywords": ["edtech", "ed tech", "education technology", "lms", "e-learning", "elearning"] },
        { "name": "FinTech", "keywords": ["fintech", "fin tech", "payments", "banking", "lending", "insurance tech"] },
        { "name": "HealthTech", "keywords": ["healthtech", "health tech", "medical", "clinical", "ehr", "healthcare"] },
        { "name": "eCommerce", "keywords": ["ecommerce", "e-commerce", "marketplace", "retail tech", "shopify"] },
        { "name": "Networking", "keywords": ["networking", "network", "routing", "switching", "sdwan", "sd-wan", "lan", "wan", "cisco", "juniper"] },
        { "name": "Telecom", "keywords": ["telecom", "telecommunications", "carrier", "5g", "4g", "lte", "mvno", "telco"] },
        { "name": "B2B SaaS", "keywords": ["b2b", "saas", "enterprise software", "crm", "erp", "platform"] }
    ]

    data["industry"] = "Other"
    for industry in industries:
        if any(kw in text for kw in industry["keywords"]):
            data["industry"] = industry["name"]
            break

    return data
```

**Returns:** `{ title, company, location, description, employmentType, datePosted, yearsOfExperience, industry }`

**Notes:** Uses Python `requests` — runs directly in the terminal without a browser or Chrome Bridge. No login required for public job postings.

---

## Reporting issues

If this breaks (LinkedIn changes their JSON-LD or blocks requests), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `job-data`.
