export const FOCUS_REDIRECT_URL = "https://www.keybr.com/";
export const FOCUS_REDIRECT_ENABLED_KEY = "focusRedirectEnabled";
export const FOCUS_REDIRECT_DOMAINS_KEY = "focusRedirectDomains";
export const DEFAULT_FOCUS_REDIRECT_DOMAINS = [
  "x.com",
  "youtube.com",
  "news.ycombinator.com"
];

export const FOCUS_REDIRECT_DEFAULTS = {
  [FOCUS_REDIRECT_ENABLED_KEY]: true,
  [FOCUS_REDIRECT_DOMAINS_KEY]: DEFAULT_FOCUS_REDIRECT_DOMAINS
};

export function normalizeRedirectDomain(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function normalizeRedirectDomains(domains) {
  const seen = new Set();
  const normalizedDomains = [];

  for (const domain of domains) {
    const normalized = normalizeRedirectDomain(domain);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    normalizedDomains.push(normalized);
  }

  return normalizedDomains;
}

export function createRedirectUrlFilter(domain) {
  const normalized = normalizeRedirectDomain(domain);
  return normalized ? `||${normalized}^` : null;
}
