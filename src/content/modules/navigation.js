import {
    IMAGINE_PATH_PATTERN,
    IMAGINE_POST_PATTERN,
    NAVIGATION_EVENT
} from "./constants.js";
import {
    isImaginePage,
    isImaginePostPage,
    sendRuntimeMessage,
    canSendRuntimeMessage
} from "./utils.js";
import {
    removeMasonryStyling,
    scheduleMasonryStylingForPath
} from "./styling.js";
import { requestPageSocketClose } from "./bridge.js";

let lastReportedPath = null;
let navigationWatcherStarted = false;
let lastReportedPostState = null;

const syncPostPageBlockingState = (isPostPageActive, url, path) => {
    if (lastReportedPostState === isPostPageActive) {
        return;
    }
    lastReportedPostState = isPostPageActive;
    if (isPostPageActive) {
        requestPageSocketClose();
    }
    sendRuntimeMessage({
        type: "IMAGINE_POST_STATE",
        payload: {
            isPostPage: isPostPageActive,
            url,
            path
        }
    });
};

export const reportPageVisit = () => {
    const url = window.location.href;
    const path = window.location.pathname + window.location.search;
    const imagineActive = isImaginePage(IMAGINE_PATH_PATTERN);
    const postPageActive = imagineActive && isImaginePostPage(IMAGINE_POST_PATTERN);
    if (!imagineActive) {
        removeMasonryStyling();
        syncPostPageBlockingState(false, url, path);
        return;
    }

    syncPostPageBlockingState(postPageActive, url, path);
    if (path === lastReportedPath) {
        return;
    }
    lastReportedPath = path;
    if (postPageActive) {
        scheduleMasonryStylingForPath(path);
    } else {
        removeMasonryStyling();
    }
};

export const startNavigationWatcher = () => {
    if (navigationWatcherStarted) {
        return;
    }
    navigationWatcherStarted = true;
    const emitNavigationEvent = () => {
        window.dispatchEvent(new Event(NAVIGATION_EVENT));
    };
    const wrapHistoryMethod = (method) => {
        const original = history[method];
        history[method] = function (...args) {
            const result = original.apply(this, args);
            emitNavigationEvent();
            return result;
        };
    };
    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("popstate", emitNavigationEvent);
    window.addEventListener(NAVIGATION_EVENT, () => {
        reportPageVisit();
    });
    let lastSeenUrl = window.location.href;
    const pollUrlChange = () => {
        if (window.location.href !== lastSeenUrl) {
            lastSeenUrl = window.location.href;
            reportPageVisit();
        }
        if (canSendRuntimeMessage()) {
            window.requestAnimationFrame(pollUrlChange);
        }
    };
    window.requestAnimationFrame(pollUrlChange);
};
