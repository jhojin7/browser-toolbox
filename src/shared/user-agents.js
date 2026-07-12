export const DEFAULT_PROFILE_ID = "chrome-macos";

export const USER_AGENT_PROFILES = [
  {
    id: "chrome-macos",
    label: "Chrome · macOS",
    group: "Desktop",
    description: "Chrome 126 on macOS",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  {
    id: "chrome-windows",
    label: "Chrome · Windows",
    group: "Desktop",
    description: "Chrome 126 on Windows 10/11",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  {
    id: "firefox-windows",
    label: "Firefox · Windows",
    group: "Desktop",
    description: "Firefox 127 on Windows 10/11",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  },
  {
    id: "safari-macos",
    label: "Safari · macOS",
    group: "Desktop",
    description: "Safari 17 on macOS",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  },
  {
    id: "safari-iphone",
    label: "Safari · iPhone",
    group: "Mobile",
    description: "Mobile Safari on iOS 17",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    id: "chrome-android",
    label: "Chrome · Android",
    group: "Mobile",
    description: "Chrome 126 on Android",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  }
];

export function getProfile(profileId) {
  return USER_AGENT_PROFILES.find((profile) => profile.id === profileId);
}
