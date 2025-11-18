import { blockedTabState } from "./state.js";
import { logSuppressedSendError } from "./utils.js";
import { MESSAGE_TYPE } from "../../content/modules/constants.js";

const BLOCK_RULE_OFFSET = 1000;
const imaginePostPattern = /^\/imagine\/post\//i;

export const shouldBlockUrl = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        if (!url.hostname.endsWith("grok.com")) {
            return false;
        }
        return imaginePostPattern.test(url.pathname);
    } catch (error) {
        return false;
    }
};

export const updateTabWebSocketBlocking = async (tabId, shouldBlock, url) => {
    const current = blockedTabState.get(tabId) ?? false;
    if (current === shouldBlock) {
        return;
    }
    const ruleId = BLOCK_RULE_OFFSET + tabId;
    const addRules = shouldBlock
        ? [
            {
                id: ruleId,
                priority: 1,
                action: { type: "block" },
                condition: {
                    tabIds: [tabId],
                    requestDomains: ["grok.com"],
                    resourceTypes: ["websocket"]
                }
            }
        ]
        : [];

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules
    });
    blockedTabState.set(tabId, shouldBlock);
    const payload = {
        kind: shouldBlock ? MESSAGE_TYPE.WEBSOCKET_BLOCK_ENABLED : "websocket-block-disabled",
        url,
        tabId
    };
    if (tabId >= 0) {
        chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPE.WEBSOCKET_EVENT, payload }, () => {
            if (chrome.runtime.lastError) {
                logSuppressedSendError("updateTabWebSocketBlocking");
            }
        });
    }
};

export const resetSessionRules = () => {
    chrome.declarativeNetRequest
        .getSessionRules()
        .then((rules) => {
            if (!rules?.length) {
                return;
            }
            return chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: rules.map((rule) => rule.id),
                addRules: []
            });
        })
        .catch((error) => {
            console.warn("Failed to reset session rules", error);
        });
};

export const initializeBlockingState = () => {
    chrome.tabs.query({ url: ["*://grok.com/*", "*://*.grok.com/*"] }, (tabs = []) => {
        tabs.forEach((tab) => {
            if (typeof tab.id !== "number" || tab.id < 0 || !tab.url) {
                return;
            }
            const shouldBlock = shouldBlockUrl(tab.url);
            updateTabWebSocketBlocking(tab.id, shouldBlock, tab.url).catch((error) => {
                console.error("Failed to initialize blocking state", error);
            });
        });
    });
};
