## Verification Checklist

1. **Load extension** — Developer Mode → Load unpacked → select repo root.
2. **Visit `/imagine`** — logger appears collapsed, popup `Refresh log` shows entries after interaction.
3. **Visit `/imagine/post/{uuid}`** — overlay logs `websocket-block-enabled` and no handshake succeeds.
4. **Return to `/imagine`** — overlay logs `websocket-block-disabled`; WebSocket opens again.
5. **Popup buttons** — `Rescan DOM`, `Refresh log`, and `Clear log` respond without console errors.

## Troubleshooting

- Logger missing? Ensure URL matches `https://grok.com/imagine*` and content script isn’t CSP-blocked.
- WebSocket always blocked? Reload the extension to reset declarative rules.
- Logs stale? Check `chrome://extensions` service-worker console for runtime errors.
