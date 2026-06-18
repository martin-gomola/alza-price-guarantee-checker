(async function runHeurekaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;

  if (!settingsApi) {
    return;
  }

  const settings = await settingsApi.getSettings();

  if (!settings.heurekaCleanupEnabled) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = await fetch(chrome.runtime.getURL("src/heureka-cleanup.css")).then((response) => response.text());
  (document.head || document.documentElement).append(style);
})();
