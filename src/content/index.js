import { initBridgeListener } from "./modules/bridge.js";
import { startNavigationWatcher, reportPageVisit } from "./modules/navigation.js";
import { initPromptHistory, hookListeners, updatePromptHistorySettings } from "./modules/prompt-history.js";
import { highlightInvisibleContainers, updateDownloaderSettings } from "./modules/downloader.js";
import { OBSERVER_CONFIG } from "./modules/constants.js";

// Initialize Bridge
initBridgeListener();

// Initialize Navigation Watcher
startNavigationWatcher();

// Mutation Observer with debounce
let debounceTimer = null;
const handleMutation = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    hookListeners();
    highlightInvisibleContainers();
  }, 50);
};

const grokObserver = new MutationObserver(handleMutation);
if (document.body) {
  grokObserver.observe(document.body, OBSERVER_CONFIG);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    grokObserver.observe(document.body, OBSERVER_CONFIG);
  });
}

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
  }

  // Initial settings sync for prompt history
  updatePromptHistorySettings(settings);
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  const newSettings = {};
  let hasDownloaderUpdates = false;
  let hasPromptHistoryUpdates = false;

  if (changes.feature_download_button) {
    newSettings.feature_download_button = changes.feature_download_button.newValue;
    hasDownloaderUpdates = true;
  }
  if (changes.feature_show_blocked_border) {
    newSettings.feature_show_blocked_border = changes.feature_show_blocked_border.newValue;
    hasDownloaderUpdates = true;
  }
  if (changes.feature_prompt_history) {
    newSettings.feature_prompt_history = changes.feature_prompt_history.newValue;
    hasPromptHistoryUpdates = true;
  }

  if (hasDownloaderUpdates) {
    updateDownloaderSettings(newSettings);
  }
  if (hasPromptHistoryUpdates) {
    updatePromptHistorySettings(newSettings);
  }
});



// Initial Page Visit Report
reportPageVisit();
