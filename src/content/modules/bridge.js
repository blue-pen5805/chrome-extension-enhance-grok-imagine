import { canSendRuntimeMessage, sendRuntimeMessage } from "./utils.js";
import { MESSAGE_SOURCE, MESSAGE_TYPE, LOG_PREFIX } from "./constants.js";

let bridgeInjectionRequested = false;

/**
 * Ensures that the WebSocket bridge script is injected into the page.
 * This allows us to intercept WebSocket messages.
 */
export const ensureBridgeInjected = () => {
    if (bridgeInjectionRequested || !canSendRuntimeMessage()) {
        return;
    }
    bridgeInjectionRequested = true;
    sendRuntimeMessage({ type: MESSAGE_TYPE.INJECT_WS_BRIDGE });
};

/**
 * Requests the page to close its WebSocket connection.
 * @param {string} reason - The reason for closing the socket.
 */
export const requestPageSocketClose = (reason = "Enhance Grok Imagine: post page restriction") => {
    window.postMessage(
        {
            source: MESSAGE_SOURCE.CONTENT_SCRIPT,
            type: MESSAGE_TYPE.GROK_WS_FORCE_CLOSE,
            reason
        },
        "*"
    );
};

/**
 * Handles WebSocket notifications from the injected script.
 * @param {Object} payload - The payload from the WebSocket event.
 */
export const handleWebSocketNotification = (payload = {}) => {
    if (!payload?.url) {
        return;
    }
    console.debug(LOG_PREFIX, "WebSocket event:", payload.kind, payload.url);
    if (payload.kind === MESSAGE_TYPE.WEBSOCKET_BLOCK_ENABLED) {
        requestPageSocketClose("Enhance Grok Imagine: declarative block");
    }
};

/**
 * Initializes the listener for messages from the injected bridge script.
 */
export const initBridgeListener = () => {
    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.source !== MESSAGE_SOURCE.WEBSOCKET_HOOK) {
            return;
        }
        console.debug(LOG_PREFIX, "WS event from page:", event.data);
    });
    ensureBridgeInjected();
};
