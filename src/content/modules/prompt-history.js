import {
    PROMPT_STORAGE_KEY,
    PROMPT_HISTORY_OVERLAY_CLASS,
    IMAGINE_PATH_PATTERN,
    TARGET_SELECTORS
} from "./constants.js";
import { isImaginePage } from "./utils.js";

let activePromptTextarea = null;
let promptHistoryOverlay = null;

const readPromptHistory = (callback = () => { }) => {
    if (!chrome?.storage?.local) {
        callback([]);
        return;
    }
    chrome.storage.local.get({ [PROMPT_STORAGE_KEY]: [] }, (data) => {
        const history = Array.isArray(data[PROMPT_STORAGE_KEY]) ? data[PROMPT_STORAGE_KEY] : [];
        callback(history);
    });
};

const updatePromptHistory = (updater, callback = () => { }) => {
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

const deletePromptHistoryAtIndex = (index, callback = () => { }) => {
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
    if (!isImaginePage(IMAGINE_PATH_PATTERN) || !document.body) {
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

export const initPromptHistory = () => {
    ["scroll", "resize"].forEach((eventName) => {
        window.addEventListener(
            eventName,
            () => {
                updateActivePromptOverlayPosition();
            },
            true
        );
    });
};

export const attachImaginePromptLoggers = () => {
    if (!isImaginePage(IMAGINE_PATH_PATTERN)) {
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

export const hookListeners = () => {
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
