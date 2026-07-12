# Personal Toolbox

Personal Toolbox is a small, local-first Chrome side-panel extension for browser utilities that do not need an account or a backend.

## Features

- Per-tab user-agent profiles for the top-level page request only
- Right-click override for websites that suppress Chrome's context menu
- Fixed-width layout fitting for selected domains

The extension starts with `*.naver.com` in the responsive-width domain list. Add or remove hostname patterns one per line from the sidebar.

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

For matching domains, Personal Toolbox measures a fixed page layout and scales it down to fit the available page width. It is useful for old fixed-width websites; it does not reconstruct their internal responsive layout.

## Project layout

```text
assets/icons/             Extension icons
src/background.js         Tab-scoped user-agent rules and defaults
src/content/              Page-level utilities
src/shared/               Shared profile definitions
src/sidebar/              Side-panel UI
manifest.json             Manifest V3 entry point
```

## Privacy

All settings stay in Chrome extension storage. The extension has no server, analytics, or external network calls.
