import { getProfile } from "../shared/user-agents.js";

const STATE_KEY = "userAgentByTab";
const LEGACY_UA_RULE_ID_OFFSET = 1_000_000_000;
const MAX_DNR_RULE_ID = 2_147_483_647;

// Keep the default mode deliberately narrow: only the top-level document
// request changes. Page APIs, subresources, and Client Hint headers remain
// Chrome's own values so existing site sessions are not broadly re-fingerprinted.
const RESOURCE_TYPES = ["main_frame"];

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

function requireTabId(tabId) {
  if (!Number.isInteger(tabId)) {
    throw new Error("A valid tab is required");
  }
}

export async function clearAppliedUserAgentProfiles() {
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

export function installUserAgentFeature() {
  chrome.tabs.onRemoved.addListener((tabId) => {
    resetProfile(tabId).catch(() => {
      // The session rule can already be gone when Chrome closes a tab.
    });
  });
}

export async function handleUserAgentMessage(message) {
  switch (message.type) {
    case "GET_UA_STATE": {
      requireTabId(message.tabId);
      const state = await getState();
      return { profileId: state[message.tabId] ?? null };
    }
    case "APPLY_UA": {
      requireTabId(message.tabId);
      return { profileId: await applyProfile(message.tabId, message.profileId) };
    }
    case "RESET_UA": {
      requireTabId(message.tabId);
      await resetProfile(message.tabId);
      return { profileId: null };
    }
    default:
      return null;
  }
}
