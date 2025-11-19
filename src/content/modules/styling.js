import { MASONRY_SELECTOR, IMAGINE_POST_PATTERN } from "./constants.js";
import { isImaginePostPage } from "./utils.js";

let styledPath = null;

export const applyMasonryStyling = () => {
    if (!isImaginePostPage(IMAGINE_POST_PATTERN)) {
        return false;
    }
    const doesStyleExist = document.getElementById("grok-imagine-masonry-style");
    if (doesStyleExist) {
        return true;
    }
    const style = document.createElement("style");
    style.id = "grok-imagine-masonry-style";
    style.textContent = `
    ${MASONRY_SELECTOR} {
      border-radius: 1rem !important;
      text-wrap: auto !important;
    }
  `;
    document.head.appendChild(style);
    return true;
};

export const removeMasonryStyling = () => {
    const style = document.getElementById("grok-imagine-masonry-style");
    if (style) {
        style.remove();
    }
    styledPath = null;
};

export const scheduleMasonryStylingForPath = (path) => {
    if (!isImaginePostPage(IMAGINE_POST_PATTERN) || styledPath === path) {
        return;
    }
    styledPath = path;
    let attempts = 0;
    const attemptApply = () => {
        if (!isImaginePostPage(IMAGINE_POST_PATTERN)) {
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
