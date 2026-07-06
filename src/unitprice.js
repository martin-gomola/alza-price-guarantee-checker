(async function runUnitPrice() {
  const settingsApi = window.AlzaCheckerSettings;
  const calculatorApi = window.AlzaCheckerUnitPriceCalculator;
  if (!calculatorApi) return;

  if (settingsApi) {
    const settings = await settingsApi.getSettings();
    if (!settings.unitPriceEnabled) return;
  }

  const UNIT_PRICE_ATTR = "data-alza-unitprice";
  const PROCESSED_ATTR = "data-alza-unitprice-processed";
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;

  const calculator = calculatorApi.createUnitPriceCalculator({
    locale: /alza\.cz/i.test(window.location.hostname) ? "cz" : "sk"
  });

  function createLabel(unitPrice) {
    const el = document.createElement("span");
    el.className = "alza-checker-unit-price";
    el.setAttribute(UNIT_PRICE_ATTR, "");
    el.textContent = unitPrice.text;
    return el;
  }

  function findProductCards() {
    const cards = new Set();

    const priceElements = document.querySelectorAll(
      "[class*='price' i], [class*='Price'], [data-testid*='price' i]"
    );

    for (const priceEl of priceElements) {
      if (!calculator.hasPriceText(priceEl.textContent)) continue;
      if (priceEl.closest(`[${UNIT_PRICE_ATTR}]`)) continue;

      const card = findCardAncestor(priceEl);
      if (card && !card.hasAttribute(PROCESSED_ATTR)) {
        cards.add(card);
      }
    }

    return cards;
  }

  function findCardAncestor(el) {
    let node = el;
    for (let i = 0; i < 8; i++) {
      node = node.parentElement;
      if (!node || node === document.body) return null;

      const cls = String(node.className || "");
      const testId = node.getAttribute("data-testid") || "";
      const tag = node.tagName;

      if (
        /product|item|tile|card|box|listing|browsing/i.test(cls) ||
        /product|item|tile|card|box|listing|browsing/i.test(testId) ||
        (tag === "LI" && node.parentElement && /product|item|list|result/i.test(String(node.parentElement.className || ""))) ||
        (tag === "ARTICLE")
      ) {
        return node;
      }
    }

    let fallback = el;
    for (let i = 0; i < 5; i++) {
      fallback = fallback.parentElement;
      if (!fallback || fallback === document.body) return null;

      const links = fallback.querySelectorAll("a[href]");
      const hasTitle = [...links].some(a => a.textContent.trim().length > 10);
      const hasPrice = calculator.hasPriceText(fallback.textContent);
      if (hasTitle && hasPrice) return fallback;
    }

    return null;
  }

  function getCardTitle(card) {
    const link = card.querySelector("a[href*='.htm']");
    if (link) {
      const title = (link.getAttribute("title") || link.textContent || "").trim();
      if (title.length > 5) return title;
    }

    const headings = card.querySelectorAll("h1, h2, h3, h4, a");
    for (const h of headings) {
      const text = h.textContent.trim();
      if (text.length > 10 && text.length < 200) return text;
    }
    return "";
  }

  function getCardDescription(card) {
    const candidates = card.querySelectorAll(
      "span, p, div, [class*='desc' i], [class*='comment' i], [class*='subtitle' i]"
    );
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (
        text.length > 10 && text.length < 300 &&
        !calculator.hasPriceText(text) &&
        /\d+\s*(g|kg|ml|l)\b/i.test(text)
      ) {
        return text;
      }
    }
    return "";
  }

  function getCardPrice(card) {
    const priceEls = card.querySelectorAll(
      "[class*='price' i], [class*='Price'], [data-testid*='price' i]"
    );

    let firstMatch = null;

    for (const el of priceEls) {
      const text = el.textContent;
      if (!calculator.hasPriceText(text)) continue;
      if (/\/1?\s*(kg|l|ks|g|ml)\b/.test(text)) continue;

      const price = calculator.extractFirstPrice(text);
      if (!price) continue;

      const isPrimary = /price-box__price|c2|prc|our-price/i.test(el.className || "");
      if (isPrimary) return { price, element: el };

      if (!firstMatch) firstMatch = { price, element: el };
    }

    if (firstMatch) return firstMatch;

    const fallbackPrice = calculator.extractFirstPrice(card.textContent);
    return fallbackPrice ? { price: fallbackPrice, element: null } : null;
  }

  function hasExistingUnitPrice(card) {
    return calculator.hasExistingUnitPrice(card.textContent);
  }

  function processCard(card) {
    card.setAttribute(PROCESSED_ATTR, "");

    if (card.querySelector(`[${UNIT_PRICE_ATTR}]`)) return;
    if (hasExistingUnitPrice(card)) return;

    const title = getCardTitle(card);
    const desc = getCardDescription(card);
    const quantity = calculator.extractQuantity(title) || calculator.extractQuantity(desc);

    if (!quantity) return;

    const priceInfo = getCardPrice(card);
    if (!priceInfo) return;

    const unitPrice = calculator.computeUnitPrice(priceInfo.price, quantity);
    if (!unitPrice) return;

    const label = createLabel(unitPrice);

    if (priceInfo.element) {
      priceInfo.element.after(label);
    } else {
      card.append(label);
    }
  }

  function processPage() {
    const cards = findProductCards();
    for (const card of cards) {
      processCard(card);
    }
  }

  function isDetailPage() {
    return Boolean(document.querySelector(".price-detail, #detailItem, [data-testid='detailItem']"));
  }

  function getDetailPrice() {
    const PRICE_SELECTORS = [
      '.price-box__price',
      '[data-testid="price-primary"] .price-box__price',
      '.ads-pb--big [data-slot="pb-inner"]',
      '.js-price-box .prc'
    ];

    for (const selector of PRICE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        const price = calculator.extractFirstPrice(el.textContent);
        if (price) return price;
      }
    }

    const priceArea = document.querySelector(
      "[data-testid='price-primary'], .price-detail__price-box-wrapper, .price-detail, .pricenormal"
    );
    if (!priceArea) return null;

    for (const child of priceArea.children) {
      if (child.querySelector(`[${UNIT_PRICE_ATTR}]`)) continue;
      const price = calculator.extractFirstPrice(child.textContent);
      if (price) return price;
    }

    return null;
  }

  function processDetailPage() {
    if (document.querySelector(`[${UNIT_PRICE_ATTR}]`)) return;

    const title = document.querySelector("#h1c h1, #h1c > h1, h1")?.textContent?.trim() ?? "";
    const descEl = document.querySelector(
      ".nameextc, [class*='nameExt'], [data-testid='productDescription'], .shortDesc"
    );
    const desc = descEl?.textContent?.trim() ?? "";

    const quantity = calculator.extractQuantity(title) || calculator.extractQuantity(desc);
    if (!quantity) return;

    const price = getDetailPrice();
    if (!price) return;

    const unitPrice = calculator.computeUnitPrice(price, quantity);
    if (!unitPrice) return;

    const label = createLabel(unitPrice);
    label.style.fontSize = "14px";
    label.style.padding = "2px 8px";

    const placementArea = document.querySelector(
      "[data-testid='price-primary'], .price-detail__price-box-wrapper, .price-detail, .pricenormal"
    );
    if (!placementArea) return;

    const secondaryPrice = placementArea.querySelector(
      ".js-secondary-price, [class*='secondary-price'], [class*='secondaryPrice']"
    );

    if (secondaryPrice) {
      secondaryPrice.replaceWith(label);
    } else {
      const priceEl = placementArea.querySelector(
        ".price-box__price, [class*='priceNormal'], .prc, [class*='price-box']"
      );
      const target = priceEl ?? placementArea.firstElementChild;
      if (target) {
        target.after(label);
      } else {
        placementArea.prepend(label);
      }
    }
  }

  function run() {
    if (isDetailPage()) {
      processDetailPage();
    } else {
      processPage();
    }

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isDetailPage()) {
          processDetailPage();
        } else {
          processPage();
        }
      }, DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
