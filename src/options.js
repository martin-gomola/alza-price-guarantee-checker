(async function runOptionsPage() {
  const settingsApi = window.AlzaCheckerSettings;
  const status = document.querySelector("#status");
  const contentTitle = document.querySelector("#content-title");
  const contentSubtitle = document.querySelector("#content-subtitle");
  const aboutVersion = document.querySelector("#about-version");

  if (!settingsApi) {
    return;
  }

  const SECTIONS = {
    general: {
      title: "Vseobecne",
      subtitle: "Nastavenia pre Alza.sk a Alza.cz. Porovnanie cien sa tym nemení."
    },
    heureka: {
      title: "Heureka a sukromie",
      subtitle: "Reklamy, trackery a transparentne vysvetlenie, co rozsirenie na Heureke robi."
    },
    about: {
      title: "O rozsireni",
      subtitle: "Verzia, ucely a odkazy na dokumentaciu."
    }
  };

  const toggles = [
    { id: "ui-cleanup-enabled", key: "uiCleanupEnabled" },
    { id: "unit-price-enabled", key: "unitPriceEnabled" },
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

  function showPanel(panelId) {
    for (const button of document.querySelectorAll(".nav-item")) {
      const active = button.dataset.panel === panelId;
      button.classList.toggle("nav-item--active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }

    for (const panel of document.querySelectorAll(".panel")) {
      const active = panel.id === `panel-${panelId}`;
      panel.hidden = !active;
      panel.classList.toggle("panel--active", active);
    }

    const section = SECTIONS[panelId] || SECTIONS.general;
    contentTitle.textContent = section.title;
    contentSubtitle.textContent = section.subtitle;
  }

  for (const button of document.querySelectorAll(".nav-item")) {
    button.addEventListener("click", () => {
      showPanel(button.dataset.panel || "general");
    });
  }

  if (aboutVersion && chrome?.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    aboutVersion.textContent = `Verzia ${manifest.version} · ${manifest.name}`;
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
    renderStatus("Ulozene. Obnovte otvorene Alza alebo Heureka taby, aby sa zmeny prejavili.");
  }

  for (const { input } of inputs) {
    input.addEventListener("change", saveAll);
  }
})();
