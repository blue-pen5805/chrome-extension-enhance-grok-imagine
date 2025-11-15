/* eslint-disable no-console */
const ACTIVE_TAB_QUERY = { active: true, currentWindow: true };
const RECENT_EVENT_LIMIT = 50;
const recentEvents = [];

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
  }

  return true;
});
