(function attachCandidateExtraction(root) {
  const shared = root.AlzaCheckerShared || (typeof require !== "undefined" ? require("./shared.js") : null);

  if (!shared) {
    throw new Error("Candidate extraction requires shared product text helpers.");
  }

  const {
    formatPrice,
    normalizeWhitespace,
    parsePrice,
    parsePriceValue,
    parseProductPrice,
    stripDiacritics,
    tokenize,
    tokenizeBase
  } = shared;

  const ACCESSORY_TOKENS = new Set([
    "bag",
    "brnkatka",
    "charging",
    "choupette",
    "dock",
    "esr",
    "head",
    "halolock",
    "hybrid",
    "karl",
    "lagerfeld",
    "logo",
    "nahradna",
    "nahradne",
    "nahradny",
    "obal",
    "pack",
    "protect",
    "puzdro",
    "kryt",
    "flexair",
    "case",
    "cover",
    "remienok",
    "silicone",
    "silikonovy",
    "silikonove",
    "sluchadlo",
    "sklo",
    "folie",
    "watch"
  ]);

  function unwrapSearchResponseText(text) {
    const raw = String(text || "");

    if (!raw.trim().startsWith("{")) {
      return raw;
    }

    try {
      const parsed = JSON.parse(raw);

      return parsed.html || parsed.content || raw;
    } catch (_error) {
      return raw;
    }
  }

  function getElementText(element) {
    return normalizeWhitespace(element?.textContent ?? "");
  }

  function parseElementPrice(element) {
    if (!element?.querySelectorAll) {
      return null;
    }

    const selectors = [
      "[data-product-price]",
      "[data-prodprice]",
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      '[itemprop="price"]',
      '[itemprop="lowPrice"]'
    ];

    for (const candidate of element.querySelectorAll(selectors.join(","))) {
      const value = (
        candidate.getAttribute("data-product-price") ||
        candidate.getAttribute("data-prodprice") ||
        candidate.getAttribute("content") ||
        candidate.textContent
      );
      const price = parsePriceValue(value);

      if (price) {
        return price;
      }
    }

    return null;
  }

  function getNearbyProductContainer(anchor) {
    const productish = /(product|produkt|item|tile|card|box|list|goods|offer|result)/i;
    let node = anchor;
    let firstPricedAncestor = null;

    for (let depth = 0; node && depth < 5; depth += 1) {
      const className = String(node.className || "").toLowerCase();
      const id = String(node.id || "").toLowerCase();

      if (!firstPricedAncestor && parsePrice(node.textContent)) {
        firstPricedAncestor = node;
      }

      if (productish.test(`${className} ${id}`)) {
        return node;
      }

      node = node.parentElement;
    }

    return firstPricedAncestor || anchor.parentElement || anchor;
  }

  const BLOCKED_URL_PREFIXES = ["javascript:", "data:", "blob:", "mailto:", "tel:"];
  const BLOCKED_URL_SUBSTRINGS = [
    "/exit-click", "exit-click-web",
    "/vyhladavanie", "/vyhladavani", "/hladanie", "/search",
    "/bazar/", "/modules/luigiboxapi/search.php",
    "h%5bfraze%5d=", "h[fraze]=",
    "/cart", "/kosik", "/action/cart", "add_to_cart", "addcartitem"
  ];

  function isBlockedProductUrl(url) {
    const lower = String(url || "").trim().toLowerCase();

    return BLOCKED_URL_PREFIXES.some((p) => lower.startsWith(p))
      || BLOCKED_URL_SUBSTRINGS.some((s) => lower.includes(s));
  }

  function resolveUrl(href, baseUrl) {
    try {
      return new URL(href, baseUrl).href;
    } catch (_error) {
      return "";
    }
  }

  function getAnchorTitle(anchor) {
    return normalizeWhitespace(anchor.textContent || anchor.getAttribute("title") || anchor.getAttribute("aria-label") || "");
  }

  function resolveCandidateUrl(anchor, container, baseUrl) {
    const ownHref = anchor.getAttribute("href");
    const ownUrl = ownHref ? resolveUrl(ownHref, baseUrl) : "";

    if (ownUrl && !isBlockedProductUrl(ownUrl)) {
      return ownUrl;
    }

    for (const candidateAnchor of container.querySelectorAll("a[href]")) {
      const href = candidateAnchor.getAttribute("href");

      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        continue;
      }

      const url = resolveUrl(href, baseUrl);

      if (!isBlockedProductUrl(url) && scoreText(getAnchorTitle(candidateAnchor), tokenize(getElementText(container))) > 0) {
        return url;
      }
    }

    return "";
  }

  function scoreText(text, queryTokens) {
    const haystack = stripDiacritics(text);
    let score = 0;

    for (const token of queryTokens) {
      if (haystack.includes(token)) {
        score += token.length >= 4 ? 2 : 1;
      }
    }

    return score;
  }

  function getMinimumScore(queryTokens) {
    return Math.max(2, Math.min(5, Math.ceil(queryTokens.length * 0.35)));
  }

  function parseQuantityMentions(text) {
    const normalized = stripDiacritics(text).replace(/,/g, ".");
    const quantities = [];
    let match;
    const pattern = /(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/g;

    while ((match = pattern.exec(normalized))) {
      const value = Number.parseFloat(match[1]);
      const unit = match[2];

      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }

      if (unit === "kg" || unit === "g") {
        quantities.push({ kind: "mass", value: unit === "kg" ? value * 1000 : value });
      } else {
        quantities.push({ kind: "volume", value: unit === "l" ? value * 1000 : value });
      }
    }

    return quantities;
  }

  function hasCompatibleQuantity(text, queryText) {
    const queryQuantities = parseQuantityMentions(queryText);

    if (queryQuantities.length === 0) {
      return true;
    }

    const titleQuantities = parseQuantityMentions(text);

    if (titleQuantities.length === 0) {
      return true;
    }

    return queryQuantities.some((queryQuantity) => titleQuantities.some((titleQuantity) => {
      if (queryQuantity.kind !== titleQuantity.kind) {
        return false;
      }

      const tolerance = Math.max(20, queryQuantity.value * 0.08);
      return Math.abs(queryQuantity.value - titleQuantity.value) <= tolerance;
    }));
  }

  function hasRequiredQueryTokens(text, queryTokens, queryText = "") {
    const requiredTokens = queryTokens.filter((token) => {
      if (/^20\d{2}$/.test(token)) {
        return false;
      }

      return token.length > 2 || /^\d+$/.test(token) || /[a-z]\d|\d[a-z]/i.test(token);
    });

    if (requiredTokens.length === 0) {
      return hasCompatibleQuantity(text, queryText);
    }

    const haystack = stripDiacritics(text);
    const matchedCount = requiredTokens.filter((token) => {
      if (/^\d+$/.test(token)) {
        const pattern = new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`);
        return pattern.test(haystack);
      }

      return haystack.includes(token);
    }).length;

    if (requiredTokens.length <= 3) {
      return matchedCount === requiredTokens.length && hasCompatibleQuantity(text, queryText);
    }

    return matchedCount >= Math.ceil(requiredTokens.length * 0.6) && hasCompatibleQuantity(text, queryText);
  }

  function getCandidateTitleScore(title, containerText, queryTokens) {
    const titleScore = scoreText(title, queryTokens);

    if (titleScore > 0) {
      return titleScore;
    }

    return Math.min(scoreText(containerText, queryTokens), 1);
  }

  function hasDisallowedAccessoryTitle(title, queryTokens) {
    const titleTokens = tokenizeBase(title);
    const queryTokenSet = new Set(queryTokens);

    return titleTokens.some((token) => ACCESSORY_TOKENS.has(token) && !queryTokenSet.has(token));
  }

  function hasDisallowedConditionTitle(title) {
    return /(bazar|bazár|pouzit|použit|rozbalen|kozmetickou\s+chybou|poškoden|poskoden)/i.test(stripDiacritics(title));
  }

  function hasDisallowedSearchPageTitle(title) {
    const normalized = stripDiacritics(title);
    return /(vysledky\s+vyhladavania|vysledky\s+hledani|vysledok\s+vyhladavania|search\s+results?)/i.test(normalized);
  }

  function uniqueCandidates(candidates) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
      const key = `${candidate.url}|${candidate.price ? candidate.price.value : "none"}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(candidate);
      }
    }

    return unique;
  }

  function extractCandidatesWithDomParser(html, baseUrl, query) {
    if (typeof DOMParser === "undefined") {
      return [];
    }

    const queryTokens = tokenize(query);
    const document = new DOMParser().parseFromString(html, "text/html");
    const candidates = [];
    const pageCandidate = extractPageProductCandidate(document, baseUrl, queryTokens, query);

    if (pageCandidate) {
      candidates.push(pageCandidate);
    }

    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        continue;
      }

      const container = getNearbyProductContainer(anchor);
      const title = getAnchorTitle(anchor);
      const containerText = getElementText(container);
      const price = parseElementPrice(container) || parseProductPrice(containerText);
      const url = resolveCandidateUrl(anchor, container, baseUrl);

      if (!price || !url) {
        continue;
      }

      if (!hasRequiredQueryTokens(title || containerText, queryTokens, query) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title) || hasDisallowedSearchPageTitle(title || containerText)) {
        continue;
      }

      const score = getCandidateTitleScore(title, containerText, queryTokens);
      const minimumScore = getMinimumScore(queryTokens);

      if (score < minimumScore) {
        continue;
      }

      candidates.push({
        title: title || normalizeWhitespace(containerText).slice(0, 120),
        price,
        url,
        score
      });
    }

    return uniqueCandidates(candidates).sort((a, b) => b.score - a.score || a.price.value - b.price.value);
  }

  function extractPageProductCandidate(document, baseUrl, queryTokens, queryText = "") {
    const title = normalizeWhitespace(
      document.querySelector("h1")?.textContent ||
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.title
    );
    const href = (
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
      document.querySelector('meta[property="og:url"]')?.getAttribute("content") ||
      baseUrl
    );
    const url = resolveUrl(href, baseUrl);

    if (!title || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens, queryText) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title) || hasDisallowedSearchPageTitle(title)) {
      return null;
    }

    const score = scoreText(title, queryTokens);

    if (score < getMinimumScore(queryTokens)) {
      return null;
    }

    const price = parseElementPrice(document) || parseProductPrice(document.body?.textContent || "");

    if (!price) {
      return null;
    }

    return {
      title,
      price,
      url,
      score
    };
  }

  function extractCandidatesFallback(html, baseUrl, query) {
    const queryTokens = tokenize(query);
    const candidates = [];
    const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,900}?)<\/a>/gi;
    const priceWindowSize = /heureka\.(?:sk|cz)/i.test(baseUrl) ? 8000 : 2500;
    let match;

    while ((match = linkPattern.exec(html))) {
      const text = normalizeWhitespace(match[2].replace(/<[^>]*>/g, " "));
      const url = resolveUrl(match[1], baseUrl);

      if (!url || isBlockedProductUrl(url)) {
        continue;
      }

      const score = scoreText(text, queryTokens);

      if (score < getMinimumScore(queryTokens)) {
        continue;
      }

      if (!hasRequiredQueryTokens(text, queryTokens, query) || hasDisallowedAccessoryTitle(text, queryTokens) || hasDisallowedConditionTitle(text) || hasDisallowedSearchPageTitle(text)) {
        continue;
      }

      const surrounding = html.slice(linkPattern.lastIndex, linkPattern.lastIndex + priceWindowSize).replace(/<[^>]*>/g, " ");
      const price = parseProductPrice(surrounding);

      if (!price) {
        continue;
      }

      candidates.push({
        title: text.slice(0, 120),
        price,
        url,
        score
      });
    }

    return uniqueCandidates(candidates).sort((a, b) => b.score - a.score || a.price.value - b.price.value);
  }

  function extractProductCandidates(html, baseUrl, query) {
    const responseText = unwrapSearchResponseText(html);
    const structuredCandidates = extractStructuredCandidates(responseText, baseUrl, query);
    const domCandidates = extractCandidatesWithDomParser(responseText, baseUrl, query);

    if (structuredCandidates.length > 0) {
      return structuredCandidates;
    }

    if (domCandidates.length > 0) {
      return domCandidates;
    }

    const pageCandidate = extractPageProductCandidateFallback(responseText, baseUrl, tokenize(query), query);

    if (pageCandidate) {
      return [pageCandidate];
    }

    return extractCandidatesFallback(responseText, baseUrl, query);
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

  function extractStructuredCandidates(html, baseUrl, query) {
    const queryTokens = tokenize(query);
    const candidates = [
      ...extractTetaProductCardCandidates(html, baseUrl, queryTokens, query),
      ...extractRossmannProductTileCandidates(html, baseUrl, queryTokens, query),
      ...extractAttributeProductCandidates(html, baseUrl, queryTokens, query),
      ...extractGtmProductCandidates(html, baseUrl, queryTokens, query),
      ...extractDataPriceCardCandidates(html, baseUrl, queryTokens, query),
      ...extractJsonLdCandidates(html, baseUrl, queryTokens, query)
    ];

    return uniqueCandidates(candidates).sort((a, b) => b.score - a.score || a.price.value - b.price.value);
  }

  function buildCandidate(title, price, href, baseUrl, queryTokens, queryText = "") {
    const url = resolveUrl(decodeHtml(href), baseUrl);

    if (!title || !price || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens, queryText) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title) || hasDisallowedSearchPageTitle(title)) {
      return null;
    }

    const score = scoreText(title, queryTokens);

    if (score < getMinimumScore(queryTokens)) {
      return null;
    }

    return {
      title,
      price,
      url,
      score
    };
  }

  function extractGtmProductCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /data-gtm-data-product='([^']+)'([\s\S]{0,3500}?)(?=<div class="(?:col-|product-box)|$)/gi;
    let match;

    while ((match = pattern.exec(html))) {
      let product;

      try {
        product = JSON.parse(decodeHtml(match[1]));
      } catch (_error) {
        continue;
      }

      const href = match[2].match(/href=["']([^"']+)["']/i)?.[1] || baseUrl;
      const price = parsePriceValue(product.price);
      const candidate = buildCandidate(product.item_name, price, href, baseUrl, queryTokens, queryText);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractAttributeProductCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /data-gtm-product-name=(["'])(.*?)\1/gi;
    let match;

    while ((match = pattern.exec(html))) {
      const chunkStart = match.index;
      const nextProductOffset = html.slice(pattern.lastIndex).search(/\sdata-gtm-product-name=(["'])/i);
      const chunkEnd = nextProductOffset === -1 ? chunkStart + 6000 : pattern.lastIndex + nextProductOffset;
      const chunk = html.slice(chunkStart, chunkEnd);
      const title = decodeHtml(match[2]);
      const href = chunk.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || baseUrl;
      const price = (
        parsePriceValue(chunk.match(/data-testid=["']fulltext\.item\.price["'][^>]*data-test-value=["']([^"']+)["']/i)?.[1]) ||
        parsePriceValue(stripHtml(decodeHtml(chunk.match(/data-testid=["']fulltext\.item\.price["'][^>]*>([\s\S]{0,200}?)<\/(?:strong|span|div|p)>/i)?.[1] || ""))) ||
        parsePriceValue(stripHtml(decodeHtml(chunk.match(/class=["'][^"']*price[^"']*["'][^>]*>([\s\S]{0,200}?)<\/(?:strong|span|div|p)>/i)?.[1] || ""))) ||
        parseAttributeProductPrice(chunk)
      );
      const candidate = buildCandidate(title, price, href, baseUrl, queryTokens, queryText);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function parseAttributeProductPrice(chunk) {
    const price = Number.parseFloat(chunk.match(/data-gtm-product-price=["']([^"']+)["']/i)?.[1] || "");
    const vat = Number.parseFloat(chunk.match(/data-gtm-product-vat=["']([^"']+)["']/i)?.[1] || "0");
    const currency = chunk.match(/data-gtm-product-currency=["']([^"']+)["']/i)?.[1] || "";
    const value = price + vat;

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return {
      value,
      text: formatPrice(Number(value.toFixed(2)), /czk/i.test(currency) ? "CZK" : "EUR")
    };
  }

  function extractTetaProductCardCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /<a\b[^>]*href=["'](\/eshop\/katalog\/[^"']+)["'][^>]*class=["'][^"']*c-product-card__link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = pattern.exec(html))) {
      const chunk = match[2];
      const title = stripHtml(
        chunk.match(/class=["'][^"']*c-product-card__title[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ||
        chunk.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ||
        ""
      );
      const priceText = (
        chunk.match(/class=["'][^"']*c-product-price__value[^"']*["'][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ||
        chunk.match(/class=["'][^"']*c-product-price__former-price[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ||
        ""
      );
      const price = parsePriceValue(stripHtml(decodeHtml(priceText)));
      const candidate = buildCandidate(title, price, match[1], baseUrl, queryTokens, queryText);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractRossmannProductTileCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /<div class="product-tile"[\s\S]*?<h3 class="product-tile__title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?product-tile__sub--title">([\s\S]*?)<\/span>[\s\S]*?product-tile__price--final">\s*<div>([\s\S]*?)<\/div>/gi;
    let match;

    while ((match = pattern.exec(html))) {
      const brand = stripHtml(decodeHtml(match[3]));
      const productName = stripHtml(decodeHtml(match[2]));
      const title = normalizeWhitespace(`${brand} ${productName}`.trim());
      const price = parsePriceValue(stripHtml(decodeHtml(match[4])));
      const candidate = buildCandidate(title, price, match[1], baseUrl, queryTokens, queryText);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractDataPriceCardCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /<a\b[^>]*href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]{0,900}?)<\/a>[\s\S]{0,1800}?data-prodprice=["']([^"']+)["']/gi;
    let match;

    while ((match = pattern.exec(html))) {
      const title = stripHtml(match[2]);
      const price = parsePriceValue(decodeHtml(match[3]));
      const candidate = buildCandidate(title, price, match[1], baseUrl, queryTokens, queryText);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractJsonLdCandidates(html, baseUrl, queryTokens, queryText = "") {
    const candidates = [];
    const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = pattern.exec(html))) {
      let parsed;

      try {
        parsed = JSON.parse(decodeHtml(match[1]));
      } catch (_error) {
        continue;
      }

      for (const item of flattenJsonLd(parsed)) {
        if (!item || !/(Product|ProductGroup)/.test(String(item["@type"] || ""))) {
          continue;
        }

        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const isAggregate = /AggregateOffer/i.test(String(offer?.["@type"] || ""));
        const price = isAggregate
          ? parsePriceValue(offer?.price)
          : parsePriceValue(offer?.price) || parsePriceValue(offer?.lowPrice);
        const href = offer?.url || item.url || baseUrl;
        const candidate = buildCandidate(item.name, price, href, baseUrl, queryTokens, queryText);

        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  function flattenJsonLd(value) {
    if (Array.isArray(value)) {
      return value.flatMap(flattenJsonLd);
    }

    if (value && typeof value === "object" && Array.isArray(value["@graph"])) {
      return flattenJsonLd(value["@graph"]);
    }

    return value ? [value] : [];
  }

  function getHtmlAttribute(tag, attribute) {
    const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "i");
    const match = String(tag || "").match(pattern);

    return match ? match[1] : "";
  }

  function stripHtml(value) {
    return normalizeWhitespace(String(value || "").replace(/<[^>]*>/g, " "));
  }

  function extractMetaPrice(html) {
    const metaPricePatterns = [
      /<meta\b[^>]*property=["'](?:og:price:amount|product:price:amount)["'][^>]*>/gi,
      /<meta\b[^>]*name=["'](?:price|twitter:data1)["'][^>]*>/gi
    ];

    for (const pattern of metaPricePatterns) {
      let match;
      while ((match = pattern.exec(html))) {
        const price = parsePriceValue(getHtmlAttribute(match[0], "content"));
        if (price) return price;
      }
    }

    return null;
  }

  function extractPageProductCandidateFallback(html, baseUrl, queryTokens, queryText = "") {
    const h1 = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const titleTag = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const canonical = String(html || "").match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
    const ogUrl = String(html || "").match(/<meta\b[^>]*property=["']og:url["'][^>]*>/i);
    const title = stripHtml(h1?.[1] ?? titleTag?.[1] ?? "");
    const href = getHtmlAttribute(canonical?.[0] ?? "", "href") || getHtmlAttribute(ogUrl?.[0] ?? "", "content") || baseUrl;
    const url = resolveUrl(href, baseUrl);

    if (!title || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens, queryText) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedSearchPageTitle(title)) {
      return null;
    }

    const score = scoreText(title, queryTokens);

    if (score < getMinimumScore(queryTokens)) {
      return null;
    }

    const price = extractMetaPrice(html) || parseProductPrice(stripHtml(html));

    if (!price) {
      return null;
    }

    return {
      title,
      price,
      url,
      score
    };
  }

  function findBestCandidate(html, baseUrl, productQuery) {
    return extractProductCandidates(html, baseUrl, productQuery)[0] || null;
  }

  const api = {
    findBestCandidate
  };

  root.AlzaCheckerCandidateExtraction = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
