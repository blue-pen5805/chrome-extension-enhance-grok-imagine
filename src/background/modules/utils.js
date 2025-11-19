import { LOG_PREFIX } from "../../content/modules/constants.js";

export const logSuppressedSendError = (context) => {
    const message = chrome.runtime.lastError?.message;
    if (!message) {
        return;
    }
    if (message.includes("Receiving end does not exist")) {
        console.debug(`${LOG_PREFIX} Suppressed sendMessage error (${context}): ${message}`);
        return;
    }
    console.warn(`${LOG_PREFIX} sendMessage error (${context}):`, message);
};

export const toMatchPattern = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}`;
        return `${url.protocol}//${url.host}${path}*`;
    } catch (error) {
        return rawUrl;
    }
};
