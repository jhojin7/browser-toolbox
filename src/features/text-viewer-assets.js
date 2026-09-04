const TEXT_VIEWER_ASSETS_MESSAGE = "LOAD_TEXT_VIEWER_ASSETS";
const MARKDOWN_LIBRARIES = [
  "vendor/marked.min.js",
  "vendor/purify.min.js",
  "vendor/highlight.min.js"
];

export async function handleTextViewerMessage(message, sender) {
  if (message.type !== TEXT_VIEWER_ASSETS_MESSAGE) return null;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    throw new Error("Text viewer requires a browser tab");
  }

  const target = {
    tabId,
    frameIds: [sender.frameId ?? 0]
  };

  await chrome.scripting.insertCSS({
    target,
    files: ["src/features/text-viewer.css"]
  });

  if (message.markdown) {
    await chrome.scripting.executeScript({
      target,
      files: MARKDOWN_LIBRARIES,
      world: "ISOLATED"
    });
  }

  return {};
}
