(function attachStyleInjector(root) {
  async function injectExtensionCssIfEnabled({ settingsApi, settingKey, cssPath } = {}) {
    if (!settingsApi || !settingKey || !cssPath) {
      return;
    }

    const settings = await settingsApi.getSettings();

    if (!settings[settingKey]) {
      return;
    }

    try {
      const cssUrl = root.chrome.runtime.getURL(cssPath);
      const response = await fetch(cssUrl);

      if (!response.ok) {
        return;
      }

      const style = document.createElement("style");
      style.textContent = await response.text();
      (document.head || document.documentElement).append(style);
    } catch {
      // Ignore fetch failures (e.g. resource unavailable during extension reload).
    }
  }

  const api = {
    injectExtensionCssIfEnabled
  };

  root.AlzaCheckerStyleInjector = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
