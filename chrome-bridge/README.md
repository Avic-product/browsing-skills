# Chrome Bridge

**Optional companion for browsing-skills.** A tiny bridge that lets an AI agent run browsing-skills scripts inside your real Chrome tabs — no Playwright, no headless browser, no login needed.

You only need this if your agent doesn't already have browser access (e.g. via its own Chromium integration, Playwright MCP, etc.). If it does, skip this entirely.

## How it works

```
┌──────────┐   HTTP    ┌─────────────┐   WebSocket   ┌────────────────┐
│  Agent   │ ────────► │   bridge    │ ◄────────────►│  Chrome tab    │
│          │           │  (Node.js)  │               │  (via ext.)    │
└──────────┘           └─────────────┘               └────────────────┘
     localhost:7865            active tab
```

1. The Chrome extension connects to a local WebSocket server.
2. The bridge exposes HTTP endpoints on `127.0.0.1:7865`.
3. Agent POSTs code (`/run-action` or `/eval`) → bridge forwards to extension → extension runs it in the active tab via Chrome Debugger Protocol → result streams back.

## Install

### 1. Run the bridge server

```bash
cd chrome-bridge/server
npm install
node bridge.js
```

You'll see: `[bridge] Listening on http://127.0.0.1:7865`.

### 2. Load the Chrome extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `chrome-bridge/extension/`

When the extension connects, the bridge server logs `[bridge] Extension connected`.

## Use from an agent

```bash
# List open tabs
curl http://127.0.0.1:7865/tabs

# Run a browsing-skills script in the active tab
curl -X POST http://127.0.0.1:7865/run-action \
  -H 'Content-Type: application/json' \
  -d '{"code": "({ execute: function() { return document.title; } })", "params": {}}'
```

### Endpoints

| Method | Path            | Purpose                                               |
|--------|-----------------|-------------------------------------------------------|
| GET    | `/tabs`         | List open tabs                                        |
| POST   | `/run-action`   | Run an action object's `execute(params)` in a tab      |
| POST   | `/eval`         | Run arbitrary JS expression                           |
| POST   | `/navigate`     | Navigate a tab to a URL                               |
| POST   | `/click`        | Click at x,y coordinates                              |
| POST   | `/type`         | Type text into the focused element                    |
| POST   | `/cdp`          | Run raw CDP commands                                  |
| POST   | `/evalInFrame`  | Evaluate JS inside a specific iframe                  |
| POST   | `/reload`       | Reload the extension (useful after edits)             |

All POST endpoints accept optional `tabId`; if omitted, the active tab is used.

## Security notes

- The bridge binds to `127.0.0.1` only — no remote access.
- The HTTP server rejects browser-origin requests (`Origin` / cross-site Fetch Metadata headers), including no-CORS POSTs from arbitrary websites to localhost.
- The WebSocket server only accepts localhost connections and rejects web-page origins during the handshake; the companion extension connects with a `chrome-extension://` origin.
- The extension requires `debugger` permission (Chrome shows a yellow "being debugged" banner while running).
- **Anything your agent sends runs in the context of the active tab.** Only use with trusted agents and scripts you've reviewed.
- Local processes on the same machine can still call the bridge while it is running. Treat the bridge as a trusted local development tool, not a sandbox boundary.

## Relation to browsing-skills

This tool is optional — browsing-skills is a registry of JS code that works with any browser automation setup. The bridge just happens to be the easiest option for agents that don't have browser access already.

See the main [README](../README.md) and [SKILL.md](../SKILL.md) for the skill registry itself.
