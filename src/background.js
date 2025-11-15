/* eslint-disable no-console */
const ACTIVE_TAB_QUERY = { active: true, currentWindow: true };

chrome.runtime.onInstalled.addListener(() => {
  console.log("Grok Interaction Template installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GROK_TIMING_EVENT") {
    console.log("Timing event", message.payload);
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

  return true;
});
