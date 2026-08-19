(function attachShopPlanning(root) {
  const shopCatalog = root.AlzaCheckerShopCatalog || (typeof require !== "undefined" ? require("./shop-catalog.js") : null);
  const shared = root.AlzaCheckerShared || (typeof require !== "undefined" ? require("./shared.js") : null);

  if (!shopCatalog || !shared) {
    throw new Error("Shop planning requires the shop catalog and shared product text helpers.");
  }

  const {
    cleanProductName,
    normalizeWhitespace,
    tokenize
  } = shared;

  const FALLBACK_SEARCH_TEMPLATES = [
    "/search?q={query}",
    "/vyhladavanie/?string={query}",
    "/vyhladavani?q={query}"
  ];

  function uniqueValues(values) {
    const seen = new Set();
    const unique = [];

    for (const value of values) {
      const normalized = normalizeWhitespace(value);
      const key = normalized.toLowerCase();

      if (normalized && !seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }
    }

    return unique;
  }

  const COLOR_TOKENS = new Set([
    "biela",
    "biely",
    "bielou",
    "black",
    "cierna",
    "cierny",
    "cervena",
    "cerveny",
    "modra",
    "modry",
    "siva",
    "sivy",
    "white",
    "zelena",
    "zeleny"
  ]);

  function buildProgressiveSearchQueries(cleaned) {
    const tokens = tokenize(cleaned);
    const variants = [];

    if (tokens.length >= 2) {
      variants.push(tokens.slice(0, 2).join(" "));
    }

    if (tokens.length >= 1) {
      variants.push(tokens[0]);
    }

    const modelTokens = tokens.filter((token) => /[a-z]*\d|\d[a-z]/i.test(token));

    if (tokens[0] && modelTokens[0]) {
      variants.push(`${tokens[0]} ${modelTokens[0]}`);
    }

    const withoutColors = tokens.filter((token) => !COLOR_TOKENS.has(token));

    if (withoutColors.length >= 2 && withoutColors.length < tokens.length) {
      variants.push(withoutColors.join(" "));
    }

    return variants;
  }

  function buildSearchQueries(productName) {
    const cleaned = cleanProductName(productName);
    const withoutQuantity = cleaned
      .replace(/\s+\d+(?:[.,]\d+)?\s*(g|kg|ml|l|ks|mm|cm|m)\b.*$/i, "")
      .trim();
    const beforeFlavor = cleaned.split(/,\s*(?=[^\d])/)[0].trim();
    const coreWithQuantity = normalizeWhitespace(
      beforeFlavor
        .replace(/&/g, " ")
        .replace(/\b(powder|prasek|prášok|prasok|praskovy|práškový)\b/gi, " ")
    );
    const coreWithoutQuantity = normalizeWhitespace(
      beforeFlavor
        .replace(/\b\d+(?:[.,]\d+)?\s*(g|kg|ml|l|ks|mm|cm|m)\b/gi, " ")
        .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
        .replace(/&/g, " ")
        .replace(/\b(powder|prasek|prášok|prasok|praskovy|práškový)\b/gi, " ")
    );

    return uniqueValues([
      cleaned,
      cleaned.replace(/\s+[–—-]\s+/g, " -- "),
      cleaned.replace(/\s+[–—-]\s+/g, " "),
      coreWithQuantity,
      coreWithoutQuantity,
      withoutQuantity,
      ...buildProgressiveSearchQueries(cleaned)
    ]);
  }

  function replaceQueryPlaceholder(template, query) {
    const encoded = encodeURIComponent(normalizeWhitespace(query));
    const plusEncoded = encoded.replace(/%20/g, "+");

    return template
      .replaceAll("{queryPlus}", plusEncoded)
      .replaceAll("{query}", encoded);
  }

  function applyQueryTemplate(template, domain, query) {
    const value = replaceQueryPlaceholder(template, query);
    return /^https?:\/\//i.test(value) ? value : `https://${domain}${value}`;
  }

  function buildSearchRequests(policy, query) {
    const requestQueries = policy.domain === "istyle.sk" || policy.domain === "istores.sk"
      ? uniqueValues([query, query.replace(/\b20\d{2}\b/g, "").trim()])
      : [query];

    return requestQueries.flatMap((requestQuery) => policy.searchTemplates.map((template) => {
      if (typeof template === "string") {
        const url = applyQueryTemplate(template, policy.domain, requestQuery);

        return {
          url,
          displayUrl: url,
          method: "GET",
          matchQuery: requestQuery
        };
      }

      return {
        url: applyQueryTemplate(template.url, policy.domain, requestQuery),
        displayUrl: applyQueryTemplate(template.displayUrl || template.url, policy.domain, requestQuery),
        method: template.method || "GET",
        body: template.body ? replaceQueryPlaceholder(template.body, requestQuery) : undefined,
        matchQuery: requestQuery
      };
    }));
  }

  function createShopPlan({
    shops = [],
    locale = "sk",
    productName = "",
    includeDefaults = true
  } = {}) {
    const discoveredDomains = shops.map((domain) => shopCatalog.normalizeDomain(domain));
    const defaultDomains = includeDefaults ? shopCatalog.getDefaultSearchShops(locale) : [];
    const domains = uniqueValues([...defaultDomains, ...discoveredDomains]);
    const queries = buildSearchQueries(productName);

    const entries = domains.map((domain) => {
      const policy = shopCatalog.getShopPolicy(domain);

      if (!policy) {
        return {
          domain,
          mode: "unsupported",
          requests: queries.flatMap((query) => buildSearchRequests({
            domain,
            searchTemplates: FALLBACK_SEARCH_TEMPLATES
          }, query)),
          verifyDetailPrice: false
        };
      }

      return {
        domain: policy.domain,
        mode: policy.mode,
        requests: queries.flatMap((query) => buildSearchRequests(policy, query)),
        verifyDetailPrice: policy.verifyDetailPrice
      };
    });
    const supportedEntries = entries.filter(({ mode }) => mode !== "unsupported");
    const unsupportedEntries = entries.filter(({ mode }) => mode === "unsupported");

    return {
      entries,
      supportedCount: supportedEntries.length,
      supportedEntries,
      supportedShops: supportedEntries.map(({ domain }) => domain),
      unsupportedEntries,
      unsupportedShops: unsupportedEntries.map(({ domain }) => domain)
    };
  }

  const api = {
    createShopPlan
  };

  root.AlzaCheckerShopPlanning = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
