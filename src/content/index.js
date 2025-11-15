/* eslint-disable no-console */
const TARGET_SELECTORS = [
  "button",
  "[data-role='grok-primary']",
  "[data-testid='submit']"
];

const observerConfig = { childList: true, subtree: true };
const imaginePathPattern = /^\/imagine(?:\/post\/[\w-]+)?/i;
const imaginePostPattern = /^\/imagine\/post\//i;
const NAVIGATION_EVENT = "grok-imagine-url-change";
let lastReportedPath = null;
let navigationWatcherStarted = false;
let styledPath = null;
let lastReportedPostState = null;

const isImaginePage = () => imaginePathPattern.test(window.location.pathname);
const isImaginePostPage = () => imaginePostPattern.test(window.location.pathname);
const masonrySelector = "[id^='imagine-masonry-section-'] > *:first-child";
const masonryHiddenSelector = "#imagine-masonry-section-0 > [role='list']";
const canSendRuntimeMessage = () => Boolean(chrome?.runtime?.id);

const sendRuntimeMessage = (message) => {
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

let bridgeInjectionRequested = false;

const ensureBridgeInjected = () => {
  if (bridgeInjectionRequested || !canSendRuntimeMessage()) {
    return;
  }
  bridgeInjectionRequested = true;
  sendRuntimeMessage({ type: "INJECT_WS_BRIDGE" });
};

const requestPageSocketClose = (reason = "Grok Imagine Enhancer: post page restriction") => {
  window.postMessage(
    {
      source: "grok-content-script",
      type: "GROK_WS_FORCE_CLOSE",
      reason
    },
    "*"
  );
};

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "grok-websocket-hook") {
    return;
  }
  console.debug("[Grok Imagine] WS event from page:", event.data);
});

ensureBridgeInjected();

class TimingInterceptor {
  constructor() {
    this.originalSetTimeout = window.setTimeout;
    this.originalSetInterval = window.setInterval;
    this.pendingTimers = new Map();
  }

  enable() {
    window.setTimeout = (callback, delay = 0, ...rest) => {
      const scheduledAt = performance.now();
      const timerId = this.originalSetTimeout(() => {
        this.report("timeout", delay, scheduledAt);
        callback(...rest);
        this.pendingTimers.delete(timerId);
      }, delay);
      this.pendingTimers.set(timerId, { delay, scheduledAt });
      return timerId;
    };

    window.setInterval = (callback, delay = 0, ...rest) => {
      const scheduledAt = performance.now();
      const timerId = this.originalSetInterval(() => {
        this.report("interval", delay, scheduledAt);
        callback(...rest);
      }, delay);
      this.pendingTimers.set(timerId, { delay, scheduledAt, recurring: true });
      return timerId;
    };
  }

  report(kind, delay, scheduledAt) {
    console.debug(`[Grok Imagine] ${kind} scheduled for ${delay}ms`);
    sendRuntimeMessage({
      type: "GROK_TIMING_EVENT",
      payload: {
        kind,
        delay,
        scheduledAt,
        firedAt: performance.now()
      }
    });
  }
}

const timingInterceptor = new TimingInterceptor();
timingInterceptor.enable();
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

const reportPageVisit = () => {
  const url = window.location.href;
  const path = window.location.pathname + window.location.search;
  const imagineActive = isImaginePage();
  const postPageActive = imagineActive && isImaginePostPage();
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
  console.log("[Grok Imagine] Page visit:", url);
  if (postPageActive) {
    
    scheduleMasonryStylingForPath(path);
  } else {
    removeMasonryStyling();

  }
  sendRuntimeMessage({
    type: "GROK_TIMING_EVENT",
    payload: {
      kind: "page-visit",
      url,
      path,
      timestamp: performance.now(),
      meta: path
    }
  });
};

const hookListeners = () => {
  TARGET_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.__grokHooked) {
        return;
      }
      node.__grokHooked = true;
      node.addEventListener(
        "click",
        (event) => {
          sendRuntimeMessage({
            type: "GROK_TIMING_EVENT",
            payload: {
              kind: "element-click",
              selector,
              timestamp: performance.now(),
              meta: node.innerText?.slice(0, 60)
            }
          });
          console.debug("Intervened click", selector, event);
        },
        true
      );
    });
  });
};

const applyMasonryStyling = () => {
  if (!isImaginePostPage()) {
    return false;
  }
  const doesStyleExist = document.getElementById("grok-imagine-masonry-style");
  if (doesStyleExist) {
    return true;
  }
  const style = document.createElement("style");
  style.id = "grok-imagine-masonry-style";
  style.textContent = `
    ${masonrySelector} {
      border-radius: 1rem !important;
      text-wrap: auto !important;
    }
    ${masonryHiddenSelector} {
      display: none !important;
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);
  return true;
};

const removeMasonryStyling = () => {
  const style = document.getElementById("grok-imagine-masonry-style");
  if (style) {
    style.remove();
  }
  styledPath = null;
};

const scheduleMasonryStylingForPath = (path) => {
  if (!isImaginePostPage() || styledPath === path) {
    return;
  }
  styledPath = path;
  let attempts = 0;
  const attemptApply = () => {
    if (!isImaginePostPage()) {
      return;
    }
    const applied = applyMasonryStyling();
    attempts += 1;
    if (!applied && attempts < 30) {
      window.requestAnimationFrame(attemptApply);
    }
  };
  window.requestAnimationFrame(attemptApply);
};

const grokObserver = new MutationObserver(() => {
  hookListeners();
});

const handleWebSocketNotification = (payload = {}) => {
  if (!payload?.url) {
    return;
  }
  console.debug("[Grok Imagine] WebSocket event:", payload.kind, payload.url);
  if (payload.kind === "websocket-block-enabled") {
    requestPageSocketClose("Grok Imagine Enhancer: declarative block");
  }
};


const startNavigationWatcher = () => {
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

startNavigationWatcher();

document.addEventListener("DOMContentLoaded", () => {
  reportPageVisit();
  hookListeners();
  grokObserver.observe(document.body, observerConfig);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "TRIGGER_CONTENT_SCAN") {
    hookListeners();
  }
  if (message?.type === "WEBSOCKET_EVENT") {
    handleWebSocketNotification(message.payload);
  }
});
