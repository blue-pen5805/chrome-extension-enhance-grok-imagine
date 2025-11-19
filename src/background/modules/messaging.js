import { logSuppressedSendError } from "./utils.js";
import { MESSAGE_TYPE } from "../../content/modules/constants.js";

export const notifyWebSocketEvent = (detail) => {
    const payload = {
        kind: "websocket-open",
        url: detail.url,
        requestId: detail.requestId
    };
    if (typeof detail.tabId === "number" && detail.tabId >= 0) {
        chrome.tabs.sendMessage(
            detail.tabId,
            {
                type: MESSAGE_TYPE.WEBSOCKET_EVENT,
                payload
            },
            () => {
                if (chrome.runtime.lastError) {
                    logSuppressedSendError("notifyWebSocketEvent");
                }
            }
        );
    }
};
