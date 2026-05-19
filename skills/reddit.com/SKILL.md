---
name: browsing-reddit
description: "Use when the user wants to interact with Reddit — extract subreddit feeds, Reddit search results, post/thread data with comments, user profile activity, or logged-in personal lists such as saved/upvoted posts. Works on reddit.com public pages without login for most actions; logged-in lists require the user's existing browser session. Use a real browser or Chrome Bridge because Reddit is a JavaScript-rendered app and may challenge plain fetches."
---

# Reddit — Browsing Skill

Use this index to choose the Reddit action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **subreddit-feed** — Extract visible posts from a subreddit feed such as hot, new, top, rising, or controversial. Full spec: [references/subreddit-feed.md](references/subreddit-feed.md).
- **search** — Search Reddit globally or within a subreddit and extract visible result posts, communities, users, and comments when present. Full spec: [references/search.md](references/search.md).
- **post-thread** — Extract a Reddit post plus visible nested comments, including comment depth, author, score, created time, permalinks, and body text. Full spec: [references/post-thread.md](references/post-thread.md).
- **user-profile** — Extract visible profile metadata and recent visible user activity from a Reddit user page. Full spec: [references/user-profile.md](references/user-profile.md).
- **current-user-list** — Extract visible items from logged-in personal Reddit lists such as saved, upvoted, downvoted, hidden, and history. Full spec: [references/current-user-list.md](references/current-user-list.md).

## Notes

- These actions are read-only. They do not vote, save, hide, join communities, send messages, post comments, or change account settings.
- Reddit virtualizes long feeds. Each action extracts the currently loaded visible items; scroll or load more before running when the user needs deeper coverage.
- Prefer Chrome Bridge when the page depends on the user's existing logged-in Chrome session or when Reddit presents a challenge page to new browser contexts.
