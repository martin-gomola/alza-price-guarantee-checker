(function attachSettings(root) {
  const DEFAULT_SETTINGS = {
    uiCleanupEnabled: true
  };

  function normalizeSettings(value) {
    return {
      uiCleanupEnabled: value?.uiCleanupEnabled !== false
    };
  }

  function getSettings() {
    if (!root.chrome?.storage?.local) {
      return Promise.resolve({ ...DEFAULT_SETTINGS });
    }

    return new Promise((resolve) => {
      root.chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
        if (root.chrome.runtime?.lastError) {
          resolve({ ...DEFAULT_SETTINGS });
          return;
        }

        resolve(normalizeSettings(settings));
      });
    });
  }

  function saveSettings(settings) {
    if (!root.chrome?.storage?.local) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      root.chrome.storage.local.set(normalizeSettings(settings), resolve);
    });
  }

  root.AlzaCheckerSettings = {
    DEFAULT_SETTINGS,
    getSettings,
    normalizeSettings,
    saveSettings
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
