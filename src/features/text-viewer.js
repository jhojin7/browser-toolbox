(() => {
  const ENABLED_KEY = "textViewerEnabled";
  const THEME_KEY = "textViewerTheme";
  const WIDTH_KEY = "textViewerWidth";
  const WRAP_KEY = "textViewerWrap";
  const SUPPORTED_CONTENT_TYPES = new Set([
    "text/plain",
    "text/markdown",
    "text/x-markdown"
  ]);
  const MARKDOWN_FILE_PATTERN = /\.(md|markdown|mdown|mkd)$/i;

  if (window !== window.top || !SUPPORTED_CONTENT_TYPES.has(document.contentType)) return;

  document.documentElement.style.setProperty("visibility", "hidden", "important");

  initialize()
    .catch((error) => {
      console.warn("Could not open browser-toolbox text viewer", error);
    })
    .finally(() => {
      document.documentElement.style.removeProperty("visibility");
    });

  async function initialize() {
    await domReady();

    const settings = await chrome.storage.local.get([
      ENABLED_KEY,
      THEME_KEY,
      WIDTH_KEY,
      WRAP_KEY
    ]);
    if (settings[ENABLED_KEY] === false) return;

    const sourceContainer = document.body?.querySelector("pre");
    if (!sourceContainer) return;

    const source = sourceContainer.textContent ?? "";
    const originalTitle = document.title;
    const markdown = isMarkdownDocument();
    const response = await chrome.runtime.sendMessage({
      type: "LOAD_TEXT_VIEWER_ASSETS",
      markdown
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not load text viewer assets");
    }

    const renderedMarkdown = markdown ? renderMarkdown(source) : null;
    try {
      mountViewer({
        source,
        renderedMarkdown,
        markdown,
        theme: normalizeTheme(settings[THEME_KEY]),
        width: settings[WIDTH_KEY] === "wide" ? "wide" : "narrow",
        wrap: settings[WRAP_KEY] !== false
      });
    } catch (error) {
      document.body.replaceChildren(sourceContainer);
      delete document.documentElement.dataset.browserToolboxTextViewer;
      delete document.documentElement.dataset.theme;
      document.title = originalTitle;
      throw error;
    }
  }

  function domReady() {
    if (document.readyState !== "loading") return Promise.resolve();

    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  function isMarkdownDocument() {
    if (document.contentType === "text/markdown" || document.contentType === "text/x-markdown") {
      return true;
    }

    return MARKDOWN_FILE_PATTERN.test(location.pathname);
  }

  function renderMarkdown(source) {
    if (!globalThis.marked || !globalThis.DOMPurify || !globalThis.hljs) {
      throw new Error("Markdown libraries did not load");
    }

    const renderer = new marked.Renderer();
    renderer.code = (code, languageInfo) => {
      const language = String(languageInfo || "")
        .trim()
        .split(/\s+/, 1)[0]
        .toLowerCase();
      const knownLanguage = language && hljs.getLanguage(language);
      const highlighted = knownLanguage
        ? hljs.highlight(code, { language }).value
        : hljs.highlightAuto(code).value;
      const languageClass = knownLanguage ? ` language-${language}` : "";

      return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>`;
    };

    const unsafeHtml = marked.parse(source, {
      gfm: true,
      breaks: false,
      renderer
    });

    return DOMPurify.sanitize(unsafeHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["checked"]
    });
  }

  function mountViewer({ source, renderedMarkdown, markdown, theme, width, wrap }) {
    const fileName = getFileName();
    const lineCount = source ? source.split(/\r\n?|\n/).length : 0;
    const byteCount = new Blob([source]).size;

    document.documentElement.dataset.browserToolboxTextViewer = "true";
    document.documentElement.dataset.theme = theme;
    document.body.replaceChildren();
    document.title = fileName || document.title || "Text viewer";

    const shell = document.createElement("div");
    shell.className = "btv-shell";
    shell.innerHTML = `
      <header class="btv-topbar">
        <div class="btv-file-meta">
          <strong class="btv-file-name"></strong>
          <span class="btv-file-detail"></span>
        </div>
        <button class="btv-button btv-copy" type="button">Copy</button>
      </header>
      <main class="btv-viewer-card">
        <article class="btv-content" data-width="${width}"></article>
      </main>
      <nav class="btv-menubar" aria-label="Viewer controls">
        <button class="btv-button btv-theme" type="button"></button>
        <button class="btv-button btv-width" type="button"></button>
        <button class="btv-button btv-wrap" type="button">Wrap</button>
        <button class="btv-button btv-mode" type="button">Raw</button>
        <button class="btv-button btv-toc" type="button">Contents</button>
      </nav>
      <dialog class="btv-toc-dialog">
        <header>
          <strong>Contents</strong>
          <button class="btv-button btv-toc-close" type="button" aria-label="Close">Close</button>
        </header>
        <nav class="btv-toc-list"></nav>
      </dialog>
    `;
    document.body.append(shell);

    const elements = {
      fileName: shell.querySelector(".btv-file-name"),
      fileDetail: shell.querySelector(".btv-file-detail"),
      content: shell.querySelector(".btv-content"),
      copy: shell.querySelector(".btv-copy"),
      theme: shell.querySelector(".btv-theme"),
      width: shell.querySelector(".btv-width"),
      wrap: shell.querySelector(".btv-wrap"),
      mode: shell.querySelector(".btv-mode"),
      toc: shell.querySelector(".btv-toc"),
      tocDialog: shell.querySelector(".btv-toc-dialog"),
      tocClose: shell.querySelector(".btv-toc-close"),
      tocList: shell.querySelector(".btv-toc-list")
    };
    const state = {
      mode: markdown ? "rendered" : "raw",
      theme,
      width,
      wrap
    };

    elements.fileName.textContent = fileName || "Untitled text";
    elements.fileDetail.textContent = `${markdown ? "Markdown" : "Plain text"} · ${lineCount.toLocaleString()} lines · ${formatBytes(byteCount)}`;
    elements.mode.hidden = !markdown;
    elements.toc.hidden = !markdown;

    renderContent();
    renderControls();

    elements.copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(source);
        showTemporaryLabel(elements.copy, "Copied");
      } catch {
        showTemporaryLabel(elements.copy, "Copy failed");
      }
    });

    elements.theme.addEventListener("click", () => {
      state.theme = nextTheme(state.theme);
      document.documentElement.dataset.theme = state.theme;
      chrome.storage.local.set({ [THEME_KEY]: state.theme });
      renderControls();
    });

    elements.width.addEventListener("click", () => {
      state.width = state.width === "narrow" ? "wide" : "narrow";
      elements.content.dataset.width = state.width;
      chrome.storage.local.set({ [WIDTH_KEY]: state.width });
      renderControls();
    });

    elements.wrap.addEventListener("click", () => {
      state.wrap = !state.wrap;
      chrome.storage.local.set({ [WRAP_KEY]: state.wrap });
      renderContent();
      renderControls();
    });

    elements.mode.addEventListener("click", () => {
      state.mode = state.mode === "rendered" ? "raw" : "rendered";
      renderContent();
      renderControls();
    });

    elements.toc.addEventListener("click", () => {
      if (!elements.toc.disabled) elements.tocDialog.showModal();
    });
    elements.tocClose.addEventListener("click", () => elements.tocDialog.close());
    elements.tocDialog.addEventListener("click", (event) => {
      if (event.target === elements.tocDialog) elements.tocDialog.close();
    });

    function renderContent() {
      elements.content.className = "btv-content";
      elements.content.dataset.width = state.width;
      elements.content.replaceChildren();

      if (state.mode === "rendered" && renderedMarkdown !== null) {
        elements.content.classList.add("btv-markdown-body");
        elements.content.innerHTML = renderedMarkdown;
        hardenLinks(elements.content);
        renderTableOfContents(elements.content, elements);
        scrollToInitialHash();
      } else {
        elements.content.classList.add("btv-raw-body");
        elements.content.dataset.wrap = String(state.wrap);
        const pre = document.createElement("pre");
        pre.textContent = source;
        elements.content.append(pre);
        elements.toc.disabled = true;
      }
    }

    function renderControls() {
      elements.theme.textContent = `Theme: ${capitalize(state.theme)}`;
      elements.width.textContent = state.width === "narrow" ? "Width: Reader" : "Width: Full";
      elements.wrap.hidden = state.mode === "rendered";
      elements.wrap.dataset.active = String(state.wrap);
      elements.wrap.textContent = state.wrap ? "Wrap: On" : "Wrap: Off";
      elements.mode.textContent = state.mode === "rendered" ? "View raw" : "View rendered";
      if (markdown && state.mode === "raw") elements.toc.disabled = true;
    }
  }

  function hardenLinks(container) {
    container.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  function renderTableOfContents(container, elements) {
    const headings = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const usedIds = new Set();
    elements.tocList.replaceChildren();
    elements.toc.disabled = headings.length === 0;

    if (!headings.length) {
      const empty = document.createElement("p");
      empty.className = "btv-toc-empty";
      empty.textContent = "No headings";
      elements.tocList.append(empty);
      return;
    }

    headings.forEach((heading, index) => {
      const text = heading.textContent?.replace(/\s+/g, " ").trim() || `Heading ${index + 1}`;
      heading.id = uniqueHeadingId(heading.id || text, usedIds);

      const button = document.createElement("button");
      button.className = "btv-toc-link";
      button.type = "button";
      button.dataset.level = heading.tagName.slice(1);
      button.textContent = text;
      button.addEventListener("click", () => {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        elements.tocDialog.close();
      });
      elements.tocList.append(button);
    });
  }

  function uniqueHeadingId(value, usedIds) {
    const base = String(value)
      .normalize("NFKD")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "heading";
    let candidate = base;
    let suffix = 2;

    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  function scrollToInitialHash() {
    if (!location.hash) return;

    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Keep malformed hash unchanged.
    }
    document.getElementById(id)?.scrollIntoView();
  }

  function getFileName() {
    const segment = location.pathname.split("/").filter(Boolean).at(-1) || location.hostname;
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }

  function normalizeTheme(theme) {
    return ["auto", "light", "dark"].includes(theme) ? theme : "auto";
  }

  function nextTheme(theme) {
    if (theme === "auto") return "light";
    if (theme === "light") return "dark";
    return "auto";
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function showTemporaryLabel(button, label) {
    const original = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  }
})();
