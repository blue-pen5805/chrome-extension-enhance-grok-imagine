import { initBridgeListener } from "./modules/bridge.js";
import { startNavigationWatcher, reportPageVisit } from "./modules/navigation.js";
import { initPromptHistory, hookListeners } from "./modules/prompt-history.js";
import { highlightInvisibleContainers } from "./modules/downloader.js";
import { OBSERVER_CONFIG } from "./modules/constants.js";

// Initialize Bridge
initBridgeListener();

// Initialize Navigation Watcher
startNavigationWatcher();

// Initialize Prompt History
initPromptHistory();

// Initial Hook
hookListeners();

// Mutation Observer for dynamic content
const grokObserver = new MutationObserver(() => {
  hookListeners();
});

if (document.body) {
  grokObserver.observe(document.body, OBSERVER_CONFIG);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    grokObserver.observe(document.body, OBSERVER_CONFIG);
  });
}

// Interval for highlighting invisible containers
window.setInterval(() => {
  highlightInvisibleContainers();
}, 100);

// Initial Page Visit Report
reportPageVisit();
