(async function runAlzaCleanup() {
  const settingsApi = window.AlzaCheckerSettings;
  const styleInjector = window.AlzaCheckerStyleInjector;

  if (!settingsApi || !styleInjector) {
    return;
  }

  await styleInjector.injectExtensionCssIfEnabled({
    settingsApi,
    settingKey: "uiCleanupEnabled",
    cssPath: "src/alza-cleanup.css"
  });
})();
