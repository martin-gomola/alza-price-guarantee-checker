(async function runHeurekaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;
  if (settingsApi) {
    const settings = await settingsApi.getSettings();
    if (!settings.heurekaCleanupEnabled) {
      document.documentElement.classList.add("alza-checker-heureka-no-cleanup");
      return;
    }
  }
})();
