(async () => {
    const src = chrome.runtime.getURL("src/content/index.js");
    try {
        await import(src);
    } catch (error) {
        console.error("[Grok Imagine] Failed to load content script module:", error);
    }
})();
