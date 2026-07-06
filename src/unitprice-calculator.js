(function attachUnitPriceCalculator(root) {
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

  function createUnitPriceCalculator({ locale = "sk" } = {}) {
    const isCzLocale = locale === "cz";
    const currencySymbol = isCzLocale ? "K\u010d" : "\u20ac";
    const currencyLocale = isCzLocale ? "cs-CZ" : "sk-SK";
    const maxSensibleUnitPrice = isCzLocale ? 5000 : 200;

    function hasPriceText(text) {
      const value = String(text || "");
      return value.includes(currencySymbol) || (isCzLocale && /\d\s*,-/.test(value));
    }

    function computeUnitPrice(price, quantity) {
      if (!quantity || !price || price <= 0) return null;
      const base = toBase(quantity.amount, quantity.unit);
      if (!base || base.value <= 0) return null;
      const perUnit = price / base.value;
      if (!Number.isFinite(perUnit) || perUnit <= 0) return null;

      if (!base.perPiece && perUnit > maxSensibleUnitPrice) return null;

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
      const s = String(text || "");
      const m = s.match(/(\d[\d\s\u00a0]*(?:,\d{1,2})?)\s*(?:\u20ac|K\u010d|CZK)/i)
        || (isCzLocale && s.match(/(\d[\d\s\u00a0]*)\s*,-/));
      if (!m) return null;
      const value = parseNum(m[1].replace(/[\s\u00a0]/g, ""));
      return Number.isFinite(value) && value > 0 ? value : null;
    }

    function hasExistingUnitPrice(text) {
      return /\d+[.,]\d+\s*(?:€|Kč|CZK|,-)\s*\/\s*1?\s*(kg|l|ks|g|ml)\b/i.test(String(text || ""));
    }

    return {
      computeUnitPrice,
      extractFirstPrice,
      extractQuantity,
      hasExistingUnitPrice,
      hasPriceText
    };
  }

  const api = {
    createUnitPriceCalculator,
    extractQuantity
  };

  root.AlzaCheckerUnitPriceCalculator = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
