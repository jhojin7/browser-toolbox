import {
  applyFocusRedirectRules,
  didFocusRedirectSettingsChange
} from "./features/focus-redirect.js";
import { FOCUS_REDIRECT_DEFAULTS } from "./shared/focus-redirect.js";
import { getProfile } from "./shared/user-agents.js";

const STATE_KEY = "userAgentByTab";
const LEGACY_UA_RULE_ID_OFFSET = 1_000_000_000;
const MAX_DNR_RULE_ID = 2_147_483_647;
const DEFAULT_SETTINGS = {
  allowRightClick: true,
  responsiveWidthEnabled: true,
  responsiveWidthDomains: ["*.naver.com"],
  ...FOCUS_REDIRECT_DEFAULTS
};
// Keep the default mode deliberately narrow: only the top-level document
// request changes. Page APIs, subresources, and Client Hint headers remain
// Chrome's own values so existing site sessions are not broadly re-fingerprinted.
const RESOURCE_TYPES = ["main_frame"];

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("Could not configure the side panel", error));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  initializeSettings(reason).catch((error) => {
    console.warn("Could not initialize settings", error);
  });

  if (reason === "update") {
    clearAppliedProfiles().catch((error) => {
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

function ruleIdForTab(tabId) {
  return tabId;
}

function isValidRuleId(ruleId) {
  return Number.isInteger(ruleId) && ruleId >= 1 && ruleId <= MAX_DNR_RULE_ID;
}

function ruleIdsForTab(tabId) {
  // v0.2 added a large offset to tab IDs. On Chrome sessions with already-high
  // tab IDs, that exceeded DNR's signed integer range and made Apply fail.
  // Use Chrome's positive tab ID directly and only attempt to remove a valid
  // legacy offset rule when one could have existed.
  return [...new Set([
    ruleIdForTab(tabId),
    LEGACY_UA_RULE_ID_OFFSET + tabId
  ].filter(isValidRuleId))];
}

async function getState() {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return stored[STATE_KEY] ?? {};
}

async function setTabState(tabId, profileId) {
  const state = await getState();

  if (profileId) {
    state[tabId] = profileId;
  } else {
    delete state[tabId];
  }

  await chrome.storage.session.set({ [STATE_KEY]: state });
}

async function clearAppliedProfiles() {
  const state = await getState();
  const ruleIds = Object.keys(state)
    .map(Number)
    .filter(Number.isInteger)
    .flatMap(ruleIdsForTab);

  if (ruleIds.length) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [...new Set(ruleIds)]
    });
  }

  await chrome.storage.session.remove(STATE_KEY);
}

function createRequestHeaders(profile) {
  return [
    { header: "user-agent", operation: "set", value: profile.userAgent }
  ];
}

async function applyProfile(tabId, profileId) {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("Unknown user-agent profile");

  const ruleId = ruleIdForTab(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIdsForTab(tabId),
    addRules: [
      {
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: createRequestHeaders(profile)
        },
        condition: {
          tabIds: [tabId],
          urlFilter: "|http",
          resourceTypes: RESOURCE_TYPES
        }
      }
    ]
  });

  await setTabState(tabId, profileId);
  return profileId;
}

async function resetProfile(tabId) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIdsForTab(tabId)
  });
  await setTabState(tabId, null);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  resetProfile(tabId).catch(() => {
    // The session rule can already be gone when Chrome closes a tab.
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleMessage = async () => {
    switch (message.type) {
      case "GET_UA_STATE": {
        if (!Number.isInteger(message.tabId)) {
          throw new Error("A valid tab is required");
        }

        const state = await getState();
        return { profileId: state[message.tabId] ?? null };
      }
      case "APPLY_UA": {
        if (!Number.isInteger(message.tabId)) {
          throw new Error("A valid tab is required");
        }

        return { profileId: await applyProfile(message.tabId, message.profileId) };
      }
      case "RESET_UA": {
        if (!Number.isInteger(message.tabId)) {
          throw new Error("A valid tab is required");
        }

        await resetProfile(message.tabId);
        return { profileId: null };
      }
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
