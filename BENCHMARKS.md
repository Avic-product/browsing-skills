# Skill Benchmark Notes

This document tracks benchmarks comparing browser automation with and without site-specific skills. The goal is to measure whether a skill reduces agent context, model tokens, browser/tool round trips, debugging loops, and extraction errors compared with a general browser agent that must inspect the page and derive selectors at runtime.

Benchmarks should separate two costs:

- **Skill path:** load the site action index and the one relevant action reference, then execute the maintained action code.
- **No-skill path:** inspect the live page DOM, derive extraction code, run it, and iterate until the required fields are present or the run times out.

Token counts from OpenAI API runs are preferred when available. Local observable estimates should clearly say they exclude hidden reasoning, system context, and platform overhead.

## Actions To Benchmark

### 1. X post-data

- **Skill:** `skills/x.com`
- **Action reference:** `skills/x.com/references/post-data.md`
- **Target URL:** `https://x.com/OpenAI/status/2047376561205325845`
- **Goal:** Extract post content, author, timestamp, canonical URL, engagement metrics, and media flags.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; DOM inspection plus `POST /eval` for the no-skill path.

Initial real-world API benchmark:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 1,987 | 1 | ~1.27s API + browser run | Complete structured result |
| Without skill, DOM-inspection loop | 14,333 | 7 | ~35.1s | Partial result |

Observed result quality:

- **With skill:** found content, `OpenAI` / `@OpenAI`, timestamp, URL, replies, reposts, likes, bookmarks, views, photo count, and video flag.
- **Without skill:** found content and author, partially found metrics/media, but missed timestamp, canonical URL, likes, and views in the final run.

Notes:

- The no-skill branch used DOM snippets and iterative `eval` attempts, which better represents a real browser agent discovering selectors at runtime.
- Failed with-skill tool-loop runs caused by harness path/tool confusion should not be used as benchmark evidence; the clean skill-path benchmark better represents intended skill usage.

### 2. X search

- **Skill:** `skills/x.com`
- **Action reference:** `skills/x.com/references/search.md`
- **Target query:** `OpenAI`
- **Goal:** Compare a maintained search extractor against a no-skill agent that inspects the search page and derives selectors.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; DOM inspection plus `POST /eval` for the no-skill path.

Initial real-world API benchmark:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 1,699 | 1 | ~2.1s API, ~6.4s total with browser | Valid structured search results |
| Without skill, DOM-inspection loop | 3,907 | 3 | ~15.8s total | Malformed partial result |

Observed result quality:

- **With skill:** returned `query`, `totalResults`, and `results[]` with content, author name, handle, post URL, timestamp, engagement fields, and media flag. First result was parsed correctly.
- **Without skill:** inspected DOM and returned some visible posts, but reported `totalResults: 0`, swapped/mangled author name and handle fields, and missed most engagement metrics.

Notes:

- The no-skill agent used DOM inspection and an eval attempt, so this benchmark includes some page-observation cost.
- The skill path used the maintained search action directly and avoided selector discovery.

### 3. Booking.com hotel-data

- **Skill:** `skills/booking.com`
- **Action reference:** `skills/booking.com/references/hotel-data.md`
- **Target URL:** `https://www.booking.com/hotel/us/17john.html?...&checkin=2026-05-15&checkout=2026-05-19&group_adults=2&group_children=0&no_rooms=1&matching_block_id=719613307_419807327_2_0_0`
- **Goal:** Compare property detail extraction and availability detection for tracked room block `719613307_419807327_2_0_0`.
- **Browser layer:** Playwright Chromium for both paths. Skill path ran the maintained action via `page.evaluate()`; no-skill path inspected DOM snippets and generated extraction JS.

Initial real-world API benchmark:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 2,969 | 1 | ~19.0s total | Complete hotel data and availability |
| Without skill, DOM-inspection loop | 4,219 | 2 | ~35.6s total | Partial availability result |

Observed result quality:

- **With skill:** extracted `17John`, address, review score/count, 20 amenity entries, 11 photos, 9 room rows, and confirmed tracked block `719613307_419807327_2_0_0` as available at `€ 1,442`.
- **Without skill:** confirmed the tracked block and several prices, but missed hotel name, address, review score/count, room names, maximum quantities, and cancellation/payment policies.

Notes:

- The no-skill branch used only a small DOM sample in this run, so it kept token use modest but produced incomplete data.
- Both paths loaded the same live Booking page in fresh Playwright browser sessions, so logged-in Chrome pricing was not part of this comparison.

### 4. X profile-data

- **Skill:** `skills/x.com`
- **Action reference:** `skills/x.com/references/profile-data.md`
- **Target URL:** `https://x.com/OpenAI`
- **Goal:** Extract visible X profile fields such as display name, handle, verification, bio, join date, following/follower counts, avatar, and website.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; generated `POST /eval` script for the no-skill path.

Initial API benchmark:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 1,865 | 1 | ~12.3s total | Complete structured profile |
| Without skill, one-shot extractor | 324 | 1 | failed | No structured result |

Observed result quality:

- **With skill:** extracted `OpenAI`, `@OpenAI`, verified status, bio, join date, following/follower counts, and canonical URL.
- **Without skill:** generated a short extractor but failed at browser eval time with an uncaught error.

Notes:

- This run used a one-shot no-skill extractor, not a full DOM-inspection loop. A future real-world DOM-loop benchmark may produce a stronger no-skill result at higher token cost.

### 5. Booking.com search

- **Skill:** `skills/booking.com`
- **Action reference:** `skills/booking.com/references/search.md`
- **Target search:** New York, 2026-05-14 to 2026-05-17, 2 adults, 1 room
- **Goal:** Compare filtered accommodation search extraction with and without maintained URL/filter guidance.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; DOM inspection plus `POST /eval` for the no-skill path.

Initial real-world API benchmark:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 3,903 | 1 | ~9.5s total | Clean structured property cards |
| Without skill, DOM-inspection loop | 49,290 | 11 | ~82.5s total | Noisy partial result |

Observed result quality:

- **With skill:** returned `New York: 409 properties found`, 25 result cards, and clean fields including title, canonical URL, address, price, review score/count, and thumbnail.
- **Without skill:** eventually returned 25 cards, but needed repeated DOM inspections/eval attempts, missed address/distance, kept noisy tracking URLs, and confused review score/count.

Notes:

- Booking search is a stronger benchmark than X search because the page is denser and the result-card structure contains more fields.
- The no-skill path consumed substantially more tokens due to repeated DOM inspection and selector repair.

### 6. Amazon search

- **Skill:** `skills/amazon.com`
- **Action reference:** `skills/amazon.com/references/search.md`
- **Target search:** `electric drum kit`
- **Goal:** Compare visible Amazon search-card extraction with and without the maintained search action.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; DOM inspection plus `POST /eval` for the no-skill path. Both branches used the same logged-in Chrome profile, `www.amazon.com`, EUR pricing, and shipping destination shown as Greece.

Initial real-world API benchmark, May 20, 2026:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 17,588 | 3 | ~20.7s total | Complete visible product cards |
| Without skill, DOM-inspection loop | 21,770 | 6 | ~22.3s total | Partial/noisy product cards |

Observed result quality:

- **With skill:** returned 5 visible result cards with ASIN, title, price, rating, review count, product URL, image URL, delivery, and availability fields.
- **Without skill:** returned 5 visible result cards and result count, but product URLs were missing and delivery/availability text was noisier due to runtime selector discovery.

Notes:

- A failed setup attempt accidentally executed the reference file's usage-example code block instead of the action-object block; it was discarded per the fairness rule against counting harness/setup failures.
- The no-skill branch required more API and browser calls to inspect page structure, derive extraction logic, and repair output shape.

### 7. Amazon product-data

- **Skill:** `skills/amazon.com`
- **Action reference:** `skills/amazon.com/references/product-data.md`
- **Target URL:** `https://www.amazon.com/dp/B0C43R8SRB`
- **Goal:** Compare visible Amazon product detail extraction with and without the maintained product-data action.
- **Browser layer:** Chrome Bridge on `POST /run-action` for the skill path; DOM inspection plus `POST /eval` for the no-skill path. Both branches used the same shared Chrome profile, `www.amazon.com`, and current locale/currency/shipping state.
- **Captured at:** `2026-05-20T05:59:09.827Z`

Initial real-world API benchmark, May 20, 2026:

| Mode | Total API Tokens | API Calls | Wall Time | Result Quality |
|---|---:|---:|---:|---|
| With skill, clean action selection | 12,321 | 3 | ~9.6s total | Complete product data |
| Without skill, DOM-inspection loop | 8,673 | 4 | ~19.6s total | Partial product data |

Observed result quality:

- **With skill:** returned ASIN, title, price, availability, seller field, rating, review count, 8 bullets, 12 images, Add to Cart state, and Buy Now visibility.
- **Without skill:** returned ASIN, title, brand, price, availability, seller, rating, review count, 8 bullets, 8 images, and Add to Cart state, but missed Buy Now visibility and included locale/bot-text caveats.

Notes:

- Fresh API usage was captured for both branches with `gpt-5.4-mini`; with-skill usage was 12,122 prompt tokens and 199 completion tokens, while no-skill usage was 7,186 prompt tokens and 1,487 completion tokens.
- This stable product page was easy for the no-skill branch to inspect, so it used fewer tokens; the skill branch used fewer browser calls, ran faster, and returned richer image coverage plus Buy Now visibility.

### 8. LinkedIn post-data

- **Skill:** `skills/linkedin.com`
- **Action reference:** `skills/linkedin.com/references/post-data.md`
- **Target URL:** TBD
- **Goal:** Compare LinkedIn post extraction via maintained JSON-LD/DOM guidance versus runtime discovery.
- **Status:** Planned.

