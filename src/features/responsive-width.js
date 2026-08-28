(() => {
  const ENABLED_KEY = "responsiveWidthEnabled";
  const DOMAINS_KEY = "responsiveWidthDomains";
  const DEFAULT_DOMAINS = ["*.naver.com"];

  let isEnabled = true;
  let domains = DEFAULT_DOMAINS;
  let responsiveStyle = null;
  let measurementQueued = false;

  chrome.storage.local.get([ENABLED_KEY, DOMAINS_KEY]).then((stored) => {
    if (typeof stored[ENABLED_KEY] === "boolean") {
      isEnabled = stored[ENABLED_KEY];
    }

    if (Array.isArray(stored[DOMAINS_KEY])) {
      domains = stored[DOMAINS_KEY];
    }

    update();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[ENABLED_KEY]) {
      isEnabled = changes[ENABLED_KEY].newValue !== false;
    }

    if (changes[DOMAINS_KEY]) {
      domains = Array.isArray(changes[DOMAINS_KEY].newValue)
        ? changes[DOMAINS_KEY].newValue
        : [];
    }

    if (changes[ENABLED_KEY] || changes[DOMAINS_KEY]) {
      update();
    }
  });

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

  function update() {
    const shouldApply = isEnabled && matchesCurrentDomain(domains);

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

    scheduleMeasurement();
  }

  function scheduleMeasurement() {
    if (measurementQueued) return;
    measurementQueued = true;

    requestAnimationFrame(() => {
      measurementQueued = false;
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

  document.addEventListener("DOMContentLoaded", scheduleMeasurement, { once: true });
  window.addEventListener("load", scheduleMeasurement, { once: true });
  window.addEventListener("resize", scheduleMeasurement);
})();
