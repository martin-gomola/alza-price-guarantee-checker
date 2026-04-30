(function attachShared(root) {
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
    "pre",
    "s",
    "v",
    "z"
  ]);

  const SEARCH_TEMPLATES = {
    "abc-zoo.sk": [
      {
        url: "https://abc-zoo.sk/modules/luigiboxapi/luigiboxapi-ajax.php",
        displayUrl: "https://abc-zoo.sk/modules/luigiboxapi/search.php?search_query={query}&orderby=position&orderway=desc",
        method: "POST",
        body: "action=getProducts&query={query}&ob=position&ow=desc&p=1&n=32"
      },
      "https://abc-zoo.sk/modules/luigiboxapi/search.php?search_query={query}&orderby=position&orderway=desc"
    ],
    "4kids.sk": ["https://www.4kids.sk/vyhladavanie/?q={queryPlus}"],
    "alltoys.sk": ["https://www.alltoys.sk/vyhladavanie/?q={queryPlus}"],
    "benulekaren.sk": ["https://www.benulekaren.sk/vyhladavanie?q={queryPlus}"],
    "decathlon.sk": ["https://www.decathlon.sk/search/?query={query}"],
    "dracik.sk": ["https://www.dracik.sk/search/?q={queryPlus}"],
    "drmax.sk": ["https://www.drmax.sk/search?q={queryPlus}"],
    "heureka.sk": ["https://www.heureka.sk/?h%5Bfraze%5D={queryPlus}"],
    "hornbach.sk": ["https://www.hornbach.sk/s/{query}?isInitialRequest=false"],
    "hudysport.sk": ["https://www.hudysport.sk/vyhledavani?q={query}"],
    "istores.sk": ["https://www.istores.sk/vyhladavanie?q={queryPlus}"],
    "istyle.sk": ["https://www.istyle.sk/search?q={query}&type=product"],
    "kytary.sk": ["https://kytary.sk/Search/?term={query}&kw={query}"],
    "nay.sk": ["https://www.nay.sk/vyhladavanie?q={query}"],
    "obi.sk": ["https://www.obi.sk/search/{queryPlus}"],
    "planeo.sk": ["https://www.planeo.sk/vyhladavanie$a1013-search?query={queryPlus}"],
    "pompo.sk": ["https://www.pompo.sk/vyhladavanie?q={queryPlus}"],
    "profizoo.sk": ["/vyhladavanie?search={query}", "/hladani?q={query}", "/search?q={query}"],
    "petcenter.sk": ["https://www.petcenter.sk/vyhladavanie/?string={query}"],
    "spokojnypes.sk": ["https://www.spokojnypes.sk/vyhladavanie/?q={query}", "https://www.spokojnypes.sk/search/?q={query}"],
    "smarty.sk": ["https://www.smarty.sk/Vyhladavanie?query={query}"],
    "superzoo.sk": ["https://www.superzoo.sk/hladanie/?query={query}"],
    "tetadrogerie.sk": ["https://www.tetadrogerie.sk/produkty/?hladaj={queryPlus}"]
  };
  const DEFAULT_SEARCH_SHOPS = ["heureka.sk"];

  const TOKEN_SYNONYMS = {
    kvasnice: ["yeast"],
    pivovarske: ["brewer", "brewers"]
  };

  const ACCESSORY_TOKENS = new Set([
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

  function parsePriceValue(value) {
    const normalized = normalizeWhitespace(value);

    if (!normalized) {
      return null;
    }

    if (normalized.includes("\u20ac")) {
      return parseEuroPrice(normalized);
    }

    const number = Number.parseFloat(normalized.replace(/\s/g, "").replace(",", "."));

    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }

    return {
      value: number,
      text: formatEuroPrice(number)
    };
  }

  function parseProductPrice(text) {
    const normalized = normalizeWhitespace(text);
    const preferredPatterns = [
      /\b(?:cena\s+od)\s*(\d{1,4}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*\u20ac/i,
      /\b(?:cena|predajna\s+cena)\s*:?\s*(\d{1,4}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*\u20ac/i
    ];

    for (const pattern of preferredPatterns) {
      const match = normalized.match(pattern);

      if (match) {
        return parseEuroPrice(`${match[1]} \u20ac`);
      }
    }

    for (const match of normalized.matchAll(/\bod\s*(\d{1,4}(?:[\s.]\d{3})*(?:,\d{1,2})?)\s*\u20ac/gi)) {
      const nearby = stripDiacritics(normalized.slice(Math.max(0, match.index - 30), match.index + match[0].length + 20));

      if (!/(doprava|postovne|poštovne)/.test(nearby)) {
        return parseEuroPrice(`${match[1]} \u20ac`);
      }
    }

    const prices = parseEuroPrices(normalized);

    if (prices.length <= 1) {
      return prices[0] || null;
    }

    const safePrices = prices.filter((price) => {
      const index = normalized.indexOf(price.text);
      const nearby = stripDiacritics(normalized.slice(Math.max(0, index - 18), index + price.text.length + 12));

      return !/(doprava|postovne|poštovne|usetrite|ušetr|zlav|zlava|splát|splat|mesacne|mesačne)/.test(nearby);
    });

    const candidates = safePrices.length > 0 ? safePrices : prices;

    return candidates.slice().sort((a, b) => a.value - b.value)[0] || null;
  }

  function parseSupportedShopsFromText(text) {
    const ignored = new Set(["alza.sk", "www.alza.sk"]);
    const domains = new Set();
    const normalizedText = String(text || "")
      .replace(/&(?:#46|period);/gi, ".")
      .replace(/\\u002e/gi, ".")
      .replace(/([a-z0-9])\s+\.\s*([a-z])/gi, "$1.$2")
      .replace(/([a-z0-9])\s*\.\s+([a-z])/gi, "$1.$2")
      .toLowerCase()
      .replace(/(\.sk)(?=[a-z0-9-]+\.)/g, "$1 ");
    const matches = normalizedText.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g);

    for (const match of matches) {
      let domain = match[0].replace(/^www\./, "");
      if (!domain.endsWith(".sk")) continue;

      const parts = domain.split(".");
      if (parts.length > 2) {
        domain = parts.slice(-2).join(".");
      }

      domain = normalizeShopDomain(domain);
      if (ignored.has(domain)) continue;

      domains.add(domain);
    }

    return [...domains].sort();
  }

  function normalizeShopDomain(domain) {
    if (SEARCH_TEMPLATES[domain]) return domain;

    const stripped = domain.replace(/^[a-z]/, "");
    if (SEARCH_TEMPLATES[stripped]) return stripped;

    return domain;
  }

  function cleanProductName(value) {
    return normalizeWhitespace(value)
      .replace(/\s+[-|]\s+Alza\.sk.*$/i, "")
      .replace(/^(doplnok stravy pre (psov|macky|ma\u010dky)|krmivo pre (psov|macky|ma\u010dky)|chovatelske potreby|chovate\u013esk\u00e9 potreby)\s+/i, "")
      .replace(/\b\d+\s*x\s*/gi, "")
      .trim();
  }

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

  function buildSearchQueries(productName) {
    const cleaned = cleanProductName(productName);
    const withoutQuantity = cleaned
      .replace(/\s+\d+(?:[.,]\d+)?\s*(g|kg|ml|l|ks|mm|cm|m)\b.*$/i, "")
      .trim();

    return uniqueValues([
      cleaned,
      cleaned.replace(/\s+[–—-]\s+/g, " -- "),
      cleaned.replace(/\s+[–—-]\s+/g, " "),
      withoutQuantity
    ]);
  }

  function mergeDefaultSearchShops(shops) {
    return uniqueValues([...DEFAULT_SEARCH_SHOPS, ...(shops || []).map(normalizeShopDomain)]);
  }

  function applyQueryTemplate(template, domain, query) {
    const value = replaceQueryPlaceholder(template, query);

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return `https://${domain}${value}`;
  }

  function replaceQueryPlaceholder(template, query) {
    const encoded = encodeURIComponent(normalizeWhitespace(query));
    const plusEncoded = encoded.replace(/%20/g, "+");

    return template
      .replaceAll("{queryPlus}", plusEncoded)
      .replaceAll("{query}", encoded);
  }

  function buildSearchRequests(domain, query) {
    const templates = SEARCH_TEMPLATES[domain] || [
      "/search?q={query}",
      "/vyhladavanie/?string={query}",
      "/vyhladavani?q={query}"
    ];
    const queries = domain === "istyle.sk" || domain === "istores.sk"
      ? uniqueValues([query, query.replace(/\b20\d{2}\b/g, "").trim()])
      : [query];

    return queries.flatMap((requestQuery) => templates.map((template) => {
      if (typeof template === "string") {
        const url = applyQueryTemplate(template, domain, requestQuery);

        return {
          url,
          displayUrl: url,
          method: "GET"
        };
      }

      const url = applyQueryTemplate(template.url, domain, requestQuery);
      const displayUrl = applyQueryTemplate(template.displayUrl || template.url, domain, requestQuery);

      return {
        url,
        displayUrl,
        method: template.method || "GET",
        body: template.body ? replaceQueryPlaceholder(template.body, requestQuery) : undefined
      };
    }));
  }

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
      '[itemprop="lowPrice"]',
      '[itemprop="price"]'
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

      if (!firstPricedAncestor && parseEuroPrice(node.textContent)) {
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

  function hasRequiredQueryTokens(text, queryTokens) {
    const requiredTokens = queryTokens.filter((token) => {
      if (/^20\d{2}$/.test(token)) {
        return false;
      }

      return token.length > 2 || /^\d+$/.test(token) || /[a-z]\d|\d[a-z]/i.test(token);
    });

    if (requiredTokens.length === 0) {
      return true;
    }

    const haystack = stripDiacritics(text);
    const matchedCount = requiredTokens.filter((token) => haystack.includes(token)).length;

    if (requiredTokens.length <= 3) {
      return matchedCount === requiredTokens.length;
    }

    return matchedCount >= Math.ceil(requiredTokens.length * 0.6);
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
    const pageCandidate = extractPageProductCandidate(document, baseUrl, queryTokens);

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

      if (!hasRequiredQueryTokens(title || containerText, queryTokens) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title)) {
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

  function extractPageProductCandidate(document, baseUrl, queryTokens) {
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

    if (!title || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title)) {
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
    const priceWindowSize = /heureka\.sk/i.test(baseUrl) ? 8000 : 2500;
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

      if (!hasRequiredQueryTokens(text, queryTokens) || hasDisallowedAccessoryTitle(text, queryTokens) || hasDisallowedConditionTitle(text)) {
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

    const pageCandidate = extractPageProductCandidateFallback(responseText, baseUrl, tokenize(query));

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
      ...extractAttributeProductCandidates(html, baseUrl, queryTokens),
      ...extractGtmProductCandidates(html, baseUrl, queryTokens),
      ...extractDataPriceCardCandidates(html, baseUrl, queryTokens),
      ...extractJsonLdCandidates(html, baseUrl, queryTokens)
    ];

    return uniqueCandidates(candidates).sort((a, b) => b.score - a.score || a.price.value - b.price.value);
  }

  function buildCandidate(title, price, href, baseUrl, queryTokens) {
    const url = resolveUrl(decodeHtml(href), baseUrl);

    if (!title || !price || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens) || hasDisallowedAccessoryTitle(title, queryTokens) || hasDisallowedConditionTitle(title)) {
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

  function extractGtmProductCandidates(html, baseUrl, queryTokens) {
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
      const candidate = buildCandidate(product.item_name, price, href, baseUrl, queryTokens);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractAttributeProductCandidates(html, baseUrl, queryTokens) {
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
        parsePriceValue(stripHtml(decodeHtml(chunk.match(/data-testid=["']fulltext\.item\.price["'][^>]*>([\s\S]{0,120}?)<\/strong>/i)?.[1] || ""))) ||
        parseAttributeProductPrice(chunk)
      );
      const candidate = buildCandidate(title, price, href, baseUrl, queryTokens);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function parseAttributeProductPrice(chunk) {
    const price = Number.parseFloat(chunk.match(/data-gtm-product-price=["']([^"']+)["']/i)?.[1] || "");
    const vat = Number.parseFloat(chunk.match(/data-gtm-product-vat=["']([^"']+)["']/i)?.[1] || "0");
    const value = price + vat;

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return {
      value,
      text: formatEuroPrice(Number(value.toFixed(2)))
    };
  }

  function extractDataPriceCardCandidates(html, baseUrl, queryTokens) {
    const candidates = [];
    const pattern = /<a\b[^>]*href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]{0,900}?)<\/a>[\s\S]{0,1800}?data-prodprice=["']([^"']+)["']/gi;
    let match;

    while ((match = pattern.exec(html))) {
      const title = stripHtml(match[2]);
      const price = parsePriceValue(decodeHtml(match[3]));
      const candidate = buildCandidate(title, price, match[1], baseUrl, queryTokens);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  function extractJsonLdCandidates(html, baseUrl, queryTokens) {
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
        const price = parsePriceValue(offer?.price);
        const href = offer?.url || item.url || baseUrl;
        const candidate = buildCandidate(item.name, price, href, baseUrl, queryTokens);

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

  function extractPageProductCandidateFallback(html, baseUrl, queryTokens) {
    const h1 = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const titleTag = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const canonical = String(html || "").match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
    const ogUrl = String(html || "").match(/<meta\b[^>]*property=["']og:url["'][^>]*>/i);
    const title = stripHtml(h1?.[1] ?? titleTag?.[1] ?? "");
    const href = getHtmlAttribute(canonical?.[0] ?? "", "href") || getHtmlAttribute(ogUrl?.[0] ?? "", "content") || baseUrl;
    const url = resolveUrl(href, baseUrl);

    if (!title || !url || isBlockedProductUrl(url) || !hasRequiredQueryTokens(title, queryTokens) || hasDisallowedAccessoryTitle(title, queryTokens)) {
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

  const api = {
    buildSearchQueries,
    buildSearchRequests,
    cleanProductName,
    decodeHtml,
    extractProductCandidates,
    mergeDefaultSearchShops,
    normalizeWhitespace,
    parseEuroPrice,
    parseEuroPrices,
    parseProductPrice,
    parseSupportedShopsFromText,
    isBlockedProductUrl
  };

  root.AlzaCheckerShared = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
