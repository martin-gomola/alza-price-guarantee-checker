(function attachShopCatalog(root) {
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
    "4camping.sk": ["https://www.4camping.sk/vyhladavanie/?w={query}"],
    "4kids.sk": ["https://www.4kids.sk/vyhladavanie/?q={queryPlus}"],
    "alltoys.sk": ["https://www.alltoys.sk/vyhladavanie/?q={queryPlus}"],
    "andreashop.sk": ["https://www.andreashop.sk/vyhladavanie?search={query}"],
    "benulekaren.sk": ["https://www.benulekaren.sk/vyhladavanie?q={queryPlus}"],
    "decathlon.sk": ["https://www.decathlon.sk/search/?query={queryPlus}"],
    "dracik.sk": ["https://www.dracik.sk/search/?q={queryPlus}"],
    "drmax.sk": ["https://www.drmax.sk/search?q={queryPlus}"],
    "heureka.sk": ["https://www.heureka.sk/?h%5Bfraze%5D={queryPlus}"],
    "hornbach.sk": ["https://www.hornbach.sk/s/{query}?isInitialRequest=false"],
    "hudysport.sk": ["https://www.hudysport.sk/vyhledavani?q={query}"],
    "istores.sk": ["https://www.istores.sk/vyhladavanie?q={queryPlus}"],
    "istyle.sk": ["https://istyle.sk/search?type=product&q={queryPlus}"],
    "kytary.sk": ["https://kytary.sk/Search/?term={query}&kw={query}"],
    "mi-store.sk": ["https://www.mi-store.sk/vyhladavanie?search={queryPlus}"],
    "mojadm.sk": ["https://www.mojadm.sk/search?query={query}&searchProviderType=dm-products"],
    "nay.sk": ["https://www.nay.sk/vyhladavanie?q={query}"],
    "obi.sk": ["https://www.obi.sk/search/{queryPlus}"],
    "planeo.sk": ["https://www.planeo.sk/vyhladavanie$a1013-search?query={queryPlus}"],
    "pompo.sk": ["https://www.pompo.sk/vyhladavanie?q={queryPlus}"],
    "profizoo.sk": ["https://profizoo.sk/vyhledavani/?search={queryPlus}"],
    "petcenter.sk": ["https://www.petcenter.sk/vyhladavanie/?string={query}"],
    "spokojnypes.sk": ["https://www.spokojnypes.sk/hledej?search={queryPlus}"],
    "smarty.sk": ["https://www.smarty.sk/Vyhladavanie?query={query}"],
    "sportisimo.sk": ["https://www.sportisimo.sk/vyhladavanie-produktov/?q={queryPlus}"],
    "superzoo.sk": ["https://www.superzoo.sk/hladanie/?query={query}"],
    "tetadrogerie.sk": ["https://www.tetadrogerie.sk/produkty/?hladaj={queryPlus}"],
    "tetadrogerie.cz": ["https://www.tetadrogerie.cz/eshop/vysledky-vyhledavani?searchtext={queryPlus}"],

    "czc.cz": ["https://www.czc.cz/hledani?q={queryPlus}"],
    "datart.cz": ["https://www.datart.cz/search/?q={queryPlus}"],
    "decathlon.cz": ["https://www.decathlon.cz/search/?query={queryPlus}"],
    "dm.cz": ["https://www.dm.cz/search?query={query}&searchProviderType=dm-products"],
    "drmax.cz": ["https://www.drmax.cz/search?q={queryPlus}"],
    "heureka.cz": ["https://www.heureka.cz/?h%5Bfraze%5D={queryPlus}"],
    "kasa.cz": ["https://www.kasa.cz/search?q={queryPlus}"],
    "mall.cz": ["https://www.mall.cz/hledej?s={queryPlus}"],
    "mironet.cz": ["https://www.mironet.cz/search/?q={queryPlus}"],
    "mountfield.cz": ["https://www.mountfield.cz/hledani?q={queryPlus}"],
    "notino.cz": ["https://www.notino.cz/hledani/?q={queryPlus}"],
    "pilulka.cz": ["https://www.pilulka.cz/hledani?q={queryPlus}"],
    "rossmann.cz": [{
      url: "https://www.rossmann.cz/vyhledavani$d4063-search.xml?query={queryPlus}&async=true&limit=20",
      displayUrl: "https://www.rossmann.cz/vyhledavani?q={queryPlus}"
    }],
    "sportisimo.cz": ["https://www.sportisimo.cz/vyhledavani-produktu/?q={queryPlus}"],
    "tsbohemia.cz": ["https://www.tsbohemia.cz/hledani_c0.html?SearchText={queryPlus}"]
  };

  const DEFAULT_SEARCH_SHOPS = {
    sk: ["heureka.sk"],
    cz: ["heureka.cz"]
  };

  const MANUAL_ONLY_SHOPS = new Set(["heureka.sk", "heureka.cz"]);

  const DETAIL_VERIFICATION_SHOPS = new Set([
    "4kids.sk",
    "abc-zoo.sk",
    "alltoys.sk",
    "benulekaren.sk",
    "decathlon.sk",
    "dracik.sk",
    "drmax.sk",
    "hudysport.sk",
    "istores.sk",
    "istyle.sk",
    "kytary.sk",
    "mojadm.sk",
    "nay.sk",
    "petcenter.sk",
    "planeo.sk",
    "pompo.sk",
    "profizoo.sk",
    "smarty.sk",
    "spokojnypes.sk",
    "superzoo.sk",
    "tetadrogerie.sk",
    "tetadrogerie.cz",
    "czc.cz",
    "datart.cz",
    "decathlon.cz",
    "dm.cz",
    "drmax.cz",
    "kasa.cz",
    "mall.cz",
    "mironet.cz",
    "notino.cz",
    "pilulka.cz",
    "rossmann.cz",
    "sportisimo.cz",
    "tsbohemia.cz"
  ]);

  function normalizeDomain(domain) {
    if (SEARCH_TEMPLATES[domain]) return domain;

    const stripped = String(domain || "").replace(/^[a-z]/, "");
    if (SEARCH_TEMPLATES[stripped]) return stripped;

    return domain;
  }

  function hasSearchTemplate(domain) {
    return Boolean(SEARCH_TEMPLATES[normalizeDomain(domain)]);
  }

  function getSearchTemplates(domain) {
    return SEARCH_TEMPLATES[normalizeDomain(domain)] || [
      "/search?q={query}",
      "/vyhladavanie/?string={query}",
      "/vyhladavani?q={query}"
    ];
  }

  function getDefaultSearchShops(locale) {
    return DEFAULT_SEARCH_SHOPS[locale === "cz" ? "cz" : "sk"];
  }

  function isManualOnly(domain) {
    return MANUAL_ONLY_SHOPS.has(normalizeDomain(domain));
  }

  function shouldVerifyDetailPrice(domain) {
    return DETAIL_VERIFICATION_SHOPS.has(normalizeDomain(domain));
  }

  const api = {
    getDefaultSearchShops,
    getSearchTemplates,
    hasSearchTemplate,
    isManualOnly,
    normalizeDomain,
    shouldVerifyDetailPrice
  };

  root.AlzaCheckerShopCatalog = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
