(function runAlzaChecker() {
  const shared = window.AlzaCheckerShared;

  if (!shared || document.getElementById("alza-checker-root")) {
    return;
  }

  const state = {
    isExpanded: false,
    shops: [],
    results: [],
    isRunning: false
  };
  const FETCH_TIMEOUT_MS = 10000;
  const SELECTORS = {
    closeButton: '[data-testid="dialog-close-button"], [role="dialog"] button[aria-label]',
    combobox: '[role="dialog"] [role="combobox"], [role="dialog"] [aria-haspopup="listbox"]',
    guaranteeRoots: [
      '[role="dialog"]',
      '[role="listbox"]',
      '[data-testid*="priceGuarantee"]',
      '[class*="priceGuarantee"]'
    ].join(", "),
    guaranteeTrigger: ".js-price-guarantee, .price-guarantee, [data-testid='component-priceGuaranteeProcessorProxy']",
    h1: "#h1c > h1, #h1c h1",
    insertionPoint: ".price-detail__right-col, .price-detail, #detailText",
    buyActions: ".price-detail__buy-actions, [data-testid='buy-actions']",
    optionItems: [
      '[role="dialog"] [role="option"]',
      '[role="dialog"] [role="listitem"]',
      '[role="dialog"] li',
      '[role="dialog"] option',
      '[role="listbox"] [role="option"]',
      '[role="listbox"] li',
      '[role="listbox"] option'
    ].join(", "),
    priceArea: '[data-testid="price-primary"], .price-detail__price-box-wrapper, .price-detail',
    upsellBlock: ".warranty-list-compact, .warranty-list, .accessoriesBlockNew"
  };

  function getProductName() {
    return shared.cleanProductName(document.querySelector(SELECTORS.h1)?.textContent);
  }

  function getAlzaPrice() {
    const priceArea = document.querySelector(SELECTORS.priceArea);
    return shared.parseEuroPrice(priceArea?.textContent || document.body.textContent);
  }

  function getGuaranteeApiUrls() {
    const urls = new Set();

    for (const element of Array.from(document.querySelectorAll("[data-api-url]"))) {
      const value = element.getAttribute("data-api-url");

      if (value && value.toLowerCase().includes("priceguarantee")) {
        const url = new URL(value, window.location.href).href;
        urls.add(url);

        if (!url.includes("/dialog")) {
          urls.add(url.replace(/\/priceGuarantee\/[^?]+/i, "/priceGuarantee/dialog"));
        }
      }
    }

    return Array.from(urls).sort((a, b) => {
      const aIsDialog = a.includes("/dialog");
      const bIsDialog = b.includes("/dialog");

      return Number(bIsDialog) - Number(aIsDialog);
    });
  }

  function findInsertionPoint() {
    return document.querySelector(SELECTORS.insertionPoint) || document.body;
  }

  function insertPanel(panel) {
    const buyActions = document.querySelector(SELECTORS.buyActions);
    const upsellBlock = document.querySelector(SELECTORS.upsellBlock);

    if (buyActions?.parentElement) {
      buyActions.after(panel);
      return;
    }

    if (upsellBlock?.parentElement) {
      upsellBlock.before(panel);
      return;
    }

    findInsertionPoint().append(panel);
  }

  function fetchText(url) {
    const target = new URL(url, window.location.href);
    const isAlzaApi = target.hostname.endsWith("alza.sk") && target.pathname.includes("/priceGuarantee/");

    if (isAlzaApi) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, FETCH_TIMEOUT_MS);

      return fetch(target.href, {
        credentials: "include",
        signal: controller.signal,
        headers: {
          "accept": "text/html,application/json,*/*;q=0.8"
        }
      })
        .then(async (response) => ({
          ok: response.ok,
          status: response.status,
          url: response.url,
          text: await response.text()
        }))
        .catch((error) => ({
          ok: false,
          status: 0,
          url: target.href,
          error: error.name === "AbortError" ? "Request timed out" : error.message
        }))
        .finally(() => {
          window.clearTimeout(timeoutId);
        });
    }

    return chrome.runtime.sendMessage({
      type: "alza-checker:fetch-text",
      url: target.href
    });
  }

  function fetchSearchRequest(request) {
    return chrome.runtime.sendMessage({
      type: "alza-checker:fetch-text",
      url: request.url,
      method: request.method,
      body: request.body
    });
  }

  function getVisibleSupportedShops() {
    const roots = Array.from(document.querySelectorAll(SELECTORS.guaranteeRoots))
      .filter((element) => !element.closest("#alza-checker-root"));
    const domains = new Set();

    for (const root of roots) {
      for (const domain of shared.parseSupportedShopsFromText(root.textContent)) {
        domains.add(domain);
      }
    }

    for (const element of Array.from(document.querySelectorAll(SELECTORS.optionItems))) {
      if (element.closest("#alza-checker-root")) {
        continue;
      }

      const text = shared.normalizeWhitespace(element.textContent);
      const parsed = shared.parseSupportedShopsFromText(text);

      if (parsed.length === 1) {
        domains.add(parsed[0]);
      }
    }

    return Array.from(domains).sort();
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  async function readShopsFromGuaranteeDialog() {
    const existingDialog = document.querySelector('[role="dialog"]');
    const trigger = document.querySelector(SELECTORS.guaranteeTrigger);

    if (!existingDialog && trigger instanceof HTMLElement) {
      trigger.click();
      await wait(600);
    }

    const combobox = document.querySelector(SELECTORS.combobox);

    if (combobox instanceof HTMLElement) {
      combobox.click();
      await wait(400);
    }

    const shops = getVisibleSupportedShops();

    if (!existingDialog) {
      const closeButton = document.querySelector(SELECTORS.closeButton);

      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    }

    return shops;
  }

  async function loadSupportedShops() {
    const visible = getVisibleSupportedShops();

    if (visible.length > 0) {
      return visible;
    }

    const apiUrls = getGuaranteeApiUrls();

    for (const apiUrl of apiUrls) {
      const response = await fetchText(apiUrl);

      if (!response.ok || !response.text) {
        continue;
      }

      const shops = shared.parseSupportedShopsFromText(response.text);

      if (shops.length > 0) {
        return shops;
      }
    }

    return readShopsFromGuaranteeDialog();
  }

  function renderStatus(text) {
    document.querySelector("#alza-checker-status").textContent = text;
  }

  function createExternalLink(href, text) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = text;

    return link;
  }

  function getBestResult(results) {
    return results
      .filter((result) => result.price)
      .sort((a, b) => a.price.value - b.price.value)[0] || null;
  }

  function renderSummary(results) {
    const summary = document.querySelector("#alza-checker-summary");
    const bestResult = getBestResult(results);

    summary.replaceChildren();
    summary.hidden = results.length === 0;

    if (bestResult) {
      const label = document.createElement("div");
      label.className = "alza-checker-summary-label";
      label.textContent = "Najlepsia zhoda";

      const title = document.createElement("div");
      title.className = "alza-checker-summary-title";

      if (bestResult.url) {
        title.append(createExternalLink(bestResult.url, `${bestResult.domain}: ${bestResult.title || "Produkt"}`));
      } else {
        title.textContent = bestResult.domain;
      }

      const price = document.createElement("div");
      price.className = "alza-checker-summary-price";
      price.textContent = bestResult.price.text;

      summary.append(label, title, price);
      return;
    }

    summary.textContent = results.length > 0 ? "Zatial bez presnej zhody." : "Pripravene na kontrolu konkurencie.";
  }

  function renderToggle() {
    const root = document.querySelector("#alza-checker-root");
    const toggle = document.querySelector("#alza-checker-toggle");

    root.classList.toggle("alza-checker-root--expanded", state.isExpanded);
    toggle.hidden = state.isRunning || state.results.length === 0;
    toggle.textContent = state.isExpanded ? "Skryt obchody" : `Zobrazit obchody (${state.results.length})`;
  }

  function renderResults(results) {
    const list = document.querySelector("#alza-checker-results");

    state.results = results;
    list.replaceChildren();
    renderSummary(results);
    renderToggle();

    for (const result of results) {
      const row = document.createElement("li");
      row.className = `alza-checker-row alza-checker-row--${result.state || "unknown"}`;

      const shop = document.createElement("div");
      shop.className = "alza-checker-shop";
      shop.textContent = result.domain;

      const price = document.createElement("div");
      price.className = "alza-checker-price";
      price.textContent = result.price ? result.price.text : "Nenajdene";

      const detail = document.createElement("div");
      detail.className = "alza-checker-detail";

      if (result.url && result.price) {
        detail.append(createExternalLink(result.url, result.title || "Produkt"));
      } else if (result.searchUrl) {
        detail.append(createExternalLink(result.searchUrl, "Otvorit vyhladavanie"));
      } else {
        detail.textContent = result.message || "Nepodarilo sa nacitat obchod.";
      }

      row.append(shop, price, detail);
      list.append(row);
    }
  }

  async function checkShop(domain, productName) {
    const searchQueries = shared.buildSearchQueries(productName);
    const searchRequests = searchQueries.flatMap((query) => shared.buildSearchRequests(domain, query));
    let lastFailure = null;

    for (const searchRequest of searchRequests) {
      const response = await fetchSearchRequest(searchRequest);

      if (!response.ok || !response.text) {
        lastFailure = response.error || `HTTP ${response.status}`;
        continue;
      }

      const candidates = shared.extractProductCandidates(response.text, response.url || searchRequest.displayUrl, productName);

      if (candidates.length > 0) {
        return {
          domain,
          searchUrl: searchRequest.displayUrl,
          state: "found",
          ...candidates[0]
        };
      }
    }

    return {
      domain,
      searchUrl: searchRequests[0]?.displayUrl,
      state: "missing",
      message: lastFailure || "Nenasla sa zhoda s cenou."
    };
  }

  function createFailedShopResult(domain, error) {
    return {
      domain,
      state: "missing",
      message: error.message || "Nepodarilo sa skontrolovat obchod."
    };
  }

  async function runCheck(button) {
    if (state.isRunning) {
      return;
    }

    const productName = getProductName();

    if (!productName) {
      renderStatus("Neviem precitat nazov produktu z Alzy.");
      return;
    }

    state.isRunning = true;
    state.isExpanded = true;
    state.results = [];
    button.disabled = true;
    renderStatus("Nacitavam podporovane obchody...");
    renderResults([]);

    try {
      state.shops = shared.mergeDefaultSearchShops(await loadSupportedShops());

      if (state.shops.length === 0) {
        renderStatus("Nenasiel som obchody na kontrolu. Otvor Garancia najlepsej ceny na Alze a skus znova.");
        return;
      }

      const results = [];

      for (const domain of state.shops) {
        renderStatus(`Kontrolujem ${domain} (${results.length + 1}/${state.shops.length})...`);
        let result;

        try {
          result = await checkShop(domain, productName);
        } catch (error) {
          result = createFailedShopResult(domain, error);
        }

        results.push(result);
        renderResults(results);
      }

      renderToggle();
      renderStatus(`Hotovo. Skontrolovane obchody: ${state.shops.length}.`);
    } catch (error) {
      renderStatus(`Chyba: ${error.message}`);
    } finally {
      state.isRunning = false;
      button.disabled = false;
      renderToggle();
    }
  }

  function createPanel() {
    const root = document.createElement("section");
    root.id = "alza-checker-root";

    const title = document.createElement("div");
    title.className = "alza-checker-title";
    title.textContent = "Kontrola najlepsej ceny";

    const meta = document.createElement("div");
    meta.className = "alza-checker-meta";
    const price = getAlzaPrice();
    const productName = getProductName();
    meta.textContent = price ? `Alza: ${price.text}` : "Cena Alza: nezistena";

    const query = document.createElement("div");
    query.className = "alza-checker-query";
    query.textContent = productName ? `Hladam: ${productName}` : "Nazov produktu: nezisteny";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "alza-checker-button";
    button.textContent = "Skontrolovat konkurenciu";
    button.addEventListener("click", () => runCheck(button));

    const status = document.createElement("div");
    status.id = "alza-checker-status";
    status.className = "alza-checker-status";
    status.textContent = "Pripravene.";

    const list = document.createElement("ul");
    list.id = "alza-checker-results";
    list.className = "alza-checker-results";

    const summary = document.createElement("div");
    summary.id = "alza-checker-summary";
    summary.className = "alza-checker-summary";
    summary.hidden = true;

    const toggle = document.createElement("button");
    toggle.id = "alza-checker-toggle";
    toggle.type = "button";
    toggle.className = "alza-checker-toggle";
    toggle.hidden = true;
    toggle.addEventListener("click", () => {
      state.isExpanded = !state.isExpanded;
      renderToggle();
    });

    root.append(title, meta, query, button, summary, status, toggle, list);
    return root;
  }

  insertPanel(createPanel());
})();
