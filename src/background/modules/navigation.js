import { toMatchPattern } from "./utils.js";
import { injectBridgeForTab } from "./injection.js";
import { shouldBlockUrl, updateTabWebSocketBlocking } from "./blocking.js";

export const resolveTabId = async (sender, fallbackUrl) => {
    if (typeof sender?.tab?.id === "number" && sender.tab.id >= 0) {
        return sender.tab.id;
    }
    const candidateUrl = fallbackUrl ?? sender?.url ?? sender?.tab?.url;
    if (!candidateUrl) {
        return null;
    }
    try {
        const pattern = toMatchPattern(candidateUrl);
        const tabs = await chrome.tabs.query({ url: [pattern] });
        return tabs[0]?.id ?? null;
    } catch (error) {
        console.warn("Failed to resolve tabId from sender", error);
        return null;
    }
};

export const handleNavigationUpdate = (details) => {
    if (details.frameId !== 0) {
        return;
    }
    const { tabId, url } = details;
    if (typeof tabId !== "number" || tabId < 0 || !url) {
        return;
    }
    injectBridgeForTab(tabId).catch((error) => {
        console.debug("Bridge injection skipped", error?.message);
    });
    const shouldBlock = shouldBlockUrl(url);
    updateTabWebSocketBlocking(tabId, shouldBlock, url).catch((error) => {
        console.error("Failed to update blocking state", error);
    });
};
