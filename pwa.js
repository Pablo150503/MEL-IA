// MEL-IA PWA support: service worker registration + install UX.
// Self-contained: injects its own DOM and styles. Does not touch
// script.js / styles.css / index.html body.
(function () {
  "use strict";

  var LS_KEY_DISMISSED = "melia_pwa_install_dismissed";

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
    } catch (e) {}
    // iOS Safari exposes this non-standard property when launched from the
    // home screen.
    return !!window.navigator.standalone;
  }

  function wasDismissed() {
    try {
      return window.localStorage.getItem(LS_KEY_DISMISSED) === "1";
    } catch (e) {
      return false;
    }
  }

  function setDismissed() {
    try {
      window.localStorage.setItem(LS_KEY_DISMISSED, "1");
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Service worker registration
  // ---------------------------------------------------------------------
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "/" }).catch(function (err) {
        console.warn("[pwa] service worker registration failed:", err);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Install banner UI
  // ---------------------------------------------------------------------
  var styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var style = document.createElement("style");
    style.id = "pwa-install-styles";
    style.textContent = [
      "#pwa-install-banner{",
      "  position:fixed;left:12px;right:12px;bottom:env(safe-area-inset-bottom,12px);",
      "  margin-bottom:12px;z-index:99999;",
      "  display:flex;align-items:center;gap:12px;",
      "  background:linear-gradient(90deg,#137DC5,#50aeee);",
      "  color:#fff;border-radius:14px;padding:12px 14px;",
      "  box-shadow:0 6px 20px rgba(19,125,197,0.35);",
      "  font-family:inherit;font-size:14px;line-height:1.3;",
      "  transform:translateY(0);opacity:1;",
      "  transition:transform .25s ease, opacity .25s ease;",
      "}",
      "#pwa-install-banner.pwa-hidden{transform:translateY(140%);opacity:0;pointer-events:none;}",
      "#pwa-install-banner .pwa-icon{font-size:20px;flex:0 0 auto;}",
      "#pwa-install-banner .pwa-text{flex:1 1 auto;min-width:0;}",
      "#pwa-install-banner .pwa-text strong{display:block;font-size:14px;}",
      "#pwa-install-banner .pwa-text span{display:block;font-size:12px;opacity:0.92;margin-top:2px;}",
      "#pwa-install-banner .pwa-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;}",
      "#pwa-install-banner button{",
      "  border:none;border-radius:10px;cursor:pointer;font-weight:600;",
      "  font-family:inherit;",
      "}",
      "#pwa-install-banner .pwa-install-btn{",
      "  background:#fff;color:#137DC5;padding:8px 14px;font-size:13px;",
      "  white-space:nowrap;",
      "}",
      "#pwa-install-banner .pwa-dismiss-btn{",
      "  background:transparent;color:#fff;opacity:0.85;",
      "  font-size:18px;padding:4px 6px;line-height:1;",
      "}",
      "@media (max-width:360px){",
      "  #pwa-install-banner{padding:10px 12px;}",
      "  #pwa-install-banner .pwa-text span{display:none;}",
      "}",
      "#pwa-install-help{",
      "  position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;",
      "  background:rgba(0,0,0,0.45);",
      "}",
      "#pwa-install-help .pwa-sheet{",
      "  width:100%;max-width:440px;background:#fff;border-radius:18px 18px 0 0;",
      "  padding:22px 20px calc(env(safe-area-inset-bottom,0px) + 20px);",
      "  font-family:inherit;color:#0f5f96;text-align:left;",
      "  box-shadow:0 -6px 20px rgba(0,0,0,0.15);",
      "}",
      "#pwa-install-help h3{margin:0 0 12px;font-size:19px;color:#00406a;text-align:center;}",
      "#pwa-install-help ol{margin:0 0 18px;padding-left:22px;font-size:15px;line-height:1.5;}",
      "#pwa-install-help li{margin-bottom:8px;}",
      "#pwa-install-help .pwa-close{",
      "  display:block;width:100%;margin:0;padding:12px;border:none;border-radius:25px;",
      "  background:#137DC5;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  var bannerEl = null;
  function ensureBanner() {
    if (bannerEl) return bannerEl;
    injectStyles();
    var el = document.createElement("div");
    el.id = "pwa-install-banner";
    el.className = "pwa-hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
    bannerEl = el;
    return el;
  }

  function showBanner(innerHtml, onActionClick) {
    if (isStandalone() || wasDismissed()) return;
    var el = ensureBanner();
    el.innerHTML =
      '<div class="pwa-icon">📱</div>' +
      '<div class="pwa-text">' + innerHtml + "</div>" +
      '<div class="pwa-actions"></div>';
    var actions = el.querySelector(".pwa-actions");

    if (onActionClick) {
      var actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "pwa-install-btn";
      actionBtn.textContent = "Install";
      actionBtn.addEventListener("click", onActionClick);
      actions.appendChild(actionBtn);
    }

    var dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "pwa-dismiss-btn";
    dismissBtn.setAttribute("aria-label", "Dismiss");
    dismissBtn.innerHTML = "&times;";
    dismissBtn.addEventListener("click", function () {
      hideBanner();
      setDismissed();
    });
    actions.appendChild(dismissBtn);

    // Allow the browser to paint the element before animating in.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.remove("pwa-hidden");
      });
    });
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.add("pwa-hidden");
  }

  // ---------------------------------------------------------------------
  // Platform detection
  // ---------------------------------------------------------------------
  function isIOS() {
    var ua = window.navigator.userAgent || "";
    var platform = window.navigator.platform || "";
    var isIPhoneIpadIpod = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    // iPadOS 13+ reports as "MacIntel" but has touch support.
    var isIPadOS =
      !/Android/.test(ua) &&
      platform === "MacIntel" &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1;
    return isIPhoneIpadIpod || isIPadOS;
  }

  function isSafari() {
    var ua = window.navigator.userAgent || "";
    // Safari UA contains "Safari" but not "CriOS" (Chrome), "FxiOS" (Firefox),
    // "EdgiOS" (Edge), "OPiOS"/"OPT" (Opera), or other common in-app browsers.
    var isChromeIOS = /CriOS/.test(ua);
    var isFirefoxIOS = /FxiOS/.test(ua);
    var isEdgeIOS = /EdgiOS/.test(ua);
    var isOperaIOS = /OPiOS|OPT\//.test(ua);
    var isOtherBrowser = isChromeIOS || isFirefoxIOS || isEdgeIOS || isOperaIOS;
    var looksLikeSafari = /Safari/.test(ua);
    return looksLikeSafari && !isOtherBrowser;
  }

  // ---------------------------------------------------------------------
  // Android / Chrome: beforeinstallprompt
  // ---------------------------------------------------------------------
  var deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (isStandalone() || wasDismissed()) return;
    showBanner(
      "<strong>Install MEL-IA</strong><span>Add it to your home screen for quick, full-screen access.</span>",
      function () {
        window.instalarApp();
      }
    );
  });

  window.addEventListener("appinstalled", function () {
    hideBanner();
    deferredPrompt = null;
    markInstalled();
  });

  // Hides the in-app "Install app" button (see .pwa-instalada in styles.css).
  function markInstalled() {
    document.documentElement.classList.add("pwa-instalada");
  }

  // ---------------------------------------------------------------------
  // iOS Safari: no install prompt API exists, show a manual hint instead.
  // ---------------------------------------------------------------------
  function maybeShowIOSHint() {
    if (!isIOS() || isStandalone() || wasDismissed()) return;

    if (isSafari()) {
      showBanner(
        "<strong>Install MEL-IA</strong><span>Tap Share ⬆︎ then “Add to Home Screen”.</span>",
        null
      );
    } else {
      showBanner(
        "<strong>Install MEL-IA</strong><span>Open this page in Safari to add it to your home screen.</span>",
        null
      );
    }
  }

  // ---------------------------------------------------------------------
  // "Install app" button: native prompt when the browser offers one,
  // otherwise step-by-step instructions to add the home-screen shortcut.
  // ---------------------------------------------------------------------
  function installSteps() {
    var ua = window.navigator.userAgent || "";
    if (isIOS()) {
      if (isSafari()) {
        return [
          "Tap the <strong>Share</strong> button ⬆︎ in Safari's toolbar.",
          "Scroll down and tap <strong>Add to Home Screen</strong>.",
          "Tap <strong>Add</strong>. MEL-IA will appear on your home screen."
        ];
      }
      return [
        "Tap the <strong>Share</strong> button ⬆︎ of your browser and choose <strong>Add to Home Screen</strong>.",
        "If that option doesn't appear, open this page in <strong>Safari</strong> and do it from there.",
        "Tap <strong>Add</strong>. MEL-IA will appear on your home screen."
      ];
    }
    if (/Android/.test(ua)) {
      return [
        "Open the browser menu <strong>⋮</strong> (top right).",
        "Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.",
        "Confirm. MEL-IA will appear on your home screen and app drawer."
      ];
    }
    return [
      "Click the <strong>install</strong> icon in the address bar, or open the browser menu.",
      "Choose <strong>Install MEL-IA</strong> (or <strong>Create shortcut</strong>).",
      "Confirm to open MEL-IA in its own window."
    ];
  }

  function showInstallHelp() {
    injectStyles();
    var old = document.getElementById("pwa-install-help");
    if (old) old.remove();
    var overlay = document.createElement("div");
    overlay.id = "pwa-install-help";
    overlay.innerHTML =
      '<div class="pwa-sheet" role="dialog" aria-label="Install MEL-IA">' +
      "<h3>Install MEL-IA</h3>" +
      "<ol><li>" + installSteps().join("</li><li>") + "</li></ol>" +
      '<button type="button" class="pwa-close">OK</button>' +
      "</div>";
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay || event.target.classList.contains("pwa-close")) {
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  }

  window.instalarApp = function () {
    if (!deferredPrompt) {
      showInstallHelp();
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice
      .then(function (choice) {
        deferredPrompt = null;
        hideBanner();
        if (choice && choice.outcome === "accepted") markInstalled();
      })
      .catch(function () {
        deferredPrompt = null;
      });
  };

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function init() {
    registerServiceWorker();
    if (isStandalone()) {
      markInstalled();
      return;
    }
    if (isIOS()) {
      // No beforeinstallprompt on iOS; show the manual hint once things
      // have settled a bit so it doesn't compete with the initial render.
      setTimeout(maybeShowIOSHint, 1500);
    }
    // Android/Chrome path is driven entirely by the beforeinstallprompt
    // listener registered above.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
