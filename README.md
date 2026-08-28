# browser-toolbox

browser-toolbox is an opinionated, local-first collection of small Chrome side-panel tools built for personal use. It does not need an account or a backend.

## Features

- Per-tab user-agent profiles for the top-level page request only
- Right-click override for websites that suppress Chrome's context menu
- Fixed-width layout fitting for selected domains
- Focus redirect for distracting sites

The extension starts with `*.naver.com` in the responsive-width domain list. Add or remove hostname patterns one per line from the sidebar.
The focus redirect sends matching sites to `https://www.keybr.com/`. It starts with `x.com`, `youtube.com`, and `news.ycombinator.com`; add or remove domains from the sidebar.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository folder.
5. Click the extension icon to open the side panel.

Reload the extension from `chrome://extensions` after source changes. Reload a matching webpage after changing responsive-width settings.

## Behavior and limits

### User agent

The user-agent tool changes only the `User-Agent` header on the active tab's top-level navigation request. It does not alter cookies, Client Hint headers, API calls, JavaScript values, device metrics, or the browser viewport. This narrower scope avoids broadly changing a signed-in website's browser fingerprint.

### Right click

The context-menu override is enabled by default. It runs on normal webpages and frames, but Chrome does not permit extensions to run on internal pages such as `chrome://`.

### Responsive width

For matching domains, browser-toolbox measures a fixed page layout and scales it down to fit the available page width. It is useful for old fixed-width websites; it does not reconstruct their internal responsive layout.

### Focus redirect

The focus redirect applies to top-level page visits only. A domain such as `youtube.com` matches `youtube.com` and subdomains such as `www.youtube.com` or `m.youtube.com`, then redirects to `https://www.keybr.com/` before the blocked page loads.

## Project layout

```text
assets/icons/             Extension icons
src/features/             Modular browser-toolbox features
src/background.js         Tab-scoped user-agent rules and defaults
src/content/              Page-level utilities
src/shared/               Shared profile definitions
src/sidebar/              Side-panel UI
manifest.json             Manifest V3 entry point
```

## Privacy

All settings stay in Chrome extension storage. The extension has no server, analytics, or external network calls.
