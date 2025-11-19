import { initBridgeListener } from "./modules/bridge.js";
import { startNavigationWatcher, reportPageVisit } from "./modules/navigation.js";
import { initPromptHistory, hookListeners } from "./modules/prompt-history.js";
import { highlightInvisibleContainers, updateDownloaderSettings } from "./modules/downloader.js";
import { OBSERVER_CONFIG } from "./modules/constants.js";

// Initialize Bridge
initBridgeListener();

// Initialize Navigation Watcher
startNavigationWatcher();

// Load settings and initialize features
chrome.storage.sync.get({
  feature_prompt_history: true,
  feature_download_button: true,
  feature_show_blocked_border: true
}, (settings) => {
  updateDownloaderSettings(settings);

  if (settings.feature_prompt_history) {
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
  }
});

// Interval for highlighting invisible containers
window.setInterval(() => {
  highlightInvisibleContainers();
}, 100);

// Initial Page Visit Report
reportPageVisit();
