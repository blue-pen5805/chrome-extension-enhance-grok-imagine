/* eslint-disable no-console */
const ACTIVE_TAB_QUERY = { active: true, currentWindow: true };
const RECENT_EVENT_LIMIT = 50;
const recentEvents = [];
const WEBSOCKET_URL_PATTERNS = [
  "*://*.grok.com/*",
  "wss://*.grok.com/*"
];
const BLOCK_RULE_OFFSET = 1000;
const imaginePostPattern = /^\/imagine\/post\//i;
const blockedTabState = new Map();

const recordEvent = (payload = {}) => {
  recentEvents.unshift({
    receivedAt: Date.now(),
    ...payload
  });
  if (recentEvents.length > RECENT_EVENT_LIMIT) {
    recentEvents.length = RECENT_EVENT_LIMIT;
  }
};

chrome.runtime.onInstalled.addListener(() => {
  console.log("Grok Interaction Template installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GROK_TIMING_EVENT") {
    console.log("Timing event", message.payload);
    recordEvent(message.payload);
    sendResponse({ status: "received" });
  }

  if (message?.type === "REQUEST_CONTENT_SCAN") {
    chrome.tabs.query(ACTIVE_TAB_QUERY, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: "TRIGGER_CONTENT_SCAN" });
      }
    });
    sendResponse({ status: "dispatched" });
  }

  if (message?.type === "GET_RECENT_EVENTS") {
    sendResponse({ status: "ok", events: recentEvents });
  }

  if (message?.type === "CLEAR_EVENT_LOG") {
    recentEvents.length = 0;
    sendResponse({ status: "cleared" });
    return true;
  }

  return false;
});

const shouldBlockUrl = (rawUrl) => {
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

const updateTabWebSocketBlocking = async (tabId, shouldBlock, url) => {
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
    kind: shouldBlock ? "websocket-block-enabled" : "websocket-block-disabled",
    url,
    tabId
  };
  recordEvent(payload);
  if (tabId >= 0) {
    chrome.tabs.sendMessage(tabId, { type: "WEBSOCKET_EVENT", payload }, () => {
      if (chrome.runtime.lastError) {
        // no-op when content script missing
      }
    });
  }
};

const notifyWebSocketEvent = (detail) => {
  const payload = {
    kind: "websocket-open",
    url: detail.url,
    requestId: detail.requestId
  };
  recordEvent(payload);
  console.log("WebSocket handshake detected", detail.url);
  if (typeof detail.tabId === "number" && detail.tabId >= 0) {
    chrome.tabs.sendMessage(detail.tabId, {
      type: "WEBSOCKET_EVENT",
      payload
    });
  }
};

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    notifyWebSocketEvent(details);
  },
  { urls: WEBSOCKET_URL_PATTERNS, types: ["websocket"] }
);

const handleNavigationUpdate = (details) => {
  if (details.frameId !== 0) {
    return;
  }
  const { tabId, url } = details;
  if (typeof tabId !== "number" || tabId < 0 || !url) {
    return;
  }
  const shouldBlock = shouldBlockUrl(url);
  updateTabWebSocketBlocking(tabId, shouldBlock, url).catch((error) => {
    console.error("Failed to update blocking state", error);
  });
};

chrome.webNavigation.onCommitted.addListener(handleNavigationUpdate, {
  url: [{ hostSuffix: "grok.com" }]
});
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigationUpdate, {
  url: [{ hostSuffix: "grok.com" }]
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const ruleId = BLOCK_RULE_OFFSET + tabId;
  blockedTabState.delete(tabId);
  chrome.declarativeNetRequest
    .updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: []
    })
    .catch(() => {
      // ignore cleanup errors
    });
});
