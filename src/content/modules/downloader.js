import {
    DEFAULT_DOWNLOAD_EXTENSION,
    DOWNLOAD_BUTTON_CLASS,
    DOWNLOAD_CONTAINER_CLASS,
    DOWNLOAD_BUTTON_STYLE,
    IMAGINE_PATH_PATTERN
} from "./constants.js";
import { isImaginePage } from "./utils.js";

const listItemImageState = new WeakMap();

let currentSettings = {
    feature_download_button: true,
    feature_show_blocked_border: true
};

export const updateDownloaderSettings = (settings) => {
    currentSettings = { ...currentSettings, ...settings };
};

const findLatestDataImage = (root) => root?.querySelector("img[src^='data:image/']");

const resolveDownloadExtension = (source) => {
    if (typeof source !== "string") {
        return DEFAULT_DOWNLOAD_EXTENSION;
    }
    const dataMatch = source.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (dataMatch) {
        const mime = dataMatch[1];
        const [, subtype = ""] = mime.split("/");
        const normalizedSubtype = subtype.toLowerCase().replace(/[^a-z0-9.+-]/g, "");
        return normalizedSubtype || DEFAULT_DOWNLOAD_EXTENSION;
    }
    const pathWithoutQuery = source.split("?")[0] ?? "";
    const extensionMatch = pathWithoutQuery.match(/\.([a-z0-9]+)$/i);
    if (extensionMatch) {
        return extensionMatch[1].toLowerCase();
    }
    return DEFAULT_DOWNLOAD_EXTENSION;
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
    const existing = card?.querySelector(`.${DOWNLOAD_CONTAINER_CLASS}`);
    if (existing) {
        existing.remove();
    }
};

const attachDownloadButtonToItem = (item, card) => {
    if (!card || card.querySelector(`.${DOWNLOAD_BUTTON_CLASS}`)) {
        return;
    }
    const container = document.createElement("div");
    container.className = `absolute bottom-2 left-2 flex flex-row gap-2 ${DOWNLOAD_CONTAINER_CLASS}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${DOWNLOAD_BUTTON_STYLE} ${DOWNLOAD_BUTTON_CLASS}`;
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

export const highlightInvisibleContainers = () => {
    if (!isImaginePage(IMAGINE_PATH_PATTERN)) {
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
            } else if (currentSettings.feature_download_button) {
                attachDownloadButtonToItem(item, firstChild);
            } else {
                removeDownloadButtonFromItem(firstChild);
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
            if (now - state.lastChange >= 2000 && hasInvisibleChild && currentSettings.feature_show_blocked_border) {
                firstChild.style.border = "2px solid red";
                firstChild.style.margin = "-2px";
            } else {
                firstChild.style.border = "";
                firstChild.style.margin = "";
            }
        });
    });
};
