import {
  DEFAULT_FOCUS_REDIRECT_DOMAINS,
  FOCUS_REDIRECT_DOMAINS_KEY,
  FOCUS_REDIRECT_ENABLED_KEY,
  normalizeRedirectDomains
} from "../shared/focus-redirect.js";
import {
  DEFAULT_PROFILE_ID,
  USER_AGENT_PROFILES,
  getProfile
} from "../shared/user-agents.js";

const elements = {
  profileSelect: document.querySelector("#profile-select"),
  profileDescription: document.querySelector("#profile-description"),
  uaString: document.querySelector("#ua-string"),
  applyButton: document.querySelector("#apply-button"),
  resetButton: document.querySelector("#reset-button"),
  statusPill: document.querySelector("#status-pill"),
  feedback: document.querySelector("#feedback"),
  siteName: document.querySelector("#site-name"),
  rightClickToggle: document.querySelector("#right-click-toggle"),
  responsiveWidthToggle: document.querySelector("#responsive-width-toggle"),
  responsiveDomains: document.querySelector("#responsive-domains"),
  saveResponsiveDomains: document.querySelector("#save-responsive-domains"),
  responsiveFeedback: document.querySelector("#responsive-feedback"),
  focusRedirectToggle: document.querySelector("#focus-redirect-toggle"),
  focusRedirectDomains: document.querySelector("#focus-redirect-domains"),
  saveFocusRedirectDomains: document.querySelector("#save-focus-redirect-domains"),
  focusRedirectFeedback: document.querySelector("#focus-redirect-feedback"),
  extensionsPageButton: document.querySelector("#extensions-page-button")
};

let activeTab = null;
let appliedProfileId = null;
let refreshVersion = 0;

function populateProfiles() {
  const groups = new Map();

  for (const profile of USER_AGENT_PROFILES) {
    if (!groups.has(profile.group)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = profile.group;
      groups.set(profile.group, optgroup);
      elements.profileSelect.append(optgroup);
    }

    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.label;
    groups.get(profile.group).append(option);
  }

  elements.profileSelect.value = DEFAULT_PROFILE_ID;
}

function renderSelectedProfile() {
  const profile = getProfile(elements.profileSelect.value);
  elements.profileDescription.textContent = profile.description;
  elements.uaString.textContent = profile.userAgent;
}

function renderStatus() {
  const active = Boolean(appliedProfileId);
  elements.statusPill.dataset.active = String(active);
  elements.statusPill.textContent = active ? "Active" : "Default";
  elements.resetButton.disabled = !active || !activeTab;
}

function showFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.dataset.error = String(isError);
}

function setBusy(busy) {
  elements.applyButton.disabled = busy || !activeTab;
  elements.resetButton.disabled = busy || !appliedProfileId || !activeTab;
  elements.profileSelect.disabled = busy;
}

function renderTab(tab) {
  if (!tab) {
    elements.siteName.textContent = "This page is unavailable";
    return;
  }

  try {
    const url = new URL(tab.url);
    elements.siteName.textContent = url.hostname || url.protocol.replace(":", "");
  } catch {
    elements.siteName.textContent = tab.title || "Current tab";
  }

}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Something went wrong");
  return response;
}

function isSupportedTab(tab) {
  return Number.isInteger(tab?.id) && /^https?:/.test(tab.url ?? "");
}

async function renderTabState(tab, version) {
  if (version !== refreshVersion) return;

  renderTab(tab);
  activeTab = isSupportedTab(tab) ? tab : null;
  appliedProfileId = null;
  renderStatus();
  setBusy(false);

  if (!activeTab) {
    showFeedback("Open a web page to use this tool.", true);
    return;
  }

  showFeedback("");
  const response = await sendMessage({ type: "GET_UA_STATE", tabId: tab.id });
  if (version !== refreshVersion) return;

  appliedProfileId = response.profileId;

  if (appliedProfileId) {
    elements.profileSelect.value = appliedProfileId;
    renderSelectedProfile();
  }

  renderStatus();
}

async function refreshCurrentTab() {
  const version = ++refreshVersion;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await renderTabState(tab, version);
  } catch (error) {
    if (version === refreshVersion) throw error;
  }
}

async function refreshTabById(tabId) {
  const version = ++refreshVersion;
  try {
    const tab = await chrome.tabs.get(tabId);
    await renderTabState(tab, version);
  } catch (error) {
    if (version === refreshVersion) throw error;
  }
}

async function loadRightClickSetting() {
  const stored = await chrome.storage.local.get("allowRightClick");
  elements.rightClickToggle.checked = stored.allowRightClick !== false;
}

async function loadResponsiveWidthSetting() {
  const stored = await chrome.storage.local.get([
    "responsiveWidthEnabled",
    "responsiveWidthDomains"
  ]);
  elements.responsiveWidthToggle.checked = stored.responsiveWidthEnabled !== false;
  elements.responsiveDomains.value = Array.isArray(stored.responsiveWidthDomains)
    ? stored.responsiveWidthDomains.join("\n")
    : "*.naver.com";
}

async function loadFocusRedirectSetting() {
  const stored = await chrome.storage.local.get([
    FOCUS_REDIRECT_ENABLED_KEY,
    FOCUS_REDIRECT_DOMAINS_KEY
  ]);
  elements.focusRedirectToggle.checked = stored[FOCUS_REDIRECT_ENABLED_KEY] !== false;
  elements.focusRedirectDomains.value = Array.isArray(stored[FOCUS_REDIRECT_DOMAINS_KEY])
    ? stored[FOCUS_REDIRECT_DOMAINS_KEY].join("\n")
    : DEFAULT_FOCUS_REDIRECT_DOMAINS.join("\n");
}

function getLines(textarea) {
  return textarea.value
    .split("\n")
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

async function saveResponsiveWidthSettings() {
  await chrome.storage.local.set({
    responsiveWidthEnabled: elements.responsiveWidthToggle.checked,
    responsiveWidthDomains: getLines(elements.responsiveDomains)
  });
  elements.responsiveFeedback.textContent = "Saved. Reload matching tabs.";
}

async function saveFocusRedirectSettings() {
  const domains = normalizeRedirectDomains(getLines(elements.focusRedirectDomains));

  await chrome.storage.local.set({
    [FOCUS_REDIRECT_ENABLED_KEY]: elements.focusRedirectToggle.checked,
    [FOCUS_REDIRECT_DOMAINS_KEY]: domains
  });
  await sendMessage({ type: "APPLY_FOCUS_REDIRECT_SETTINGS" });

  elements.focusRedirectDomains.value = domains.join("\n");
  elements.focusRedirectFeedback.textContent = elements.focusRedirectToggle.checked
    ? "Saved. Matching visits redirect to Keybr."
    : "Saved. Redirect is off.";
}

async function applySelectedProfile() {
  if (!activeTab) return;
  const tabId = activeTab.id;
  setBusy(true);
  showFeedback("Applying profile…");

  try {
    const response = await sendMessage({
      type: "APPLY_UA",
      tabId,
      profileId: elements.profileSelect.value
    });
    await chrome.tabs.reload(tabId);

    if (activeTab?.id === tabId) {
      appliedProfileId = response.profileId;
      renderStatus();
      showFeedback("Profile applied. Reloading tab…");
    }
  } catch (error) {
    if (activeTab?.id === tabId) showFeedback(error.message, true);
  } finally {
    if (activeTab?.id === tabId) setBusy(false);
  }
}

async function resetProfile() {
  if (!activeTab) return;
  const tabId = activeTab.id;
  setBusy(true);
  showFeedback("Restoring browser default…");

  try {
    await sendMessage({ type: "RESET_UA", tabId });
    await chrome.tabs.reload(tabId);

    if (activeTab?.id === tabId) {
      appliedProfileId = null;
      renderStatus();
      showFeedback("Browser default restored. Reloading tab…");
    }
  } catch (error) {
    if (activeTab?.id === tabId) showFeedback(error.message, true);
  } finally {
    if (activeTab?.id === tabId) setBusy(false);
  }
}

elements.profileSelect.addEventListener("change", () => {
  renderSelectedProfile();
  showFeedback("");
});
elements.applyButton.addEventListener("click", applySelectedProfile);
elements.resetButton.addEventListener("click", resetProfile);
elements.rightClickToggle.addEventListener("change", () => {
  chrome.storage.local.set({ allowRightClick: elements.rightClickToggle.checked });
});
elements.responsiveWidthToggle.addEventListener("change", () => {
  saveResponsiveWidthSettings().catch((error) => {
    elements.responsiveFeedback.textContent = error.message;
  });
});
elements.saveResponsiveDomains.addEventListener("click", () => {
  saveResponsiveWidthSettings().catch((error) => {
    elements.responsiveFeedback.textContent = error.message;
  });
});
elements.focusRedirectToggle.addEventListener("change", () => {
  saveFocusRedirectSettings().catch((error) => {
    elements.focusRedirectFeedback.textContent = error.message;
  });
});
elements.saveFocusRedirectDomains.addEventListener("click", () => {
  saveFocusRedirectSettings().catch((error) => {
    elements.focusRedirectFeedback.textContent = error.message;
  });
});
elements.extensionsPageButton.addEventListener("click", () => {
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshTabById(tabId).catch((error) => showFeedback(error.message, true));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    refreshTabById(tabId).catch((error) => showFeedback(error.message, true));
  } else if (activeTab?.id === tabId && changeInfo.title) {
    renderTab(tab);
  }
});

window.addEventListener("focus", () => {
  refreshCurrentTab().catch((error) => showFeedback(error.message, true));
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshCurrentTab().catch((error) => showFeedback(error.message, true));
  }
});

populateProfiles();
renderSelectedProfile();
refreshCurrentTab().catch((error) => showFeedback(error.message, true));
loadRightClickSetting().catch((error) => showFeedback(error.message, true));
loadResponsiveWidthSetting().catch((error) => {
  elements.responsiveFeedback.textContent = error.message;
});
loadFocusRedirectSetting().catch((error) => {
  elements.focusRedirectFeedback.textContent = error.message;
});
