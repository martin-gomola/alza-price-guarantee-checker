(async function runAlzaChecker() {
  const shared = window.AlzaCheckerShared;
  const settingsApi = window.AlzaCheckerSettings;

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

  function getLocale() {
    return /alza\.cz/i.test(window.location.hostname) ? "cz" : "sk";
  }

  function getAlzaPrice() {
    const mainPrice = document.querySelector(
      '.price-box__price, [data-testid="price-primary"] .price-box__price, .ads-pb--big [data-slot="pb-inner"], .js-price-box .prc'
    );
    if (mainPrice) {
      const price = shared.parsePrice(mainPrice.textContent);
      if (price) return price;
    }

    const priceArea = document.querySelector(SELECTORS.priceArea);
    return shared.parsePrice(priceArea?.textContent || document.body.textContent);
  }

  function getGuaranteeApiUrls() {
    const urls = new Set();

    for (const element of document.querySelectorAll("[data-api-url]")) {
      const value = element.getAttribute("data-api-url");

      if (value?.toLowerCase().includes("priceguarantee")) {
        const url = new URL(value, window.location.href).href;
        urls.add(url);

        if (!url.includes("/dialog")) {
          urls.add(url.replace(/\/priceGuarantee\/[^?]+/i, "/priceGuarantee/dialog"));
        }
      }
    }

    return [...urls].sort((a, b) => {
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

  async function fetchText(url) {
    const target = new URL(url, window.location.href);
    const isAlzaApi = target.hostname.endsWith("alza.sk") && target.pathname.includes("/priceGuarantee/");

    if (!isAlzaApi) {
      return chrome.runtime.sendMessage({
        type: "alza-checker:fetch-text",
        url: target.href
      });
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(target.href, {
        credentials: "include",
        signal: controller.signal,
        headers: { accept: "text/html,application/json,*/*;q=0.8" }
      });

      return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        text: await response.text()
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        url: target.href,
        error: error.name === "AbortError" ? "Request timed out" : error.message
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
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
    const roots = [...document.querySelectorAll(SELECTORS.guaranteeRoots)]
      .filter((element) => !element.closest("#alza-checker-root"));
    const domains = new Set();

    for (const root of roots) {
      for (const domain of shared.parseSupportedShopsFromText(root.textContent)) {
        domains.add(domain);
      }
    }

    for (const element of document.querySelectorAll(SELECTORS.optionItems)) {
      if (element.closest("#alza-checker-root")) {
        continue;
      }

      const text = shared.normalizeWhitespace(element.textContent);
      const parsed = shared.parseSupportedShopsFromText(text);

      if (parsed.length === 1) {
        domains.add(parsed[0]);
      }
    }

    return [...domains].sort();
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
        title.append(createExternalLink(bestResult.url, `${bestResult.domain}: ${shared.decodeHtml(bestResult.title) || "Produkt"}`));
      } else {
        title.textContent = bestResult.domain;
      }

      const price = document.createElement("div");
      price.className = "alza-checker-summary-price";
      price.textContent = bestResult.price.text;

      summary.append(label, title, price);
      return;
    }

    summary.textContent = results.length > 0 ? "Automaticke porovnanie nenaslo zhodu. Skontrolujte manualne." : "Pripravene na kontrolu konkurencie.";
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

      const detail = document.createElement("div");
      detail.className = "alza-checker-detail";

      if (result.state === "found" && result.price) {
        price.textContent = result.price.text;
        if (result.url) {
          detail.append(createExternalLink(result.url, shared.decodeHtml(result.title) || "Produkt"));
        }
      } else if (result.state === "manual" && result.searchUrl) {
        price.textContent = "";
        if (result.message) {
          const message = document.createElement("div");
          message.className = "alza-checker-manual-note";
          message.textContent = result.message;
          detail.append(message);
        }

        const link = createExternalLink(result.searchUrl, `Skontrolovat na ${result.domain}`);
        link.className = "alza-checker-search-btn";
        detail.append(link);
      } else {
        price.textContent = "";
        detail.className = "alza-checker-detail alza-checker-detail--error";
        detail.textContent = result.message || "Nepodarilo sa nacitat obchod.";
      }

      row.append(shop, price, detail);
      list.append(row);
    }
  }

  const VERIFY_PRICE_DOMAINS = new Set([
    "4kids.sk",
    "abc-zoo.sk",
    "alltoys.sk",
    "benulekaren.sk",
    "decathlon.sk",
    "dracik.sk",
    "drmax.sk",
    "hudysport.sk",
    "istores.sk",
    "istyle.sk",
    "kytary.sk",
    "nay.sk",
    "petcenter.sk",
    "planeo.sk",
    "pompo.sk",
    "profizoo.sk",
    "smarty.sk",
    "spokojnypes.sk",
    "superzoo.sk",
    "tetadrogerie.sk",
    "czc.cz",
    "datart.cz",
    "decathlon.cz",
    "drmax.cz",
    "kasa.cz",
    "mall.cz",
    "mironet.cz",
    "notino.cz",
    "pilulka.cz",
    "sportisimo.cz",
    "tsbohemia.cz"
  ]);

  async function verifyPriceFromDetailPage(candidate, productName) {
    if (!candidate.url || shared.isBlockedProductUrl(candidate.url)) {
      return candidate;
    }

    const response = await fetchSearchRequest({
      url: candidate.url,
      displayUrl: candidate.url,
      method: "GET"
    });

    if (!response.ok || !response.text) {
      return candidate;
    }

    const [detail] = shared.extractProductCandidates(response.text, response.url || candidate.url, productName);

    if (detail?.price) {
      return {
        ...candidate,
        title: detail.title || candidate.title,
        price: detail.price,
        url: detail.url || candidate.url
      };
    }

    return candidate;
  }

  async function checkShop(domain, productName) {
    const searchQueries = shared.buildSearchQueries(productName);
    const searchRequests = searchQueries.flatMap((query) => shared.buildSearchRequests(domain, query));

    if (shared.isManualOnlyShop(domain)) {
      return {
        domain,
        searchUrl: searchRequests[0]?.displayUrl,
        state: "manual",
        message: shared.describeFetchFailure({ status: 403 })
      };
    }

    let lastFailure = null;
    let hadSuccessfulResponse = false;

    for (const searchRequest of searchRequests) {
      const response = await fetchSearchRequest(searchRequest);

      if (!response.ok || !response.text) {
        lastFailure = { status: response.status || 0, error: response.error || "" };
        continue;
      }

      hadSuccessfulResponse = true;
      const candidates = shared.extractProductCandidates(
        response.text,
        response.url || searchRequest.displayUrl,
        searchRequest.matchQuery || productName
      );

      if (candidates.length > 0) {
        let bestCandidate = candidates[0];

        if (VERIFY_PRICE_DOMAINS.has(domain) && bestCandidate.url) {
          bestCandidate = await verifyPriceFromDetailPage(bestCandidate, productName);
        }

        return {
          domain,
          searchUrl: searchRequest.displayUrl,
          state: "found",
          ...bestCandidate
        };
      }
    }

    if (hadSuccessfulResponse) {
      return {
        domain,
        searchUrl: searchRequests[0]?.displayUrl,
        state: "manual",
        message: shared.MANUAL_NO_MATCH_MESSAGE
      };
    }

    const failureMessage = lastFailure
      ? shared.describeFetchFailure(lastFailure)
      : "Nepodarilo sa nacitat obchod.";

    return {
      domain,
      searchUrl: searchRequests[0]?.displayUrl,
      state: searchRequests[0]?.displayUrl ? "manual" : "error",
      message: failureMessage
    };
  }

  function createFailedShopResult(domain, error) {
    return {
      domain,
      state: "error",
      message: shared.describeFetchFailure({ error: error?.message || "" })
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
      state.shops = shared.mergeDefaultSearchShops(await loadSupportedShops(), getLocale());
      const supportedShops = state.shops.filter((domain) => shared.hasSearchTemplate(domain));
      const unsupportedShops = state.shops.filter((domain) => !shared.hasSearchTemplate(domain));

      if (supportedShops.length === 0) {
        renderStatus("Nenasiel som obchody na kontrolu. Otvor Garancia najlepsej ceny na Alze a skus znova.");
        return;
      }

      const results = [];

      for (const domain of supportedShops) {
        renderStatus(`Kontrolujem ${domain} (${results.length + 1}/${supportedShops.length})...`);
        let result;

        try {
          result = await checkShop(domain, productName);
        } catch (error) {
          result = createFailedShopResult(domain, error);
        }

        results.push(result);
        renderResults(results);
      }

      for (const domain of unsupportedShops) {
        results.push({
          domain,
          state: "manual",
          searchUrl: `https://${domain}`
        });
      }
      renderResults(results);

      renderToggle();
      renderStatus(`Hotovo. Skontrolovane obchody: ${supportedShops.length}.`);
    } catch (error) {
      renderStatus(`Chyba: ${error.message}`);
    } finally {
      state.isRunning = false;
      button.disabled = false;
      renderToggle();
    }
  }

  function el(tag, props = {}) {
    const element = document.createElement(tag);
    Object.assign(element, props);
    return element;
  }

  function createPanel() {
    const price = getAlzaPrice();
    const productName = getProductName();

    const root = el("section", { id: "alza-checker-root" });
    const title = el("div", { className: "alza-checker-title", textContent: "Kontrola najlepsej ceny" });
    const meta = el("div", { className: "alza-checker-meta", textContent: price ? `Alza: ${price.text}` : "Cena Alza: nezistena" });
    const query = el("div", { className: "alza-checker-query", textContent: productName ? `Hladam: ${productName}` : "Nazov produktu: nezisteny" });
    const status = el("div", { id: "alza-checker-status", className: "alza-checker-status", textContent: "Pripravene." });
    const list = el("ul", { id: "alza-checker-results", className: "alza-checker-results" });
    const summary = el("div", { id: "alza-checker-summary", className: "alza-checker-summary", hidden: true });

    const button = el("button", { type: "button", className: "alza-checker-button", textContent: "Skontrolovat konkurenciu" });
    button.addEventListener("click", () => runCheck(button));

    const toggle = el("button", { id: "alza-checker-toggle", type: "button", className: "alza-checker-toggle", hidden: true });
    toggle.addEventListener("click", () => {
      state.isExpanded = !state.isExpanded;
      renderToggle();
    });

    root.append(title, meta, query, button, summary, status, toggle, list);
    return root;
  }

  if (getLocale() === "cz") {
    shared.setDefaultCurrency("CZK");
  }

  const isProductPage = Boolean(
    document.querySelector(SELECTORS.insertionPoint) ||
    document.querySelector(SELECTORS.buyActions) ||
    document.querySelector(SELECTORS.guaranteeTrigger)
  );

  if (isProductPage) {
    insertPanel(createPanel());
    addCopyTitleButton();
  }

  function addCopyTitleButton() {
    const h1 = document.querySelector(SELECTORS.h1);
    if (!h1 || h1.querySelector(".alza-checker-copy-btn")) return;

    const btn = el("button", { type: "button", className: "alza-checker-copy-btn", title: "Kopírovať názov" });
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
    btn.addEventListener("click", async () => {
      const name = getProductName();
      if (!name) return;
      await navigator.clipboard.writeText(name);
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
      }, 1500);
    });

    h1.style.position = "relative";
    h1.append(btn);
  }
})();
