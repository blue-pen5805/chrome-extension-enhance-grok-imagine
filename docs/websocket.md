## WebSocket Logging & Blocking

### Logging
- `src/background.js` listens for `chrome.webRequest.onBeforeRequest` events targeting Grok domains.
- Every handshake emits a `websocket-open` event that is logged directly to the background console for debugging.
- `src/background.js` injects `src/content/injected-websocket.js` into the page (`world: "MAIN"`) via `chrome.scripting.executeScript`, so Grok\'s own code sees the wrapped `window.WebSocket`. The injected hook reports `GROK_WS_OPEN` / `GROK_WS_SEND` / `GROK_WS_CLOSED` messages with `window.postMessage`, and the content script listens for them to keep the UI in sync.

### Blocking Policy
- Declarative Net Request rules (per tab) block WebSockets when the navigation URL matches `/imagine/post/{uuid}`.
- The content script emits `IMAGINE_POST_STATE` messages whenever the SPA transitions enter/exit a post page; the background worker toggles the tab-specific rule immediately based on that signal.
- `chrome.webNavigation.onCommitted` and `onHistoryStateUpdated` remain as fallbacks to catch cases where a content script is absent (startup, reloads, etc.).
- Session rules are cleared whenever the service worker starts to avoid stale blocks, then re-applied for currently open tabs.

### Forced Close on Post Pages
- Because sockets opened before navigation might survive even after a declarative rule starts blocking, the injected hook keeps references to every open instance and exposes a `GROK_WS_FORCE_CLOSE` message channel.
- The content script posts that message whenever the SPA enters `/imagine/post/{uuid}` or when the background worker reports `websocket-block-enabled`. The injected hook iterates over open sockets and calls `close(4400, "Enhance Grok Imagine: restriction")`, ensuring no live channel remains on post detail screens.

### Cleanup
- When a tab is removed, its rule ID (`BLOCK_RULE_OFFSET + tabId`) is deleted and the injection cache is cleared.
- On service-worker startup, the extension scans existing Grok tabs, reinjects the bridge, and reapplies the correct allow/block state.
