(async function runAlzaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;

  if (!settingsApi) {
    return;
  }

  const settings = await settingsApi.getSettings();

  if (!settings.uiCleanupEnabled) {
    return;
  }

  try {
    const cssUrl = chrome.runtime.getURL("src/alza-cleanup.css");
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
})();
