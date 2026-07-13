let isEnabled = true;
let responsiveWidthEnabled = true;
let responsiveWidthDomains = ["*.naver.com"];
let responsiveStyle = null;
let responsiveMeasurementQueued = false;

chrome.storage.local.get([
  "allowRightClick",
  "responsiveWidthEnabled",
  "responsiveWidthDomains"
]).then((stored) => {
  if (typeof stored.allowRightClick === "boolean") {
    isEnabled = stored.allowRightClick;
  }

  if (typeof stored.responsiveWidthEnabled === "boolean") {
    responsiveWidthEnabled = stored.responsiveWidthEnabled;
  }

  if (Array.isArray(stored.responsiveWidthDomains)) {
    responsiveWidthDomains = stored.responsiveWidthDomains;
  }

  updateResponsiveWidth();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.allowRightClick) isEnabled = changes.allowRightClick.newValue;
  if (changes.responsiveWidthEnabled) {
    responsiveWidthEnabled = changes.responsiveWidthEnabled.newValue !== false;
  }
  if (changes.responsiveWidthDomains) {
    responsiveWidthDomains = Array.isArray(changes.responsiveWidthDomains.newValue)
      ? changes.responsiveWidthDomains.newValue
      : [];
  }

  updateResponsiveWidth();
});

window.addEventListener(
  "contextmenu",
  (event) => {
    if (!isEnabled) return;

    // This capture listener runs before site handlers and leaves the browser's
    // native context menu intact by deliberately not calling preventDefault().
    event.stopImmediatePropagation();
  },
  true
);

function matchesCurrentDomain(patterns) {
  const host = location.hostname.toLowerCase();

  return patterns.some((pattern) => {
    const normalized = String(pattern)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    if (!normalized) return false;

    const expression = normalized
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replaceAll("*", ".*");

    return new RegExp(`^${expression}$`).test(host);
  });
}

function updateResponsiveWidth() {
  const shouldApply = responsiveWidthEnabled && matchesCurrentDomain(responsiveWidthDomains);

  if (!shouldApply) {
    responsiveStyle?.remove();
    responsiveStyle = null;
    document.documentElement.style.removeProperty("--browser-toolbox-page-scale");
    return;
  }

  if (!responsiveStyle) {
    responsiveStyle = document.createElement("style");
    responsiveStyle.id = "browser-toolbox-responsive-width";
    (document.head || document.documentElement).append(responsiveStyle);
  }

  responsiveStyle.textContent = `
    html { overflow-x: clip !important; }
    body { zoom: var(--browser-toolbox-page-scale, 1) !important; }
  `;

  scheduleResponsiveMeasurement();
}

function scheduleResponsiveMeasurement() {
  if (responsiveMeasurementQueued) return;
  responsiveMeasurementQueued = true;

  requestAnimationFrame(() => {
    responsiveMeasurementQueued = false;
    measureAndFitPageWidth();
  });
}

function measureAndFitPageWidth() {
  if (!responsiveStyle || !document.body) return;

  const root = document.documentElement;
  // Measure at 100% before calculating the scale. Reading scrollWidth forces
  // layout, so this also works after the page changes its own fixed-width CSS.
  root.style.setProperty("--browser-toolbox-page-scale", "1");
  const naturalWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
  const scale = Math.min(1, window.innerWidth / naturalWidth);

  root.style.setProperty("--browser-toolbox-page-scale", String(scale));
}

document.addEventListener("DOMContentLoaded", scheduleResponsiveMeasurement, { once: true });
window.addEventListener("load", scheduleResponsiveMeasurement, { once: true });
window.addEventListener("resize", scheduleResponsiveMeasurement);
