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
let loggerContainer = null;
let lastReportedPath = null;
let navigationWatcherStarted = false;
let styledPath = null;

const isImaginePage = () => imaginePathPattern.test(window.location.pathname);
const isImaginePostPage = () => imaginePostPattern.test(window.location.pathname);
const masonrySelector = "[id^='imagine-masonry-section-'] > *:first-child";

const ensureLogger = () => {
  if (loggerContainer || !isImaginePage()) {
    return loggerContainer;
  }
  loggerContainer = document.createElement("div");
  loggerContainer.id = "grok-imagine-log";
  loggerContainer.dataset.collapsed = "true";
  Object.assign(loggerContainer.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    width: "320px",
    maxHeight: "180px",
    overflowY: "auto",
    background: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontSize: "12px",
    lineHeight: "1.4",
    padding: "12px",
    borderRadius: "8px",
    zIndex: "2147483647",
    boxShadow: "0 6px 12px rgba(0, 0, 0, 0.4)",
    cursor: "pointer",
    transition: "opacity 0.2s ease"
  });
  const heading = document.createElement("div");
  heading.textContent = "Grok Imagine Logger";
  heading.style.fontWeight = "bold";
  heading.style.marginBottom = "8px";
  heading.style.userSelect = "none";
  loggerContainer.appendChild(heading);
  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.padding = "0";
  list.style.margin = "0";
  loggerContainer.appendChild(list);

  loggerContainer.addEventListener("click", (event) => {
    if (!loggerContainer) {
      return;
    }
    event.stopPropagation();
    const collapsed = loggerContainer.dataset.collapsed === "true";
    if (collapsed) {
      expandLogger();
    } else {
      collapseLogger();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && loggerContainer) {
      loggerContainer.remove();
      loggerContainer = null;
    }
  });
  document.body.appendChild(loggerContainer);
  collapseLogger();
  return loggerContainer;
};

const collapseLogger = () => {
  if (!loggerContainer) {
    return;
  }
  loggerContainer.dataset.collapsed = "true";
  loggerContainer.style.maxHeight = "32px";
  loggerContainer.style.overflow = "hidden";
  loggerContainer.style.opacity = "0.6";
};

const expandLogger = () => {
  if (!loggerContainer) {
    return;
  }
  loggerContainer.dataset.collapsed = "false";
  loggerContainer.style.maxHeight = "180px";
  loggerContainer.style.overflowY = "auto";
  loggerContainer.style.opacity = "1";
};

const canSendRuntimeMessage = () => Boolean(chrome?.runtime?.id);

const sendRuntimeMessage = (message) => {
  if (!canSendRuntimeMessage()) {
    return;
  }
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    console.warn("Failed to send runtime message", error);
  }
};

const appendLogEntry = (message) => {
  if (!ensureLogger()) {
    return;
  }
  const list = loggerContainer.querySelector("ul");
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  list.prepend(li);
  while (list.childNodes.length > 6) {
    list.lastChild.remove();
  }
};

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
    appendLogEntry(`${kind} scheduled for ${delay}ms`);
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

const reportPageVisit = () => {
  const url = window.location.href;
  const path = window.location.pathname + window.location.search;
  if (!isImaginePage()) {
    return;
  }
  if (path === lastReportedPath) {
    return;
  }
  lastReportedPath = path;
  appendLogEntry(`Visited ${path}`);
  console.log("[Grok Imagine] Page visit:", url);
  scheduleMasonryStylingForPath(path);
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
          appendLogEntry(`Clicked ${selector}`);
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
  `;
  document.head.appendChild(style);
  return true;
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
  appendLogEntry(`WebSocket ${payload.kind?.replace("websocket-", "") ?? "open"}: ${payload.url}`);
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
