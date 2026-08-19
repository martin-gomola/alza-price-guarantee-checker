# Search URL patterns (SK/CZ e-shops)

Try `{queryPlus}` first, then `{query}`.

## Slovak

| Pattern | Example shops |
|---------|---------------|
| `/vyhladavanie?q={queryPlus}` | 4kids.sk, alltoys.sk, pompo.sk |
| `/vyhladavanie?q={query}` | nay.sk |
| `/vyhladavanie/?string={query}` | petcenter.sk |
| `/vyhladavanie?search={queryPlus}` | mi-store.sk |
| `/hladanie/?query={query}` | superzoo.sk |
| `/search?q={queryPlus}` | drmax.sk, dracik.sk |
| `/search?query={query}` | mojadm.sk (+ `searchProviderType=dm-products`) |
| `/search/{queryPlus}` | obi.sk |
| `/s/{query}` | hornbach.sk |
| `/produkty/?hladaj={queryPlus}` | tetadrogerie.sk |

## Czech

| Pattern | Example shops |
|---------|---------------|
| `/hledani?q={queryPlus}` | czc.cz, mountfield.cz, pilulka.cz |
| `/search?q={queryPlus}` | datart.cz, drmax.cz, kasa.cz, mironet.cz |
| `/search?query={query}&searchProviderType=dm-products` | dm.cz |
| `/hledej?s={queryPlus}` | mall.cz |
| `/vyhledavani-produktu/?q={queryPlus}` | sportisimo.cz |
| `/eshop/vysledky-vyhledavani?searchtext={queryPlus}` | tetadrogerie.cz |
| Display: `/vyhledavani?q=` · Fetch: `/vyhledavani$d####-search.xml?query=&async=true` | rossmann.cz |

## When URL is not enough

| Symptom | Likely fix |
|---------|------------|
| 403/429 from fetch | Manual fallback; browser-like headers in `background.js` |
| 200 HTML, 0 products, `< 15 KB` | SPA shell (dm.cz) — inspect Network tab |
| 200 HTML, prices visible, no candidate | Shop-specific extractor in `candidate-extraction.js` |
| Display page empty, `data-ajax-url` in HTML | Dual template (rossmann.cz pattern) |
| POST body in Network tab | Dual template with `method`/`body` (abc-zoo.sk) |

See [failure-modes.md](failure-modes.md) and [parser-integration.md](parser-integration.md).

## HTML signals on homepage / search page

- Form `name`: `q`, `query`, `search`, `string`, `term`, `hladaj`, `searchtext`, `SearchText`
- `data-ajax-url`, `data-search-url`, Luigi Box, Algolia
- `application/ld+json` Product entries
- Parser markers: `c-product-card__link`, `product-tile__title`, `data-gtm-product-name`

## Verification checklist

- [ ] `--probe` returns `template_ok` (not just `--discover` 200)
- [ ] `displayUrl` opens correct search in browser
- [ ] `npm test` includes a shop-plan request + candidate-extraction fixture if applicable
- [ ] Extension panel shows price or intentional manual message
