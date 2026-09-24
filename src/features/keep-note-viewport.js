(() => {
  const STYLE_ID = "browser-toolbox-keep-note-viewport-style";

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb {
      box-sizing: border-box !important;
      position: fixed !important;
      inset: 10px !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      transform: none !important;
    }

    .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb > .IZ65Hb-TBnied {
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
    }

    .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb .IZ65Hb-s2gQvd {
      max-height: calc(100% - 40px) !important;
      overflow-y: auto !important;
    }

    .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb
      .IZ65Hb-vIzZGf-L9AdLc-haAclf {
      box-sizing: border-box !important;
      border: 1px solid var(
        --gm3-sys-color-outline-variant,
        rgba(128, 128, 128, 0.55)
      ) !important;
      border-radius: 8px !important;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb
      .IZ65Hb-vIzZGf-L9AdLc-haAclf:focus {
      border-color: var(--gm3-sys-color-primary, #8ab4f8) !important;
      box-shadow: inset 0 0 0 1px
        var(--gm3-sys-color-primary, #8ab4f8) !important;
    }

    @media (prefers-color-scheme: light) {
      .IZ65Hb-n0tgWb.IZ65Hb-QQhtn.oT9UPb
        .IZ65Hb-vIzZGf-L9AdLc-haAclf:focus {
        border-color: var(--gm3-sys-color-primary, #1a73e8) !important;
        box-shadow: inset 0 0 0 1px
          var(--gm3-sys-color-primary, #1a73e8) !important;
      }
    }
  `;
  document.documentElement.append(style);
})();
