/* eslint-disable no-console */
import { MESSAGE_TYPE } from "../content/modules/constants.js";
import { resetSessionRules, initializeBlockingState, updateTabWebSocketBlocking } from "./modules/blocking.js";
import { resolveTabId, handleNavigationUpdate } from "./modules/navigation.js";
import { injectBridgeForTab } from "./modules/injection.js";
import { notifyWebSocketEvent } from "./modules/messaging.js";
import { blockedTabState, injectedTabSet } from "./modules/state.js";

const WEBSOCKET_URL_PATTERNS = [
    "*://*.grok.com/*",
    "wss://*.grok.com/*"
];
const BLOCK_RULE_OFFSET = 1000;

resetSessionRules();
initializeBlockingState();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPE.IMAGINE_POST_STATE) {
        const shouldBlock = Boolean(message.payload?.isPostPage);
        const sourceUrl = message.payload?.url ?? sender?.url ?? sender?.tab?.url;
        resolveTabId(sender, sourceUrl)
            .then((tabId) => {
                if (typeof tabId !== "number" || tabId < 0) {
                    return;
                }
                updateTabWebSocketBlocking(tabId, shouldBlock, sourceUrl).catch((error) => {
                    console.error("Failed to toggle WebSocket blocking from content script", error);
                });
            })
            .catch((error) => {
                console.error("Failed to resolve tabId for post state", error);
            });
        return false;
    }

    if (message?.type === MESSAGE_TYPE.INJECT_WS_BRIDGE) {
        const tabId = sender?.tab?.id;
        if (typeof tabId !== "number" || tabId < 0) {
            sendResponse?.({ status: "skipped" });
            return false;
        }
        injectBridgeForTab(tabId)
            .then(() => {
                sendResponse?.({ status: "ok" });
            })
            .catch((error) => {
                console.error("Failed to inject WebSocket bridge", error);
                sendResponse?.({ status: "error", message: error?.message });
            });
        return true;
    }

    return false;
});

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        notifyWebSocketEvent(details);
    },
    { urls: WEBSOCKET_URL_PATTERNS, types: ["websocket"] }
);

chrome.webNavigation.onCommitted.addListener(handleNavigationUpdate, {
    url: [{ hostSuffix: "grok.com" }]
});
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigationUpdate, {
    url: [{ hostSuffix: "grok.com" }]
});

chrome.tabs.onRemoved.addListener((tabId) => {
    const ruleId = BLOCK_RULE_OFFSET + tabId;
    blockedTabState.delete(tabId);
    injectedTabSet.delete(tabId);
    chrome.declarativeNetRequest
        .updateSessionRules({
            removeRuleIds: [ruleId],
            addRules: []
        })
        .catch(() => {
            // ignore cleanup errors
        });
});
