import { injectedTabSet } from "./state.js";

export const injectBridgeForTab = async (tabId) => {
    if (injectedTabSet.has(tabId)) {
        return "already-injected";
    }
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/injected-websocket.js"],
        world: "MAIN"
    });
    injectedTabSet.add(tabId);
    return "injected";
};
