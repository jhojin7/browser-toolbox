# browser-toolbox

A small Chrome extension I use as a personal browser toolbox. It collects tiny fixes and overrides that make everyday browsing less annoying.

No account, backend, analytics, or remote service.

## Tools

- **User agent**: apply a per-tab `User-Agent` header profile, then reload the tab.
- **Right click**: keep Chrome's context menu available on sites that try to suppress it.
- **Responsive width**: scale fixed-width pages down for selected domains. Defaults to `*.naver.com`.
- **Focus redirect**: redirect distracting domains to `https://www.keybr.com/`. Defaults to `x.com`, `youtube.com`, and `news.ycombinator.com`.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Choose this repository folder.
5. Click the extension icon to open the side panel.

After source changes, reload the extension from `chrome://extensions`.

## Notes

- Settings are stored in Chrome extension storage.
- User-agent changes affect only the active tab's top-level page request. They do not change Client Hints, cookies, JavaScript values, device metrics, subresources, or viewport size.
- Right-click and responsive-width features run on normal webpages and frames. Chrome extension scripts cannot run on internal pages such as `chrome://`.
- Responsive-width domain patterns are edited one per line in the side panel. Matching tabs may need a reload.
- Focus redirect applies to top-level page visits. A domain like `youtube.com` also matches subdomains like `www.youtube.com`.

## Layout

```text
assets/icons/      Extension icons
src/background.js  Extension lifecycle and message routing
src/features/      One module per browser-toolbox feature
src/shared/        Shared profiles, defaults, and setting keys
src/sidebar/       Side-panel UI
manifest.json      Manifest V3 entry point
```
