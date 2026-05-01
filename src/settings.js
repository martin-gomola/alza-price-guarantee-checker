(function attachSettings(root) {
  const DEFAULT_SETTINGS = {
    uiCleanupEnabled: true,
    unitPriceEnabled: true,
    heurekaCleanupEnabled: true
  };

  function normalizeSettings(value) {
    return {
      uiCleanupEnabled: value?.uiCleanupEnabled !== false,
      unitPriceEnabled: value?.unitPriceEnabled !== false,
      heurekaCleanupEnabled: value?.heurekaCleanupEnabled !== false
    };
  }

  async function getSettings() {
    if (!root.chrome?.storage?.local) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const stored = await root.chrome.storage.local.get(DEFAULT_SETTINGS);
      return normalizeSettings(stored);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function saveSettings(settings) {
    await root.chrome?.storage?.local?.set(normalizeSettings(settings));
  }

  root.AlzaCheckerSettings = {
    DEFAULT_SETTINGS,
    getSettings,
    normalizeSettings,
    saveSettings
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
