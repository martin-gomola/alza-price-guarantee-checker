(async function runHeurekaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;
  const styleInjector = window.AlzaCheckerStyleInjector;

  if (!settingsApi || !styleInjector) {
    return;
  }

  await styleInjector.injectExtensionCssIfEnabled({
    settingsApi,
    settingKey: "heurekaCleanupEnabled",
    cssPath: "src/heureka-cleanup.css"
  });
})();
