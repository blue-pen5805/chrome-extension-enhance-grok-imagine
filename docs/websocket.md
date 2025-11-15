## WebSocket Logging & Blocking

### Logging
- `src/background.js` listens for `chrome.webRequest.onBeforeRequest` events targeting Grok domains.
- Every handshake emits a `websocket-open` event recorded in `recentEvents` and pushed to the overlay/popup.

### Blocking Policy
- Declarative Net Request rules (per tab) block WebSockets when the navigation URL matches `/imagine/post/{uuid}`.
- Rules are re-evaluated on `chrome.webNavigation.onCommitted` and `onHistoryStateUpdated` so SPA transitions stay in sync.
- Session rules are cleared whenever the service worker starts to avoid stale blocks, then re-applied for current tabs.

### Cleanup
- Tabs removed? Their rule IDs (`BLOCK_RULE_OFFSET + tabId`) are deleted.
- Service worker startup scans open Grok tabs, reapplying the correct allow/block state.
