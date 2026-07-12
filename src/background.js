import { getProfile } from "./shared/user-agents.js";

const STATE_KEY = "userAgentByTab";
const UA_RULE_ID_OFFSET = 1_000_000_000;
const DEFAULT_SETTINGS = {
  allowRightClick: true,
  responsiveWidthEnabled: true,
  responsiveWidthDomains: ["*.naver.com"]
};
// Keep the default mode deliberately narrow: only the top-level document
// request changes. Page APIs, subresources, and Client Hint headers remain
// Chrome's own values so existing site sessions are not broadly re-fingerprinted.
const RESOURCE_TYPES = ["main_frame"];

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("Could not configure the side panel", error));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS)).then((stored) => {
    const missingSettings = {};

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (stored[key] === undefined) missingSettings[key] = value;
    }

    if (Object.keys(missingSettings).length) {
      return chrome.storage.local.set(missingSettings);
    }
  });

  if (reason === "update") {
    clearAppliedProfiles().catch((error) => {
      console.warn("Could not clear previous user-agent rules", error);
    });
  }
});

function ruleIdForTab(tabId) {
  return UA_RULE_ID_OFFSET + tabId;
}

function ruleIdsForTab(tabId) {
  // Also remove v0.1's tab-id-only rule so an extension reload cannot leave
  // its broad header override active behind the safer implementation.
  return [ruleIdForTab(tabId), tabId];
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
    if (!Number.isInteger(message.tabId)) {
      throw new Error("A valid tab is required");
    }

    switch (message.type) {
      case "GET_UA_STATE": {
        const state = await getState();
        return { profileId: state[message.tabId] ?? null };
      }
      case "APPLY_UA":
        return { profileId: await applyProfile(message.tabId, message.profileId) };
      case "RESET_UA":
        await resetProfile(message.tabId);
        return { profileId: null };
      default:
        throw new Error("Unknown request");
    }
  };

  handleMessage()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
