(async function runOptionsPage() {
  const settingsApi = window.AlzaCheckerSettings;
  const cleanupToggle = document.querySelector("#ui-cleanup-enabled");
  const status = document.querySelector("#status");

  if (!settingsApi || !(cleanupToggle instanceof HTMLInputElement)) {
    return;
  }

  function renderStatus(text) {
    status.textContent = text;
  }

  const settings = await settingsApi.getSettings();
  cleanupToggle.checked = settings.uiCleanupEnabled;

  cleanupToggle.addEventListener("change", async () => {
    cleanupToggle.disabled = true;
    renderStatus("Ukladam...");

    await settingsApi.saveSettings({
      uiCleanupEnabled: cleanupToggle.checked
    });

    cleanupToggle.disabled = false;
    renderStatus("Ulozene. Otvorene Alza taby sa aktualizuju automaticky.");
  });
})();
