(function attachShared(root) {
  const shopCatalog = root.AlzaCheckerShopCatalog || (typeof require !== "undefined" ? require("./shop-catalog.js") : null);

  const STOP_WORDS = new Set([
    "a",
    "aj",
    "ak",
    "bez",
    "do",
    "g",
    "kg",
    "ks",
    "na",
    "nebo",
    "od",
    "po",
    "pro",
    "pre",
    "s",
    "se",
    "v",
    "ve",
    "z",
    "ze"
  ]);

  const ALLOWED_TLDS = new Set([".sk", ".cz"]);

  const TOKEN_SYNONYMS = {
    kvasnice: ["yeast"],
    pivovarske: ["brewer", "brewers"]
  };

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function stripDiacritics(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function tokenizeBase(value) {
    return stripDiacritics(value)
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => (token.length > 1 || /^\d+$/.test(token)) && !STOP_WORDS.has(token));
  }

  function tokenize(value) {
    const tokens = tokenizeBase(value);
    const expanded = [];

    for (const token of tokens) {
      expanded.push(token);
      expanded.push(...(TOKEN_SYNONYMS[token] || []));
    }

    return [...new Set(expanded)];
  }

  function parseEuroPrices(text) {
    const matches = String(text || "").matchAll(/(?<![a-z0-9-])(\d{1,4}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*\u20ac/gi);
    const prices = [];

    for (const match of matches) {
      const normalized = match[1].replace(/[\s.]/g, "").replace(",", ".");
      const value = Number.parseFloat(normalized);

      if (Number.isFinite(value) && value > 0) {
        prices.push({
          value,
          text: `${match[1].replace(/\s+/g, " ")} \u20ac`
        });
      }
    }

    return prices;
  }

  function parseEuroPrice(text) {
    return parseEuroPrices(text)[0] || null;
  }

  function formatEuroPrice(value) {
    return `${String(value).replace(".", ",")} \u20ac`;
  }

  function parseCzkPrices(text) {
    const prices = [];

    for (const match of String(text || "").matchAll(/(?<![a-z0-9-])(\d{1,6}(?:[\s.]\d{3})*(?:[,.]\d{1,2})?)\s*(?:K\u010d|CZK)/gi)) {
      const normalized = match[1].replace(/[\s.]/g, "").replace(",", ".");
      const value = Number.parseFloat(normalized);

      if (Number.isFinite(value) && value > 0) {
        prices.push({
          value,
          text: `${match[1].replace(/\s+/g, " ")} K\u010d`
        });
      }
    }

    for (const match of String(text || "").matchAll(/(?<![a-z0-9-])(\d{1,6}(?:[\s\u00a0.]\d{3})*)\s*,-/g)) {
      const normalized = match[1].replace(/[\s\u00a0.]/g, "");
      const value = Number.parseFloat(normalized);

      if (Number.isFinite(value) && value > 0 && value >= 10) {
        prices.push({
          value,
          text: `${match[1].replace(/\s+/g, " ")} K\u010d`
        });
      }
    }

    return prices;
  }

  function parseCzkPrice(text) {
    return parseCzkPrices(text)[0] || null;
  }

  function formatCzkPrice(value) {
    const rounded = Math.round(value) === value ? String(value) : String(value).replace(".", ",");
    return `${rounded} K\u010d`;
  }

  function detectCurrency(text) {
    const str = String(text || "");
    if (/K\u010d|CZK/i.test(str)) return "CZK";
    if (/\u20ac/.test(str)) return "EUR";
    return null;
  }

  function parsePrices(text) {
    return [...parseEuroPrices(text), ...parseCzkPrices(text)];
  }

  function parsePrice(text) {
    return parseEuroPrice(text) || parseCzkPrice(text);
  }

  function formatPrice(value, currency) {
    return currency === "CZK" ? formatCzkPrice(value) : formatEuroPrice(value);
  }

  let defaultCurrency = "EUR";

  function setDefaultCurrency(currency) {
    defaultCurrency = currency === "CZK" ? "CZK" : "EUR";
  }

  function parsePriceValue(value) {
    const normalized = normalizeWhitespace(value);

    if (!normalized) {
      return null;
    }

    if (normalized.includes("\u20ac")) {
      return parseEuroPrice(normalized);
    }

    if (/K\u010d|CZK/i.test(normalized) || /,-\s*$/.test(normalized)) {
      return parseCzkPrice(normalized);
    }

    const number = Number.parseFloat(normalized.replace(/\s/g, "").replace(",", "."));

    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }

    return {
      value: number,
      text: formatPrice(number, defaultCurrency)
    };
  }

  const PRICE_SUFFIX = /(?:\u20ac|K\u010d|CZK)/i;
  const SHIPPING_NEARBY = /(doprava|postovne|poštovne|postovn[eé]|doručen)/;
  const NOISE_NEARBY = /(doprava|postovne|poštovne|postovn[eé]|doručen|usetrite|ušetr|usetř|zlav|zlava|slev|splát|splat|mesacne|mesačne|měsíčn)/;

  function parseProductPrice(text) {
    const normalized = normalizeWhitespace(text);
    const preferredPatterns = [
      /\b(?:cena\s+od)\s*(\d{1,6}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*(?:\u20ac|K\u010d|CZK)/i,
      /\b(?:cena|predajna\s+cena|prodejn[ií]\s+cena)\s*:?\s*(\d{1,6}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*(?:\u20ac|K\u010d|CZK)/i
    ];

    for (const pattern of preferredPatterns) {
      const match = normalized.match(pattern);

      if (match) {
        return parsePrice(`${match[1]} ${detectCurrencySuffix(normalized)}`);
      }
    }

    for (const match of normalized.matchAll(/\bod\s*(\d{1,6}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*(?:\u20ac|K\u010d|CZK)/gi)) {
      const nearby = stripDiacritics(normalized.slice(Math.max(0, match.index - 30), match.index + match[0].length + 20));

      if (!SHIPPING_NEARBY.test(nearby)) {
        return parsePrice(`${match[1]} ${detectCurrencySuffix(match[0])}`);
      }
    }

    const prices = parsePrices(normalized);

    if (prices.length <= 1) {
      return prices[0] || null;
    }

    const safePrices = prices.filter((price) => {
      const index = normalized.indexOf(price.text);
      const nearby = stripDiacritics(normalized.slice(Math.max(0, index - 18), index + price.text.length + 12));

      return !NOISE_NEARBY.test(nearby);
    });

    const candidates = safePrices.length > 0 ? safePrices : prices;

    return candidates.slice().sort((a, b) => a.value - b.value)[0] || null;
  }

  function detectCurrencySuffix(text) {
    if (/K\u010d|CZK/i.test(text)) return "K\u010d";
    return "\u20ac";
  }

  function parseSupportedShopsFromText(text) {
    const domains = new Set();
    const normalizedText = String(text || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:#46|period);/gi, ".")
      .replace(/\\u002e/gi, ".")
      .replace(/([a-z0-9])\s+\.\s*([a-z])/gi, "$1.$2")
      .replace(/([a-z0-9])\s*\.\s+([a-z])/gi, "$1.$2")
      .toLowerCase()
      .replace(/(\.(?:sk|cz))(?=[a-z0-9-]+\.)/g, "$1 ");
    const matches = normalizedText.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g);

    for (const match of matches) {
      let domain = match[0].replace(/^www\./, "");
      const tld = "." + domain.split(".").pop();
      if (!ALLOWED_TLDS.has(tld)) continue;

      const parts = domain.split(".");
      if (parts.length > 2) {
        domain = parts.slice(-2).join(".");
      }

      domain = normalizeShopDomain(domain);
      if (/alza\./i.test(domain)) continue;

      domains.add(domain);
    }

    return [...domains].sort();
  }

  function normalizeShopDomain(domain) {
    return shopCatalog?.normalizeDomain(domain) || domain;
  }

  function cleanProductName(value) {
    return normalizeWhitespace(value)
      .replace(/\s+[-|]\s+Alza\.(?:sk|cz).*$/i, "")
      .replace(/^(doplnok stravy pre (psov|macky|ma\u010dky)|krmivo pre (psov|macky|ma\u010dky)|chovatelske potreby|chovate\u013esk\u00e9 potreby)\s+/i, "")
      .replace(/^(doplněk stravy pro (psy|kočky)|krmivo pro (psy|kočky)|chovatelské potřeby)\s+/i, "")
      .replace(/\b\d+\s*x\s*/gi, "")
      .trim();
  }


  function decodeHtml(value) {
    return String(value || "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#x3D;/gi, "=")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }


  function isBotChallengePage(text) {
    const sample = String(text || "").slice(0, 12000).toLowerCase();

    return (
      sample.includes("client challenge") ||
      sample.includes("bobcmn") ||
      sample.includes("failureconfig") ||
      /\/tspd\//i.test(sample) ||
      sample.includes("_fs-ch-")
    );
  }

  function describeFetchFailure({ status = 0, error = "" } = {}) {
    const normalizedError = String(error || "").toLowerCase();

    if (status === 403 || status === 401 || status === 429 || String(error || "").toLowerCase().includes("bot_challenge")) {
      return "Obchod blokuje automaticku kontrolu. Overte cenu priamo na obchode.";
    }

    if (status >= 500 && status < 600) {
      return "Obchod je docasne nedostupny. Skuste to priamo na obchode.";
    }

    if (normalizedError.includes("timed out") || normalizedError.includes("abort")) {
      return "Kontrola trvala prilis dlho. Skuste to priamo na obchode.";
    }

    if (status === 0 || normalizedError.includes("failed to fetch") || normalizedError.includes("network")) {
      return "Nepodarilo sa spojit s obchodom. Skuste to priamo na obchode.";
    }

    return "Automaticka kontrola nie je dostupna. Overte cenu priamo na obchode.";
  }

  const MANUAL_NO_MATCH_MESSAGE = "Nenasla sa zhodna ponuka. Skontrolujte vyhladavanie na obchode.";

  const api = {
    cleanProductName,
    decodeHtml,
    describeFetchFailure,
    formatPrice,
    isBotChallengePage,
    MANUAL_NO_MATCH_MESSAGE,
    normalizeWhitespace,
    parseEuroPrice,
    parseEuroPrices,
    parseCzkPrice,
    parseCzkPrices,
    parsePrice,
    parsePriceValue,
    parsePrices,
    parseProductPrice,
    parseSupportedShopsFromText,
    detectCurrency,
    stripDiacritics,
    tokenize,
    tokenizeBase,
    setDefaultCurrency
  };

  root.AlzaCheckerShared = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
