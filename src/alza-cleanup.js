(async function runAlzaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;

  if (!settingsApi) {
    return;
  }

  const settings = await settingsApi.getSettings();

  if (!settings.uiCleanupEnabled) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = await fetch(chrome.runtime.getURL("src/alza-cleanup.css")).then((response) => response.text());
  (document.head || document.documentElement).append(style);
})();
