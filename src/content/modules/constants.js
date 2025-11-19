export const TARGET_SELECTORS = [
  "button",
  "[data-role='grok-primary']",
  "[data-testid='submit']"
];

export const OBSERVER_CONFIG = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "src"]
};
export const IMAGINE_PATH_PATTERN = /^\/imagine(?:\/post\/[\w-]+)?/i;
export const IMAGINE_POST_PATTERN = /^\/imagine\/post\//i;
export const NAVIGATION_EVENT = "grok-imagine-url-change";
export const PROMPT_STORAGE_KEY = "imaginePromptHistory";
export const PROMPT_HISTORY_OVERLAY_CLASS = "grok-prompt-history-overlay";
export const MASONRY_SELECTOR = "[id^='imagine-masonry-section-'] > *:first-child";
export const DOWNLOAD_BUTTON_CLASS = "grok-imagine-download-button";
export const DOWNLOAD_CONTAINER_CLASS = "grok-imagine-download-container";
export const DEFAULT_DOWNLOAD_EXTENSION = "jpg";
export const DOWNLOAD_BUTTON_STYLE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-100 [&_svg]:shrink-0 select-none rounded-full overflow-hidden h-10 w-10 p-2 bg-black/25 hover:bg-white/10 border border-white/15 border-opacity-10";

export const MESSAGE_SOURCE = {
  CONTENT_SCRIPT: "grok-content-script",
  WEBSOCKET_HOOK: "grok-websocket-hook",
};

export const MESSAGE_TYPE = {
  INJECT_WS_BRIDGE: "INJECT_WS_BRIDGE",
  GROK_WS_FORCE_CLOSE: "GROK_WS_FORCE_CLOSE",
  GROK_WS_OPEN: "GROK_WS_OPEN",
  GROK_WS_SEND: "GROK_WS_SEND",
  GROK_WS_ERROR: "GROK_WS_ERROR",
  GROK_WS_CLOSED: "GROK_WS_CLOSED",
  WEBSOCKET_BLOCK_ENABLED: "websocket-block-enabled",
  IMAGINE_POST_STATE: "IMAGINE_POST_STATE",
  WEBSOCKET_EVENT: "WEBSOCKET_EVENT",
};

export const LOG_PREFIX = "[Grok Imagine]";
