import {
  DEFAULT_FOCUS_REDIRECT_DOMAINS,
  FOCUS_REDIRECT_DOMAINS_KEY,
  FOCUS_REDIRECT_ENABLED_KEY,
  FOCUS_REDIRECT_URL,
  createRedirectUrlFilter,
  normalizeRedirectDomains
} from "../shared/focus-redirect.js";

const FOCUS_REDIRECT_RULE_ID_OFFSET = 10_000;
const FOCUS_REDIRECT_RULE_ID_LIMIT = 1_000;
const RESOURCE_TYPES = ["main_frame"];

function isFocusRedirectRule(rule) {
  return (
    rule.id >= FOCUS_REDIRECT_RULE_ID_OFFSET &&
    rule.id < FOCUS_REDIRECT_RULE_ID_OFFSET + FOCUS_REDIRECT_RULE_ID_LIMIT
  );
}

async function getExistingFocusRedirectRuleIds() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.filter(isFocusRedirectRule).map((rule) => rule.id);
}

async function getFocusRedirectSettings() {
  const stored = await chrome.storage.local.get([
    FOCUS_REDIRECT_ENABLED_KEY,
    FOCUS_REDIRECT_DOMAINS_KEY
  ]);

  const enabled = stored[FOCUS_REDIRECT_ENABLED_KEY] !== false;
  const domains = normalizeRedirectDomains(
    Array.isArray(stored[FOCUS_REDIRECT_DOMAINS_KEY])
      ? stored[FOCUS_REDIRECT_DOMAINS_KEY]
      : DEFAULT_FOCUS_REDIRECT_DOMAINS
  );

  return { enabled, domains };
}

function createFocusRedirectRule(domain, index) {
  const urlFilter = createRedirectUrlFilter(domain);
  if (!urlFilter) return null;

  return {
    id: FOCUS_REDIRECT_RULE_ID_OFFSET + index,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: FOCUS_REDIRECT_URL }
    },
    condition: {
      urlFilter,
      resourceTypes: RESOURCE_TYPES
    }
  };
}

export async function applyFocusRedirectRules() {
  const { enabled, domains } = await getFocusRedirectSettings();
  const removeRuleIds = await getExistingFocusRedirectRuleIds();
  const addRules = enabled
    ? domains
        .slice(0, FOCUS_REDIRECT_RULE_ID_LIMIT)
        .map(createFocusRedirectRule)
        .filter(Boolean)
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

export function didFocusRedirectSettingsChange(changes) {
  return (
    Boolean(changes[FOCUS_REDIRECT_ENABLED_KEY]) ||
    Boolean(changes[FOCUS_REDIRECT_DOMAINS_KEY])
  );
}
