
const defaultSettings = {
  feature_prompt_history: true,
  feature_download_button: true,
  feature_show_blocked_border: true,
  feature_disable_similar_generation: true,
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const stored = await chrome.storage.sync.get(defaultSettings);

  // Initialize toggles
  Object.keys(defaultSettings).forEach(key => {
    const toggle = document.getElementById(key);
    if (toggle) {
      toggle.checked = stored[key];

      // Add change listener
      toggle.addEventListener('change', (e) => {
        const newValue = e.target.checked;
        chrome.storage.sync.set({ [key]: newValue });
      });
    }
  });
});
