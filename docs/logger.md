## Grok Imagine Logger

Lightweight overlay injected only on `https://grok.com/imagine*`.

### Behavior
- Loads collapsed; click to toggle. Esc removes it.
- Shows the six most recent events (visits, timer interceptions, button clicks, WebSocket notices).
- Automatically refreshes when the popup requests a DOM rescan.

### Popup Actions
- **Rescan DOM** — re-runs click-hook attachment.
- **Refresh log** — fetches the background event buffer (last 50 items).
- **Clear log** — wipes background + overlay history.

### Customization
- Update `TARGET_SELECTORS` in `src/content/index.js` for additional buttons.
- Extend `TimingInterceptor` in the same file to capture more async primitives.
- Adjust styles in `ensureLogger()` if the default overlay placement needs tweaking.
