# Repository Guidelines

## Project Structure & Module Organization

- Root: `manifest.json` defines the Chrome extension; `assets/` holds icon placeholders; `README.md` explains Grok-specific behavior.
- Background logic: `src/background.js` handles runtime messages, event recording, and tab communication.
- Content logic: `src/content/index.js` injects listeners into Grok.com pages and reports timing and click events.
- UI: `ui/popup.html` contains the popup UI, inline script, and basic styles.

## Build, Test, and Development

- No build step is required; edit files directly and reload the extension.
- Load in Chrome via `chrome://extensions` → enable Developer mode → **Load unpacked** → select this repository root.
- After changes, use **Reload** on the extension card and re-open the popup on a `https://grok.com/*` page.

## Coding Style & Naming Conventions

- Use 2-space indentation, double quotes in JavaScript, and trailing semicolons to match existing files.
- Prefer `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, and descriptive names (e.g., `TimingInterceptor`, `recentEvents`).
- Keep popup HTML/CSS minimal and self-contained inside `ui/popup.html`.

## Testing Guidelines

- There is no automated test suite yet; validate changes by interacting with Grok.com pages and the extension popup.
- When adding tests, place them under a new `tests/` directory and name files `*.spec.js` or `*.test.js`; document any tooling in `README.md`.

## Commit & Pull Request Guidelines

- Follow the existing style: short, imperative commit messages (e.g., `Add popup event log viewer`, `Remove binary icons and document placeholder`).
- For PRs, include: a clear summary, affected files/areas, steps to verify behavior, and screenshots/GIFs for UI or UX changes.

## Agent-Specific Instructions

- Keep changes minimal and focused; avoid introducing new build systems or dependencies without a clear need.
- Preserve existing Chrome permissions and structure in `manifest.json`; discuss any permission changes explicitly in PR descriptions.
