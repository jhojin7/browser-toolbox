(() => {
  const SETTING_KEY = "allowRightClick";

  let isEnabled = true;

  chrome.storage.local.get(SETTING_KEY).then((stored) => {
    if (typeof stored[SETTING_KEY] === "boolean") {
      isEnabled = stored[SETTING_KEY];
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SETTING_KEY]) return;
    isEnabled = changes[SETTING_KEY].newValue !== false;
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
})();
