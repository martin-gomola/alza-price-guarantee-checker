const assert = require("node:assert/strict");
const test = require("node:test");

const shopCatalog = require("./src/shop-catalog.js");
const shared = require("./src/shared.js");
const priceGuarantee = require("./src/price-guarantee.js");
const unitPriceCalculator = require("./src/unitprice-calculator.js");

test("builds mi-store.sk search requests", () => {
  const [request] = shared.buildSearchRequests("mi-store.sk", "Samsung Galaxy Tab S10 FE+");

  assert.equal(request.method, "GET");
  assert.equal(request.url, "https://www.mi-store.sk/vyhladavanie?search=Samsung+Galaxy+Tab+S10+FE%2B");
  assert.equal(request.displayUrl, request.url);
});

test("builds mojadm.sk search requests", () => {
  const [request] = shared.buildSearchRequests("mojadm.sk", "BREF Power Aktív Lemon 6× 50 g");

  assert.equal(request.method, "GET");
  assert.equal(
    request.url,
    "https://www.mojadm.sk/search?query=BREF%20Power%20Akt%C3%ADv%20Lemon%206%C3%97%2050%20g&searchProviderType=dm-products"
  );
  assert.equal(request.displayUrl, request.url);
});

test("includes mi-store.sk when merging supported shops", () => {
  assert.deepEqual(shared.mergeDefaultSearchShops(["mi-store.sk"], "sk"), [
    "heureka.sk",
    "mi-store.sk"
  ]);
  assert.equal(shared.hasSearchTemplate("mi-store.sk"), true);
});

test("describes blocked shop responses without HTTP codes", () => {
  assert.equal(
    shared.describeFetchFailure({ status: 403 }),
    "Obchod blokuje automaticku kontrolu. Overte cenu priamo na obchode."
  );
  assert.equal(
    shared.describeFetchFailure({ status: 429 }),
    "Obchod blokuje automaticku kontrolu. Overte cenu priamo na obchode."
  );
});

test("describes timeouts and network failures in plain language", () => {
  assert.equal(
    shared.describeFetchFailure({ error: "Request timed out" }),
    "Kontrola trvala prilis dlho. Skuste to priamo na obchode."
  );
  assert.equal(
    shared.describeFetchFailure({ status: 0, error: "Failed to fetch" }),
    "Nepodarilo sa spojit s obchodom. Skuste to priamo na obchode."
  );
});

test("marks Heureka as manual-only", () => {
  assert.equal(shared.isManualOnlyShop("heureka.sk"), true);
  assert.equal(shared.isManualOnlyShop("heureka.cz"), true);
  assert.equal(shared.isManualOnlyShop("drmax.sk"), false);
});

test("parses Czech guarantee shop lists from Alza dialog text", () => {
  assert.deepEqual(
    shared.parseSupportedShopsFromText("notino.cz drmax.cz dm.cz tetadrogerie.cz rossmann.cz"),
    ["dm.cz", "drmax.cz", "notino.cz", "rossmann.cz", "tetadrogerie.cz"]
  );
});

test("builds progressive search queries for brand and model tokens", () => {
  const queries = shared.buildSearchQueries("Philips Hue White E27");

  assert.ok(queries.includes("Philips Hue White E27"));
  assert.ok(queries.includes("philips e27"));
  assert.ok(queries.includes("philips"));
});

test("builds progressive search queries for product lines", () => {
  const queries = shared.buildSearchQueries("Legrand Valena");

  assert.ok(queries.includes("legrand"));
});

test("detects bot challenge pages", () => {
  assert.equal(shared.isBotChallengePage("<title>Client Challenge</title>"), true);
  assert.equal(shared.isBotChallengePage("<html><body>window.bobcmn=1</body></html>"), true);
  assert.equal(shared.isBotChallengePage("<html><body>normal shop</body></html>"), false);
});

test("extracts planeo fulltext prices from data-test-value", () => {
  const html = `
    <div data-gtm-product-name="Legrand L049401 rozbočovací zásuvka">
      <a href="/legrand-l049401">Legrand L049401 rozbočovací zásuvka</a>
      <strong data-testid="fulltext.item.price" data-test-value="24.90">24,90&nbsp;€</strong>
    </div>
  `;
  const [candidate] = shared.extractProductCandidates(html, "https://www.planeo.sk/", "Legrand");

  assert.equal(candidate.title, "Legrand L049401 rozbočovací zásuvka");
  assert.equal(candidate.price.value, 24.9);
});

test("builds andreashop.sk search requests", () => {
  const [request] = shared.buildSearchRequests("andreashop.sk", "Samsung Galaxy");

  assert.equal(
    request.url,
    "https://www.andreashop.sk/vyhladavanie?search=Samsung%20Galaxy"
  );
  assert.equal(shared.hasSearchTemplate("andreashop.sk"), true);
});

test("builds tetadrogerie.cz search requests", () => {
  const [request] = shared.buildSearchRequests("tetadrogerie.cz", "BREF Power");

  assert.equal(
    request.url,
    "https://www.tetadrogerie.cz/eshop/vysledky-vyhledavani?searchtext=BREF+Power"
  );
  assert.equal(shared.hasSearchTemplate("tetadrogerie.cz"), true);
});

test("extracts tetadrogerie.cz product cards from search HTML", () => {
  const html = `
    <a href="/eshop/katalog/bref-power-lemon" class="c-product-card__link">
      <img alt="Bref Power Aktiv Lemon 3 x 50 g">
      <strong class="c-product-card__title">Bref Power Aktiv Lemon 3 x 50 g</strong>
      <div class="c-product-price__value"><strong>79,90 Kč*</strong></div>
    </a>
  `;
  const [candidate] = shared.extractProductCandidates(html, "https://www.tetadrogerie.cz/", "BREF Power Lemon");

  assert.equal(candidate.title, "Bref Power Aktiv Lemon 3 x 50 g");
  assert.equal(candidate.price.value, 79.9);
  assert.match(candidate.url, /bref-power-lemon/);
});

test("builds rossmann.cz ajax search requests", () => {
  const [request] = shared.buildSearchRequests("rossmann.cz", "BREF");

  assert.equal(request.method, "GET");
  assert.equal(
    request.url,
    "https://www.rossmann.cz/vyhledavani$d4063-search.xml?query=BREF&async=true&limit=20"
  );
  assert.equal(request.displayUrl, "https://www.rossmann.cz/vyhledavani?q=BREF");
});

test("extracts rossmann.cz product tiles from ajax HTML", () => {
  const html = `
    <div class="product-tile">
      <h3 class="product-tile__title">
        <a href="/tuhy-wc-blok-color-aktiv-2">Tuhý WC blok Color Aktiv Eucalyptus</a>
      </h3>
      <span class="product-tile__sub--title">Bref</span>
      <span class="product-tile__price--final"><div>119 Kč</div></span>
    </div>
  `;
  const [candidate] = shared.extractProductCandidates(html, "https://www.rossmann.cz/", "BREF WC");

  assert.equal(candidate.title, "Bref Tuhý WC blok Color Aktiv Eucalyptus");
  assert.equal(candidate.price.value, 119);
  assert.match(candidate.url, /tuhy-wc-blok-color-aktiv-2/);
});

test("shop catalog owns search and detail verification policy", () => {
  assert.equal(shopCatalog.hasSearchTemplate("mi-store.sk"), true);
  assert.equal(shopCatalog.isManualOnly("heureka.sk"), true);
  assert.equal(shopCatalog.shouldVerifyDetailPrice("drmax.sk"), true);
  assert.equal(shopCatalog.shouldVerifyDetailPrice("heureka.sk"), false);
  assert.deepEqual(shopCatalog.getDefaultSearchShops("cz"), ["heureka.cz"]);
});

test("price guarantee checker returns manual rows for manual-only shops", async () => {
  const checker = priceGuarantee.createPriceGuaranteeChecker({
    fetchSearchRequest: async () => {
      throw new Error("manual shops should not be fetched");
    }
  });

  const result = await checker.checkShop("heureka.sk", "Samsung Galaxy");

  assert.equal(result.domain, "heureka.sk");
  assert.equal(result.state, "manual");
  assert.match(result.searchUrl, /heureka\.sk/);
  assert.match(result.message, /blokuje automaticku kontrolu/);
});

test("price guarantee checker verifies detail price behind its interface", async () => {
  const calls = [];
  const checker = priceGuarantee.createPriceGuaranteeChecker({
    fetchSearchRequest: async (request) => {
      calls.push(request.url);

      if (request.url.includes("drmax.sk/search")) {
        return {
          ok: true,
          status: 200,
          url: request.url,
          text: `
            <a href="/produkt/philips-hue-e27">Philips Hue White E27</a>
            <span>14,90 €</span>
          `
        };
      }

      return {
        ok: true,
        status: 200,
        url: "https://www.drmax.sk/produkt/philips-hue-e27",
        text: `
          <html>
            <head><link rel="canonical" href="https://www.drmax.sk/produkt/philips-hue-e27"></head>
            <body><h1>Philips Hue White E27</h1><span>12,90 €</span></body>
          </html>
        `
      };
    }
  });

  const result = await checker.checkShop("drmax.sk", "Philips Hue White E27");

  assert.equal(result.state, "found");
  assert.equal(result.price.value, 12.9);
  assert.equal(calls.length, 2);
});

test("unit price calculator parses quantities and formats Slovak per-piece prices", () => {
  const calculator = unitPriceCalculator.createUnitPriceCalculator({ locale: "sk" });
  const quantity = calculator.extractQuantity("LEGO stavebnica 500 dielikov");
  const unitPrice = calculator.computeUnitPrice(19.99, quantity);

  assert.deepEqual(quantity, { amount: 500, unit: "pcs" });
  assert.equal(unitPrice.text, "4,0 ct/ks (500 ks)");
});

test("unit price calculator parses Czech whole-crown prices", () => {
  const calculator = unitPriceCalculator.createUnitPriceCalculator({ locale: "cz" });

  assert.equal(calculator.extractFirstPrice("Cena 1 299,-"), 1299);
  assert.equal(calculator.hasPriceText("Cena 1 299,-"), true);
});
