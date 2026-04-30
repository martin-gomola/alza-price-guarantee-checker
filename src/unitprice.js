(function runUnitPrice() {
  const UNIT_PRICE_ATTR = "data-alza-unitprice";
  const PROCESSED_ATTR = "data-alza-unitprice-processed";
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;

  const MULTI_PATTERN = /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i;
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
    return null;
  }

  function toBase(amount, unit) {
    switch (unit) {
      case "kg": return { value: amount, label: "kg" };
      case "g": return { value: amount / 1000, label: "kg" };
      case "l": return { value: amount, label: "l" };
      case "ml": return { value: amount / 1000, label: "l" };
      default: return null;
    }
  }

  function computeUnitPrice(price, quantity) {
    if (!quantity || !price || price <= 0) return null;
    const base = toBase(quantity.amount, quantity.unit);
    if (!base || base.value <= 0) return null;
    const perUnit = price / base.value;
    if (!Number.isFinite(perUnit) || perUnit <= 0) return null;

    const text = perUnit < 100
      ? `${perUnit.toFixed(2).replace(".", ",")} \u20ac/1 ${base.label}`
      : `${Math.round(perUnit).toLocaleString("sk-SK")} \u20ac/1 ${base.label}`;

    return { value: perUnit, text };
  }

  function extractFirstPrice(text) {
    const m = String(text || "").match(/(\d[\d\s]*(?:,\d{1,2})?)\s*\u20ac/);
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
      if (!priceEl.textContent.includes("\u20ac")) continue;
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
      const hasTitle = Array.from(links).some(a => a.textContent.trim().length > 10);
      const hasPrice = fallback.textContent.includes("\u20ac");
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
        !text.includes("\u20ac") &&
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

    for (const el of priceEls) {
      const text = el.textContent;
      if (!text.includes("\u20ac")) continue;
      if (/\/1\s*(kg|l|ks)/.test(text)) continue;

      const price = extractFirstPrice(text);
      if (price) return { price, element: el };
    }

    const fallbackPrice = extractFirstPrice(card.textContent);
    return fallbackPrice ? { price: fallbackPrice, element: null } : null;
  }

  function processCard(card) {
    card.setAttribute(PROCESSED_ATTR, "");

    if (card.querySelector(`[${UNIT_PRICE_ATTR}]`)) return;

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
      priceInfo.element.parentElement.insertBefore(label, priceInfo.element.nextSibling);
    } else {
      card.appendChild(label);
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

  function processDetailPage() {
    if (document.querySelector(`[${UNIT_PRICE_ATTR}]`)) return;

    const titleEl = document.querySelector("#h1c h1, #h1c > h1, h1");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const descEl = document.querySelector(
      ".nameextc, [class*='nameExt'], [data-testid='productDescription'], .shortDesc"
    );
    const desc = descEl ? descEl.textContent.trim() : "";

    const quantity = extractQuantity(title) || extractQuantity(desc);
    if (!quantity) return;

    const priceArea = document.querySelector(
      "[data-testid='price-primary'], .price-detail__price-box-wrapper, .price-detail, .pricenormal"
    );
    if (!priceArea) return;

    const price = extractFirstPrice(priceArea.textContent);
    if (!price) return;

    const unitPrice = computeUnitPrice(price, quantity);
    if (!unitPrice) return;

    const label = createLabel(unitPrice);
    label.style.fontSize = "14px";
    label.style.padding = "2px 8px";

    const secondaryPrice = priceArea.querySelector(
      ".js-secondary-price, [class*='secondary-price'], [class*='secondaryPrice']"
    );

    if (secondaryPrice) {
      secondaryPrice.replaceWith(label);
    } else {
      const priceEl = priceArea.querySelector(
        ".price-box__price, [class*='priceNormal'], .prc, [class*='price-box']"
      );
      const insertAfter = priceEl || priceArea.firstElementChild;
      if (insertAfter) {
        insertAfter.parentElement.insertBefore(label, insertAfter.nextSibling);
      } else {
        priceArea.prepend(label);
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
