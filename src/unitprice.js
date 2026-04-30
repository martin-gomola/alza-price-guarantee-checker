(async function runUnitPrice() {
  const settingsApi = window.AlzaCheckerSettings;
  if (settingsApi) {
    const settings = await settingsApi.getSettings();
    if (!settings.unitPriceEnabled) return;
  }

  const UNIT_PRICE_ATTR = "data-alza-unitprice";
  const PROCESSED_ATTR = "data-alza-unitprice-processed";
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;

  const MULTI_PATTERN = /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i;
  const PIECES_PATTERN = /(\d+)\s*(?:dielikov|dielov|dílků|dílů|pieces|pcs|ks)\b/i;
  const QUANTITY_PATTERNS = [
    { regex: /(\d+(?:[.,]\d+)?)\s*kg\b/i, unit: "kg" },
    { regex: /(\d+(?:[.,]\d+)?)\s*g\b/i, unit: "g" },
    { regex: /(\d+(?:[.,]\d+)?)\s*l\b/i, unit: "l" },
    { regex: /(\d+(?:[.,]\d+)?)\s*ml\b/i, unit: "ml" }
  ];

  function parseNum(value) {
    return Number.parseFloat(String(value).replace(",", "."));
  }

  function extractQuantity(text) {
    const s = String(text || "");

    const multi = s.match(MULTI_PATTERN);
    if (multi) {
      return { amount: parseNum(multi[1]) * parseNum(multi[2]), unit: multi[3].toLowerCase() };
    }

    for (const { regex, unit } of QUANTITY_PATTERNS) {
      const m = s.match(regex);
      if (m) {
        const amount = parseNum(m[1]);
        if (amount > 0) {
          return { amount, unit };
        }
      }
    }

    const pieces = s.match(PIECES_PATTERN);
    if (pieces) {
      const amount = parseNum(pieces[1]);
      if (amount >= 10) {
        return { amount, unit: "pcs" };
      }
    }

    return null;
  }

  function toBase(amount, unit) {
    switch (unit) {
      case "kg": return { value: amount, label: "kg" };
      case "g": return { value: amount / 1000, label: "kg" };
      case "l": return { value: amount, label: "l" };
      case "ml": return { value: amount / 1000, label: "l" };
      case "pcs": return { value: amount, label: "ks", perPiece: true };
      default: return null;
    }
  }

  const MAX_SENSIBLE_UNIT_PRICE = 200;
  const isCzLocale = /alza\.cz/i.test(window.location.hostname);
  const currencySymbol = isCzLocale ? "K\u010d" : "\u20ac";
  const currencyLocale = isCzLocale ? "cs-CZ" : "sk-SK";

  function computeUnitPrice(price, quantity) {
    if (!quantity || !price || price <= 0) return null;
    const base = toBase(quantity.amount, quantity.unit);
    if (!base || base.value <= 0) return null;
    const perUnit = price / base.value;
    if (!Number.isFinite(perUnit) || perUnit <= 0) return null;

    if (!base.perPiece && perUnit > MAX_SENSIBLE_UNIT_PRICE) return null;

    let text;
    if (base.perPiece) {
      if (isCzLocale) {
        text = `${perUnit.toFixed(2).replace(".", ",")} K\u010d/ks (${Math.round(base.value)} ks)`;
      } else {
        const cents = perUnit * 100;
        text = cents < 100
          ? `${cents.toFixed(1).replace(".", ",")} ct/ks (${Math.round(base.value)} ks)`
          : `${perUnit.toFixed(2).replace(".", ",")} \u20ac/ks (${Math.round(base.value)} ks)`;
      }
    } else {
      text = perUnit < 100
        ? `${perUnit.toFixed(2).replace(".", ",")} ${currencySymbol}/1 ${base.label}`
        : `${Math.round(perUnit).toLocaleString(currencyLocale)} ${currencySymbol}/1 ${base.label}`;
    }

    return { value: perUnit, text };
  }

  function extractFirstPrice(text) {
    const m = String(text || "").match(/(\d[\d\s]*(?:,\d{1,2})?)\s*(?:\u20ac|K\u010d|CZK)/i);
    if (!m) return null;
    const value = parseNum(m[1].replace(/\s/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

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
      if (!priceEl.textContent.includes(currencySymbol)) continue;
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
      const hasPrice = fallback.textContent.includes(currencySymbol);
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
        !text.includes(currencySymbol) &&
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
      if (!text.includes(currencySymbol)) continue;
      if (/\/1?\s*(kg|l|ks|g|ml)\b/.test(text)) continue;

      const price = extractFirstPrice(text);
      if (!price) continue;

      const isPrimary = /price-box__price|c2|prc|our-price/i.test(el.className || "");
      if (isPrimary) return { price, element: el };

      if (!firstMatch) firstMatch = { price, element: el };
    }

    if (firstMatch) return firstMatch;

    const fallbackPrice = extractFirstPrice(card.textContent);
    return fallbackPrice ? { price: fallbackPrice, element: null } : null;
  }

  function hasExistingUnitPrice(card) {
    return /\d+[.,]\d+\s*(?:€|Kč|CZK)\s*\/\s*1?\s*(kg|l|ks|g|ml)\b/i.test(card.textContent);
  }

  function processCard(card) {
    card.setAttribute(PROCESSED_ATTR, "");

    if (card.querySelector(`[${UNIT_PRICE_ATTR}]`)) return;
    if (hasExistingUnitPrice(card)) return;

    const title = getCardTitle(card);
    const desc = getCardDescription(card);
    const quantity = extractQuantity(title) || extractQuantity(desc);

    if (!quantity) return;

    const priceInfo = getCardPrice(card);
    if (!priceInfo) return;

    const unitPrice = computeUnitPrice(priceInfo.price, quantity);
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
        const price = extractFirstPrice(el.textContent);
        if (price) return price;
      }
    }

    const priceArea = document.querySelector(
      "[data-testid='price-primary'], .price-detail__price-box-wrapper, .price-detail, .pricenormal"
    );
    if (!priceArea) return null;

    for (const child of priceArea.children) {
      if (child.querySelector(`[${UNIT_PRICE_ATTR}]`)) continue;
      const price = extractFirstPrice(child.textContent);
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

    const quantity = extractQuantity(title) || extractQuantity(desc);
    if (!quantity) return;

    const price = getDetailPrice();
    if (!price) return;

    const unitPrice = computeUnitPrice(price, quantity);
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
