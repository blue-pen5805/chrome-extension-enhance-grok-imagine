/* eslint-disable no-console */

export const canSendRuntimeMessage = () => Boolean(chrome?.runtime?.id);

export const sendRuntimeMessage = (message) => {
    if (!canSendRuntimeMessage()) {
        return;
    }
    try {
        chrome.runtime.sendMessage(message, () => {
            if (chrome.runtime.lastError) {
                console.debug("Runtime message ignored", chrome.runtime.lastError.message);
            }
        });
    } catch (error) {
        console.warn("Failed to send runtime message", error);
    }
};

export const isImaginePage = (pattern) => pattern.test(window.location.pathname);
export const isImaginePostPage = (pattern) => pattern.test(window.location.pathname);
