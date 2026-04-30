(async function runOptionsPage() {
  const settingsApi = window.AlzaCheckerSettings;
  const status = document.querySelector("#status");

  if (!settingsApi) {
    return;
  }

  const toggles = [
    { id: "ui-cleanup-enabled", key: "uiCleanupEnabled" },
    { id: "unit-price-enabled", key: "unitPriceEnabled" },
    { id: "price-verification-enabled", key: "priceVerificationEnabled" },
    { id: "heureka-cleanup-enabled", key: "heurekaCleanupEnabled" }
  ];

  const inputs = toggles.map(({ id, key }) => {
    const input = document.querySelector(`#${id}`);
    return input instanceof HTMLInputElement ? { input, key } : null;
  }).filter(Boolean);

  if (inputs.length === 0) {
    return;
  }

  function renderStatus(text) {
    status.textContent = text;
  }

  const settings = await settingsApi.getSettings();

  for (const { input, key } of inputs) {
    input.checked = settings[key];
  }

  async function saveAll() {
    const allInputs = inputs.map(({ input }) => input);
    for (const input of allInputs) input.disabled = true;
    renderStatus("Ukladam...");

    const updated = {};
    for (const { input, key } of inputs) {
      updated[key] = input.checked;
    }

    await settingsApi.saveSettings(updated);

    for (const input of allInputs) input.disabled = false;
    renderStatus("Ulozene. Otvorene Alza taby sa aktualizuju automaticky.");
  }

  for (const { input } of inputs) {
    input.addEventListener("change", saveAll);
  }
})();
