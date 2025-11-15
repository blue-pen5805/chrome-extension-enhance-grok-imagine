/* eslint-disable no-console */
const TARGET_SELECTORS = [
  "button",
  "[data-role='grok-primary']",
  "[data-testid='submit']"
];

const observerConfig = { childList: true, subtree: true };

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
    chrome.runtime.sendMessage({
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
          chrome.runtime.sendMessage({
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

const grokObserver = new MutationObserver(() => hookListeners());

document.addEventListener("DOMContentLoaded", () => {
  hookListeners();
  grokObserver.observe(document.body, observerConfig);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "TRIGGER_CONTENT_SCAN") {
    hookListeners();
  }
});
