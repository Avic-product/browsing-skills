---
name: browsing-tiktok
description: "Use when the user wants to interact with TikTok or TikTok Studio — extract logged-in creator analytics for a post, list Studio posts, or download/extract the playable video from a TikTok post or Studio analytics page. TikTok Studio analytics require an authenticated browser session; Playwright can run the actions when launched with a signed-in browser profile, and Chrome Bridge can run them in the user's already-signed-in Chrome."
---

# TikTok — Browsing Skill

Use this index to choose the TikTok action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **get-post-analytics** — Extract TikTok Studio analytics for a specific post, including post metadata, overview metric cards, engagement counts, the Overview Video views chart/hourly history, retention notes/curve, traffic sources, search query availability, sidebar posts, and visible chart labels. Full spec: [references/get-post-analytics.md](references/get-post-analytics.md).
- **get-posts-list** — Extract the visible TikTok Studio posts/content table, including post URL, post ID, caption, duration, created time, privacy, views, likes, comments, pinned status, and thumbnail URL. Full spec: [references/get-posts-list.md](references/get-posts-list.md).
- **download-post-video** — Extract downloadable/playable video candidates from the current TikTok post or Studio analytics page and optionally trigger a browser download. Full spec: [references/download-post-video.md](references/download-post-video.md).
