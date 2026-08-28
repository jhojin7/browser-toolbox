import {
  applyFocusRedirectRules,
  didFocusRedirectSettingsChange
} from "./features/focus-redirect.js";
import {
  clearAppliedUserAgentProfiles,
  handleUserAgentMessage,
  installUserAgentFeature
} from "./features/user-agent.js";
import { FOCUS_REDIRECT_DEFAULTS } from "./shared/focus-redirect.js";
import { RESPONSIVE_WIDTH_DEFAULTS } from "./shared/responsive-width.js";
import { RIGHT_CLICK_DEFAULTS } from "./shared/right-click.js";

const DEFAULT_SETTINGS = {
  ...RIGHT_CLICK_DEFAULTS,
  ...RESPONSIVE_WIDTH_DEFAULTS,
  ...FOCUS_REDIRECT_DEFAULTS
};

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("Could not configure the side panel", error));

installUserAgentFeature();

chrome.runtime.onInstalled.addListener(({ reason }) => {
  initializeSettings(reason).catch((error) => {
    console.warn("Could not initialize settings", error);
  });

  if (reason === "update") {
    clearAppliedUserAgentProfiles().catch((error) => {
      console.warn("Could not clear previous user-agent rules", error);
    });
  }
});

applyFocusRedirectRules().catch((error) => {
  console.warn("Could not apply focus redirect rules", error);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !didFocusRedirectSettingsChange(changes)) return;

  applyFocusRedirectRules().catch((error) => {
    console.warn("Could not update focus redirect rules", error);
  });
});

async function initializeSettings(reason) {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const missingSettings = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[key] === undefined) missingSettings[key] = value;
  }

  // Preserve a user's custom list, but migrate v0.1's untouched default.
  if (
    reason === "update" &&
    Array.isArray(stored.responsiveWidthDomains) &&
    stored.responsiveWidthDomains.length === 1 &&
    stored.responsiveWidthDomains[0] === "*.dcinside.com"
  ) {
    missingSettings.responsiveWidthDomains = DEFAULT_SETTINGS.responsiveWidthDomains;
  }

  if (Object.keys(missingSettings).length) {
    await chrome.storage.local.set(missingSettings);
  }

  await applyFocusRedirectRules();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleMessage = async () => {
    const userAgentResponse = await handleUserAgentMessage(message);
    if (userAgentResponse) return userAgentResponse;

    switch (message.type) {
      case "APPLY_FOCUS_REDIRECT_SETTINGS":
        await applyFocusRedirectRules();
        return {};
      default:
        throw new Error("Unknown request");
    }
  };

  handleMessage()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
