(function attachShopCatalog(root) {
  const SHOP_POLICIES = {
    "abc-zoo.sk": {
      "searchTemplates": [
        {
          "url": "https://abc-zoo.sk/modules/luigiboxapi/luigiboxapi-ajax.php",
          "displayUrl": "https://abc-zoo.sk/modules/luigiboxapi/search.php?search_query={query}&orderby=position&orderway=desc",
          "method": "POST",
          "body": "action=getProducts&query={query}&ob=position&ow=desc&p=1&n=32"
        },
        "https://abc-zoo.sk/modules/luigiboxapi/search.php?search_query={query}&orderby=position&orderway=desc"
      ],
      "verifyDetailPrice": true
    },
    "4camping.sk": {
      "searchTemplates": [
        "https://www.4camping.sk/vyhladavanie/?w={query}"
      ]
    },
    "4kids.sk": {
      "searchTemplates": [
        "https://www.4kids.sk/vyhladavanie/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "alltoys.sk": {
      "searchTemplates": [
        "https://www.alltoys.sk/vyhladavanie/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "andreashop.sk": {
      "searchTemplates": [
        "https://www.andreashop.sk/vyhladavanie?search={query}"
      ]
    },
    "benulekaren.sk": {
      "searchTemplates": [
        "https://www.benulekaren.sk/vyhladavanie?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "decathlon.sk": {
      "searchTemplates": [
        "https://www.decathlon.sk/search/?query={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "dracik.sk": {
      "searchTemplates": [
        "https://www.dracik.sk/search/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "drmax.sk": {
      "searchTemplates": [
        "https://www.drmax.sk/search?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "heureka.sk": {
      "searchTemplates": [
        "https://www.heureka.sk/?h%5Bfraze%5D={queryPlus}"
      ],
      "mode": "manual",
      "defaultLocales": [
        "sk"
      ]
    },
    "hornbach.sk": {
      "searchTemplates": [
        "https://www.hornbach.sk/s/{query}?isInitialRequest=false"
      ]
    },
    "hudysport.sk": {
      "searchTemplates": [
        "https://www.hudysport.sk/vyhledavani?q={query}"
      ],
      "verifyDetailPrice": true
    },
    "istores.sk": {
      "searchTemplates": [
        "https://www.istores.sk/vyhladavanie?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "istyle.sk": {
      "searchTemplates": [
        "https://istyle.sk/search?type=product&q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "kytary.sk": {
      "searchTemplates": [
        "https://kytary.sk/Search/?term={query}&kw={query}"
      ],
      "verifyDetailPrice": true
    },
    "mi-store.sk": {
      "searchTemplates": [
        "https://www.mi-store.sk/vyhladavanie?search={queryPlus}"
      ]
    },
    "mojadm.sk": {
      "searchTemplates": [
        "https://www.mojadm.sk/search?query={query}&searchProviderType=dm-products"
      ],
      "verifyDetailPrice": true
    },
    "nay.sk": {
      "searchTemplates": [
        "https://www.nay.sk/vyhladavanie?q={query}"
      ],
      "verifyDetailPrice": true
    },
    "obi.sk": {
      "searchTemplates": [
        "https://www.obi.sk/search/{queryPlus}"
      ]
    },
    "planeo.sk": {
      "searchTemplates": [
        "https://www.planeo.sk/vyhladavanie$a1013-search?query={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "pompo.sk": {
      "searchTemplates": [
        "https://www.pompo.sk/vyhladavanie?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "profizoo.sk": {
      "searchTemplates": [
        "https://profizoo.sk/vyhledavani/?search={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "petcenter.sk": {
      "searchTemplates": [
        "https://www.petcenter.sk/vyhladavanie/?string={query}"
      ],
      "verifyDetailPrice": true
    },
    "spokojnypes.sk": {
      "searchTemplates": [
        "https://www.spokojnypes.sk/hledej?search={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "smarty.sk": {
      "searchTemplates": [
        "https://www.smarty.sk/Vyhladavanie?query={query}"
      ],
      "verifyDetailPrice": true
    },
    "sportisimo.sk": {
      "searchTemplates": [
        "https://www.sportisimo.sk/vyhladavanie-produktov/?q={queryPlus}"
      ]
    },
    "superzoo.sk": {
      "searchTemplates": [
        "https://www.superzoo.sk/hladanie/?query={query}"
      ],
      "verifyDetailPrice": true
    },
    "tetadrogerie.sk": {
      "searchTemplates": [
        "https://www.tetadrogerie.sk/produkty/?hladaj={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "tetadrogerie.cz": {
      "searchTemplates": [
        "https://www.tetadrogerie.cz/eshop/vysledky-vyhledavani?searchtext={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "czc.cz": {
      "searchTemplates": [
        "https://www.czc.cz/hledani?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "datart.cz": {
      "searchTemplates": [
        "https://www.datart.cz/search/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "decathlon.cz": {
      "searchTemplates": [
        "https://www.decathlon.cz/search/?query={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "dm.cz": {
      "searchTemplates": [
        "https://www.dm.cz/search?query={query}&searchProviderType=dm-products"
      ],
      "verifyDetailPrice": true
    },
    "drmax.cz": {
      "searchTemplates": [
        "https://www.drmax.cz/search?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "heureka.cz": {
      "searchTemplates": [
        "https://www.heureka.cz/?h%5Bfraze%5D={queryPlus}"
      ],
      "mode": "manual",
      "defaultLocales": [
        "cz"
      ]
    },
    "kasa.cz": {
      "searchTemplates": [
        "https://www.kasa.cz/search?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "mall.cz": {
      "searchTemplates": [
        "https://www.mall.cz/hledej?s={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "mironet.cz": {
      "searchTemplates": [
        "https://www.mironet.cz/search/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "mountfield.cz": {
      "searchTemplates": [
        "https://www.mountfield.cz/hledani?q={queryPlus}"
      ]
    },
    "notino.cz": {
      "searchTemplates": [
        "https://www.notino.cz/hledani/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "pilulka.cz": {
      "searchTemplates": [
        "https://www.pilulka.cz/hledani?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "rossmann.cz": {
      "searchTemplates": [
        {
          "url": "https://www.rossmann.cz/vyhledavani$d4063-search.xml?query={queryPlus}&async=true&limit=20",
          "displayUrl": "https://www.rossmann.cz/vyhledavani?q={queryPlus}"
        }
      ],
      "verifyDetailPrice": true
    },
    "sportisimo.cz": {
      "searchTemplates": [
        "https://www.sportisimo.cz/vyhledavani-produktu/?q={queryPlus}"
      ],
      "verifyDetailPrice": true
    },
    "tsbohemia.cz": {
      "searchTemplates": [
        "https://www.tsbohemia.cz/hledani_c0.html?SearchText={queryPlus}"
      ],
      "verifyDetailPrice": true
    }
  };

  function normalizeDomain(domain) {
    const value = String(domain || "").toLowerCase().replace(/^www\./, "");
    return SHOP_POLICIES[value] ? value : String(domain || "");
  }

  function getShopPolicy(domain) {
    const normalizedDomain = normalizeDomain(domain);
    const policy = SHOP_POLICIES[normalizedDomain];

    if (!policy) {
      return null;
    }

    return {
      domain: normalizedDomain,
      mode: policy.mode || "automatic",
      searchTemplates: policy.searchTemplates,
      verifyDetailPrice: policy.verifyDetailPrice === true
    };
  }

  function getDefaultSearchShops(locale) {
    const normalizedLocale = locale === "cz" ? "cz" : "sk";

    return Object.entries(SHOP_POLICIES)
      .filter(([, policy]) => policy.defaultLocales?.includes(normalizedLocale))
      .map(([domain]) => domain);
  }

  const api = {
    getDefaultSearchShops,
    getShopPolicy,
    normalizeDomain
  };

  root.AlzaCheckerShopCatalog = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
