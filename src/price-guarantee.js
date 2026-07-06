(function attachPriceGuarantee(root) {
  const shared = root.AlzaCheckerShared || (typeof require !== "undefined" ? require("./shared.js") : null);
  const shopCatalog = root.AlzaCheckerShopCatalog || (typeof require !== "undefined" ? require("./shop-catalog.js") : null);

  function createPriceGuaranteeChecker({ fetchSearchRequest } = {}) {
    if (!shared || !shopCatalog) {
      throw new Error("Price guarantee checker requires shared helpers and shop catalog.");
    }

    if (typeof fetchSearchRequest !== "function") {
      throw new Error("Price guarantee checker requires fetchSearchRequest.");
    }

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
      const normalizedDomain = shopCatalog.normalizeDomain(domain);
      const searchQueries = shared.buildSearchQueries(productName);
      const searchRequests = searchQueries.flatMap((query) => shared.buildSearchRequests(normalizedDomain, query));

      if (shopCatalog.isManualOnly(normalizedDomain)) {
        return {
          domain: normalizedDomain,
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

        if (shared.isBotChallengePage(response.text)) {
          lastFailure = { status: 403, error: "bot_challenge" };
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

          if (shopCatalog.shouldVerifyDetailPrice(normalizedDomain) && bestCandidate.url) {
            bestCandidate = await verifyPriceFromDetailPage(bestCandidate, productName);
          }

          return {
            domain: normalizedDomain,
            searchUrl: searchRequest.displayUrl,
            state: "found",
            ...bestCandidate
          };
        }
      }

      if (hadSuccessfulResponse) {
        return {
          domain: normalizedDomain,
          searchUrl: searchRequests[0]?.displayUrl,
          state: "manual",
          message: shared.MANUAL_NO_MATCH_MESSAGE
        };
      }

      const failureMessage = lastFailure
        ? shared.describeFetchFailure(lastFailure)
        : "Nepodarilo sa nacitat obchod.";

      return {
        domain: normalizedDomain,
        searchUrl: searchRequests[0]?.displayUrl,
        state: searchRequests[0]?.displayUrl ? "manual" : "error",
        message: failureMessage
      };
    }

    function createFailedShopResult(domain, error) {
      return {
        domain: shopCatalog.normalizeDomain(domain),
        state: "error",
        message: shared.describeFetchFailure({ error: error?.message || "" })
      };
    }

    async function checkShops({ shops, locale, productName, onProgress, onResult } = {}) {
      const allShops = shared.mergeDefaultSearchShops(shops, locale);
      const supportedShops = allShops.filter((domain) => shopCatalog.hasSearchTemplate(domain));
      const unsupportedShops = allShops.filter((domain) => !shopCatalog.hasSearchTemplate(domain));
      const results = [];

      for (const domain of supportedShops) {
        onProgress?.({
          domain,
          checkedCount: results.length,
          totalCount: supportedShops.length
        });

        let result;

        try {
          result = await checkShop(domain, productName);
        } catch (error) {
          result = createFailedShopResult(domain, error);
        }

        results.push(result);
        onResult?.(results.slice());
      }

      for (const domain of unsupportedShops) {
        results.push({
          domain,
          state: "manual",
          searchUrl: `https://${domain}`
        });
      }

      return {
        results,
        supportedCount: supportedShops.length,
        supportedShops,
        unsupportedShops
      };
    }

    return {
      checkShop,
      checkShops,
      createFailedShopResult
    };
  }

  const api = {
    createPriceGuaranteeChecker
  };

  root.AlzaCheckerPriceGuarantee = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
