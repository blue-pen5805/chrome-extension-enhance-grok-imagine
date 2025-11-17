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
const PROMPT_STORAGE_KEY = "imaginePromptHistory";
const PROMPT_HISTORY_OVERLAY_CLASS = "grok-prompt-history-overlay";
let lastReportedPath = null;
let navigationWatcherStarted = false;
let styledPath = null;
let lastReportedPostState = null;
let activePromptTextarea = null;
let promptHistoryOverlay = null;

const isImaginePage = () => imaginePathPattern.test(window.location.pathname);
const isImaginePostPage = () => imaginePostPattern.test(window.location.pathname);
const masonrySelector = "[id^='imagine-masonry-section-'] > *:first-child";
const canSendRuntimeMessage = () => Boolean(chrome?.runtime?.id);
const downloadButtonClass = "grok-imagine-download-button";
const downloadContainerClass = "grok-imagine-download-container";
const defaultDownloadExtension = "jpg";
const downloadButtonStyle =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-100 [&_svg]:shrink-0 select-none rounded-full overflow-hidden h-10 w-10 p-2 bg-black/25 hover:bg-white/10 border border-white/15 border-opacity-10";

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

const requestPageSocketClose = (reason = "Enhance Grok Imagine: post page restriction") => {
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
  if (postPageActive) {

    scheduleMasonryStylingForPath(path);
  } else {
    removeMasonryStyling();

  }

};

const readPromptHistory = (callback = () => {}) => {
  if (!chrome?.storage?.local) {
    callback([]);
    return;
  }
  chrome.storage.local.get({ [PROMPT_STORAGE_KEY]: [] }, (data) => {
    const history = Array.isArray(data[PROMPT_STORAGE_KEY]) ? data[PROMPT_STORAGE_KEY] : [];
    callback(history);
  });
};

const updatePromptHistory = (updater, callback = () => {}) => {
  if (!chrome?.storage?.local) {
    callback([]);
    return;
  }
  readPromptHistory((history) => {
    const nextHistory = updater(history.slice());
    chrome.storage.local.set({ [PROMPT_STORAGE_KEY]: nextHistory }, () => {
      callback(nextHistory);
    });
  });
};

const appendPromptHistory = (value) => {
  if (typeof value !== "string") {
    return;
  }
  const normalizedValue = value;
  const timestamp = Date.now();
  updatePromptHistory((history) => {
    const alreadyExists = history.some((item) => item?.value === normalizedValue);
    if (alreadyExists) {
      return history;
    }
    const entry = {
      id: `${timestamp}-${Math.random().toString(16).slice(2)}`,
      value: normalizedValue,
      timestamp
    };
    history.push(entry);
    return history;
  });
};

const deletePromptHistoryAtIndex = (index, callback = () => {}) => {
  updatePromptHistory(
    (history) => history.filter((_, entryIndex) => entryIndex !== index),
    callback
  );
};

const logPromptValue = (textarea, trigger) => {
  if (!textarea) {
    return;
  }
  const value = textarea.value ?? "";
  appendPromptHistory(value);
};

const positionPromptHistoryOverlay = (overlay, textarea) => {
  const rect = textarea.getBoundingClientRect();
  const overlayHeight = overlay.offsetHeight || 0;
  const targetTop = window.scrollY + rect.top - overlayHeight - 8;
  overlay.style.top = `${Math.max(window.scrollY, targetTop)}px`;
  overlay.style.left = `${window.scrollX + rect.left}px`;
  overlay.style.minWidth = `${rect.width}px`;
  overlay.style.maxWidth = `${Math.max(rect.width, 320)}px`;
};

const ensurePromptTextareaResizeObserver = (textarea) => {
  if (textarea.__grokPromptResizeObserver || typeof ResizeObserver === "undefined") {
    return;
  }
  const observer = new ResizeObserver(() => {
    const overlay = textarea.__grokPromptOverlay;
    if (
      !overlay ||
      overlay.style.display === "none" ||
      activePromptTextarea !== textarea
    ) {
      return;
    }
    positionPromptHistoryOverlay(overlay, textarea);
  });
  observer.observe(textarea);
  textarea.__grokPromptResizeObserver = observer;
};

const ensurePromptHistoryOverlay = (textarea) => {
  if (!document.body) {
    return null;
  }
  if (promptHistoryOverlay && document.body.contains(promptHistoryOverlay)) {
    textarea.__grokPromptOverlay = promptHistoryOverlay;
    ensurePromptTextareaResizeObserver(textarea);
    return promptHistoryOverlay;
  }
  document.querySelectorAll(`.${PROMPT_HISTORY_OVERLAY_CLASS}`).forEach((node) => {
    if (node !== promptHistoryOverlay) {
      node.remove();
    }
  });
  const overlay = document.createElement("div");
  overlay.className = PROMPT_HISTORY_OVERLAY_CLASS;
  overlay.style.position = "absolute";
  overlay.style.zIndex = "2147483647";
  overlay.style.background = "rgba(18, 18, 18, 0.95)";
  overlay.style.color = "#fff";
  overlay.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  overlay.style.borderRadius = "8px";
  overlay.style.padding = "8px";
  overlay.style.fontSize = "12px";
  overlay.style.lineHeight = "1.4";
  overlay.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.35)";
  overlay.style.display = "none";
  overlay.style.maxHeight = "200px";
  overlay.style.overflowY = "auto";
  overlay.style.backgroundClip = "padding-box";
  overlay.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  document.body.appendChild(overlay);
  promptHistoryOverlay = overlay;
  textarea.__grokPromptOverlay = overlay;
  ensurePromptTextareaResizeObserver(textarea);
  return overlay;
};

const scrollPromptHistoryOverlayToBottom = (overlay) => {
  if (!overlay) {
    return;
  }
  overlay.scrollTop = overlay.scrollHeight;
  window.requestAnimationFrame(() => {
    overlay.scrollTop = overlay.scrollHeight;
  });
};

const applyPromptHistoryEntryToTextarea = (textarea, value) => {
  if (!textarea) {
    return;
  }
  textarea.value = value;
  const inputEvent = new Event("input", { bubbles: true });
  textarea.dispatchEvent(inputEvent);
  textarea.focus({ preventScroll: true });
};

const renderPromptHistoryOverlay = (overlay, history, textarea) => {
  overlay.innerHTML = "";
  const orderedEntries = history.map((entry, index) => ({ entry, index }));
  if (!orderedEntries.length) {
    const empty = document.createElement("div");
    empty.textContent = "過去のプロンプトはありません";
    empty.style.opacity = "0.7";
    overlay.appendChild(empty);
    return;
  }
  orderedEntries.forEach(({ entry, index }) => {
    const item = document.createElement("div");
    item.style.padding = "4px 0";
    item.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
    item.style.display = "flex";
    item.style.alignItems = "flex-start";
    item.style.gap = "8px";
    item.style.cursor = "pointer";

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "×";
    deleteButton.style.background = "transparent";
    deleteButton.style.border = "none";
    deleteButton.style.color = "rgba(255, 255, 255, 0.85)";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.fontSize = "14px";
    deleteButton.style.lineHeight = "1";
    deleteButton.style.marginTop = "2px";
    deleteButton.title = "この履歴を削除";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deletePromptHistoryAtIndex(index, () => {
        if (activePromptTextarea) {
          showPromptHistoryOverlay(activePromptTextarea);
        }
      });
    });

    const text = document.createElement("div");
    text.textContent = entry?.value ?? "";
    text.style.flex = "1";
    text.style.whiteSpace = "pre-wrap";

    item.addEventListener("click", () => {
      applyPromptHistoryEntryToTextarea(textarea, entry?.value ?? "");
    });

    item.appendChild(deleteButton);
    item.appendChild(text);
    overlay.appendChild(item);
  });
  if (overlay.lastElementChild) {
    overlay.lastElementChild.style.borderBottom = "none";
  }
  scrollPromptHistoryOverlayToBottom(overlay);
};

const showPromptHistoryOverlay = (textarea) => {
  if (!isImaginePage() || !document.body) {
    return;
  }
  const overlay = ensurePromptHistoryOverlay(textarea);
  readPromptHistory((history) => {
    renderPromptHistoryOverlay(overlay, history, textarea);
    overlay.style.display = "block";
    scrollPromptHistoryOverlayToBottom(overlay);
    positionPromptHistoryOverlay(overlay, textarea);
    activePromptTextarea = textarea;
  });
};

const hidePromptHistoryOverlay = (textarea) => {
  const overlay = textarea?.__grokPromptOverlay;
  if (!overlay) {
    return;
  }
  overlay.style.display = "none";
  if (activePromptTextarea === textarea) {
    activePromptTextarea = null;
  }
};

const updateActivePromptOverlayPosition = () => {
  if (!activePromptTextarea) {
    return;
  }
  const overlay = activePromptTextarea.__grokPromptOverlay;
  if (!overlay || overlay.style.display === "none") {
    return;
  }
  positionPromptHistoryOverlay(overlay, activePromptTextarea);
};

["scroll", "resize"].forEach((eventName) => {
  window.addEventListener(
    eventName,
    () => {
      updateActivePromptOverlayPosition();
    },
    true
  );
});

const attachImaginePromptLoggers = () => {
  if (!isImaginePage()) {
    return;
  }

  document.querySelectorAll("form textarea").forEach((textarea) => {
    if (textarea.__grokPromptTextareaLogger) {
      return;
    }
    textarea.__grokPromptTextareaLogger = true;
    textarea.addEventListener("focus", () => {
      showPromptHistoryOverlay(textarea);
    });
    textarea.addEventListener("blur", () => {
      hidePromptHistoryOverlay(textarea);
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      logPromptValue(event.currentTarget, "テキストエリアEnter");
    });
  });

  document.querySelectorAll("form button[type='submit']").forEach((button) => {
    if (button.__grokPromptButtonLogger) {
      return;
    }
    button.__grokPromptButtonLogger = true;
    button.addEventListener("click", () => {
      const textarea = button.closest("form")?.querySelector("textarea");
      if (!textarea) {
        return;
      }
      logPromptValue(textarea, "送信ボタンクリック");
    });
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
          console.debug("Intervened click", selector, event);
        },
        true
      );
    });
  });
  attachImaginePromptLoggers();
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

const listItemImageState = new WeakMap();

const findLatestDataImage = (root) => root?.querySelector("img[src^='data:image/']");

const resolveDownloadExtension = (source) => {
  if (typeof source !== "string") {
    return defaultDownloadExtension;
  }
  const dataMatch = source.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  if (dataMatch) {
    const mime = dataMatch[1];
    const [, subtype = ""] = mime.split("/");
    const normalizedSubtype = subtype.toLowerCase().replace(/[^a-z0-9.+-]/g, "");
    return normalizedSubtype || defaultDownloadExtension;
  }
  const pathWithoutQuery = source.split("?")[0] ?? "";
  const extensionMatch = pathWithoutQuery.match(/\.([a-z0-9]+)$/i);
  if (extensionMatch) {
    return extensionMatch[1].toLowerCase();
  }
  return defaultDownloadExtension;
};

const findPromptTextForImage = (img) => {
  if (!img) {
    return "";
  }
  const section = img.closest("[id^='imagine-masonry-section-']");
  if (!section) {
    return "";
  }
  const firstDivChild = Array.from(section.children).find((child) => child.tagName === "DIV");
  return firstDivChild?.textContent?.trim() ?? "";
};

const dataUrlToUint8Array = (dataUrl) => {
  if (typeof dataUrl !== "string") {
    return null;
  }
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return null;
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  try {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  } catch (error) {
    console.warn("Failed to decode base64 image", error);
    return null;
  }
};

const createExifImageDescriptionSegment = (description) => {
  if (!description) {
    return null;
  }
  const encoder = new TextEncoder();
  const descriptionBytes = encoder.encode(description);
  const descriptionLength = descriptionBytes.length + 1;
  const tiffHeaderSize = 8;
  const ifd0EntryCount = 1;
  const ifd0Size = 2 + ifd0EntryCount * 12 + 4;
  const descriptionDataOffset = tiffHeaderSize + ifd0Size;
  const totalTiffSize = descriptionDataOffset + descriptionLength;
  const buffer = new ArrayBuffer(totalTiffSize);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint8(offset, 0x4d);
  view.setUint8(offset + 1, 0x4d);
  view.setUint16(offset + 2, 0x2a, false);
  view.setUint32(offset + 4, 8, false);
  offset = tiffHeaderSize;

  view.setUint16(offset, 1, false);
  offset += 2;
  view.setUint16(offset, 0x010e, false);
  view.setUint16(offset + 2, 2, false);
  view.setUint32(offset + 4, descriptionLength, false);
  view.setUint32(offset + 8, descriptionDataOffset, false);
  offset += 12;
  view.setUint32(offset, 0, false);

  const descriptionBuffer = new Uint8Array(buffer, descriptionDataOffset, descriptionLength);
  descriptionBuffer.set(descriptionBytes, 0);
  descriptionBuffer[descriptionLength - 1] = 0x00;

  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const tiffBytes = new Uint8Array(buffer);
  const payload = new Uint8Array(exifHeader.length + tiffBytes.length);
  payload.set(exifHeader, 0);
  payload.set(tiffBytes, exifHeader.length);
  const segmentLength = payload.length + 2;
  const segment = new Uint8Array(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(payload, 4);
  return segment;
};

const injectExifImageDescriptionIntoJpeg = (bytes, description) => {
  if (!bytes || bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  const segment = createExifImageDescriptionSegment(description);
  if (!segment) {
    return null;
  }
  const insertionIndex = 2;
  const output = new Uint8Array(bytes.length + segment.length);
  output.set(bytes.slice(0, insertionIndex), 0);
  output.set(segment, insertionIndex);
  output.set(bytes.slice(insertionIndex), insertionIndex + segment.length);
  return output;
};

const createJpegBlobWithPrompt = (dataUrl, prompt) => {
  const trimmedPrompt = prompt?.trim();
  if (!trimmedPrompt) {
    return null;
  }
  const bytes = dataUrlToUint8Array(dataUrl);
  if (!bytes) {
    return null;
  }
  const updatedBytes = injectExifImageDescriptionIntoJpeg(bytes, trimmedPrompt);
  if (!updatedBytes) {
    return null;
  }
  return new Blob([updatedBytes], { type: "image/jpeg" });
};

const createDownloadIcon = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.classList.add("lucide", "lucide-arrow-down-to-line", "size-4", "text-white");

  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M12 5v10m0 0-4-4m4 4 4-4");
  const baseLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  baseLine.setAttribute("d", "M5 19h14");

  svg.appendChild(arrowPath);
  svg.appendChild(baseLine);

  return svg;
};

const triggerImageDownload = (img) => {
  const downloadSource = img?.currentSrc || img?.src;
  if (!downloadSource) {
    return;
  }
  const promptText = findPromptTextForImage(img);
  const extension = resolveDownloadExtension(downloadSource);
  const link = document.createElement("a");
  let objectUrl = null;
  let finalHref = downloadSource;
  const isJpegDataUrl = /^data:image\/jpeg;base64,/i.test(downloadSource);
  if (isJpegDataUrl) {
    const blob = createJpegBlobWithPrompt(downloadSource, promptText);
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      finalHref = objectUrl;
    }
  }
  link.href = finalHref;
  link.download = `grok-imagine-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (objectUrl) {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }
};

const removeDownloadButtonFromItem = (card) => {
  const existing = card?.querySelector(`.${downloadContainerClass}`);
  if (existing) {
    existing.remove();
  }
};

const attachDownloadButtonToItem = (item, card) => {
  if (!card || card.querySelector(`.${downloadButtonClass}`)) {
    return;
  }
  const container = document.createElement("div");
  container.className = `absolute bottom-2 left-2 flex flex-row gap-2 ${downloadContainerClass}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${downloadButtonStyle} ${downloadButtonClass}`;
  button.setAttribute("aria-label", "Download image");
  button.appendChild(createDownloadIcon());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const latestImg = findLatestDataImage(item);
    if (latestImg) {
      triggerImageDownload(latestImg);
    }
  });
  container.appendChild(button);
  card.appendChild(container);
};

const highlightInvisibleContainers = () => {
  if (!isImaginePage()) {
    return;
  }
  const now = performance.now();
  document.querySelectorAll("[id^='imagine-masonry-section-'] > div[role='list']").forEach((container) => {
    container.querySelectorAll(":scope > div[role='listitem']").forEach((item) => {
      const firstChild = item.firstElementChild ?? item.firstChild;
      if (!firstChild || !(firstChild instanceof HTMLElement)) {
        listItemImageState.delete(item);
        return;
      }
      firstChild.style.borderRadius = "1rem";
      const hasInvisibleChild = Boolean(item.querySelector("div.invisible"));
      const img = findLatestDataImage(item);
      if (!img?.src) {
        removeDownloadButtonFromItem(firstChild);
        listItemImageState.delete(item);
        firstChild.style.border = "";
        return;
      }
      if (hasInvisibleChild) {
        removeDownloadButtonFromItem(firstChild);
      } else {
        attachDownloadButtonToItem(item, firstChild);
      }
      const state = listItemImageState.get(item) ?? { lastSrc: null, lastChange: now };
      if (img.src !== state.lastSrc) {
        state.lastSrc = img.src;
        state.lastChange = now;
        listItemImageState.set(item, state);
        firstChild.style.border = "";
        return;
      }
      listItemImageState.set(item, state);
      if (now - state.lastChange >= 2000 && hasInvisibleChild) {
        firstChild.style.border = "2px solid red";
        firstChild.style.margin = "-2px";
      } else {
        firstChild.style.border = "";
        firstChild.style.margin = "";
      }
    });
  });
};

window.setInterval(() => {
  highlightInvisibleContainers();
}, 100);

const handleWebSocketNotification = (payload = {}) => {
  if (!payload?.url) {
    return;
  }
  console.debug("[Grok Imagine] WebSocket event:", payload.kind, payload.url);
  if (payload.kind === "websocket-block-enabled") {
    requestPageSocketClose("Enhance Grok Imagine: declarative block");
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
  let lastIntervalUrl = window.location.href;
  window.setInterval(() => {
    if (!canSendRuntimeMessage()) {
      return;
    }
    if (window.location.href !== lastIntervalUrl) {
      lastIntervalUrl = window.location.href;
      reportPageVisit();
    }
  }, 100);
};

startNavigationWatcher();

const initializeDomObservers = () => {
  reportPageVisit();
  hookListeners();
  if (document.body) {
    grokObserver.observe(document.body, observerConfig);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDomObservers);
} else {
  initializeDomObservers();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "WEBSOCKET_EVENT") {
    handleWebSocketNotification(message.payload);
  }
});
