(function attachPriceGuarantee(root) {
  const shared = root.AlzaCheckerShared || (typeof require !== "undefined" ? require("./shared.js") : null);
  const shopCatalog = root.AlzaCheckerShopCatalog || (typeof require !== "undefined" ? require("./shop-catalog.js") : null);
  const candidateExtraction = root.AlzaCheckerCandidateExtraction || (typeof require !== "undefined" ? require("./candidate-extraction.js") : null);
  const shopPlanning = root.AlzaCheckerShopPlanning || (typeof require !== "undefined" ? require("./shop-planning.js") : null);

  function createPriceGuaranteeChecker({ fetchSearchRequest } = {}) {
    if (!shared || !shopCatalog || !candidateExtraction || !shopPlanning) {
      throw new Error("Price guarantee checker requires shared helpers, shop catalog, candidate extraction, and shop planning.");
    }

    if (typeof fetchSearchRequest !== "function") {
      throw new Error("Price guarantee checker requires fetchSearchRequest.");
    }

    async function verifyPriceFromDetailPage(candidate, productName) {
      if (!candidate.url) {
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

      const detail = candidateExtraction.findBestCandidate(response.text, response.url || candidate.url, productName);

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

    async function checkPlannedShop(shopPlan, productName) {
      const { domain, mode, requests, verifyDetailPrice } = shopPlan;

      if (mode === "manual") {
        return {
          domain,
          searchUrl: requests[0]?.displayUrl,
          state: "manual",
          message: shared.describeFetchFailure({ status: 403 })
        };
      }

      let lastFailure = null;
      let hadSuccessfulResponse = false;

      for (const searchRequest of requests) {
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
        let bestCandidate = candidateExtraction.findBestCandidate(
          response.text,
          response.url || searchRequest.displayUrl,
          searchRequest.matchQuery || productName
        );

        if (bestCandidate) {
          if (verifyDetailPrice && bestCandidate.url) {
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
          searchUrl: requests[0]?.displayUrl,
          state: "manual",
          message: shared.MANUAL_NO_MATCH_MESSAGE
        };
      }

      const failureMessage = lastFailure
        ? shared.describeFetchFailure(lastFailure)
        : "Nepodarilo sa nacitat obchod.";

      return {
        domain,
        searchUrl: requests[0]?.displayUrl,
        state: requests[0]?.displayUrl ? "manual" : "error",
        message: failureMessage
      };
    }

    async function checkShop(domain, productName) {
      const plan = shopPlanning.createShopPlan({
        shops: [domain],
        locale: String(domain || "").endsWith(".cz") ? "cz" : "sk",
        productName,
        includeDefaults: false
      });
      const [shopPlan] = plan.entries;

      if (!shopPlan) {
        return {
          domain: shopCatalog.normalizeDomain(domain),
          state: "error",
          message: "Nepodarilo sa naplanovat kontrolu obchodu."
        };
      }

      return checkPlannedShop(shopPlan, productName);
    }

    function createFailedShopResult(domain, error) {
      return {
        domain: shopCatalog.normalizeDomain(domain),
        state: "error",
        message: shared.describeFetchFailure({ error: error?.message || "" })
      };
    }

    async function checkShops({ shops, locale, productName, onProgress, onResult } = {}) {
      const plan = shopPlanning.createShopPlan({ shops, locale, productName });
      const results = [];

      for (const shopPlan of plan.supportedEntries) {
        onProgress?.({
          domain: shopPlan.domain,
          checkedCount: results.length,
          totalCount: plan.supportedCount
        });

        let result;

        try {
          result = await checkPlannedShop(shopPlan, productName);
        } catch (error) {
          result = createFailedShopResult(shopPlan.domain, error);
        }

        results.push(result);
        onResult?.(results.slice());
      }

      for (const { domain } of plan.unsupportedEntries) {
        results.push({
          domain,
          state: "manual",
          searchUrl: `https://${domain}`
        });
      }

      return {
        results,
        supportedCount: plan.supportedCount,
        supportedShops: plan.supportedShops,
        unsupportedShops: plan.unsupportedShops
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
