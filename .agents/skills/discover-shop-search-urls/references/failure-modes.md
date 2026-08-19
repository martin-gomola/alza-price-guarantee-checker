# Failure mode classification

Use after `--probe` or when the extension shows manual/error for a shop that already has a template.

## Diagnosis codes

| Code | Meaning | Next step |
|------|---------|-----------|
| `template_missing` | No shop policy | Run `--discover`, add policy + manifest + test |
| `template_ok` | HTTP 200, `findBestCandidate` returns a candidate | Done — verify in extension |
| `needs_parser` | HTTP 200, prices in HTML, no candidate, parser signals present | Add extractor in `candidate-extraction.js` + fixture test |
| `needs_ajax_template` | Display URL 200 but empty shell; AJAX endpoint found in HTML | Dual template (`url` + `displayUrl`) |
| `blocked` | HTTP 403/429, Cloudflare/captcha, or bot challenge (`Client Challenge`, Akamai TSPD) in body | Manual link only; not fixable via AJAX from extension fetch |
| `spa_shell` | HTTP 200, tiny HTML, no prices, no parser signals | DevTools Network tab; likely unsolvable without API |
| `manual_only` | Shop policy uses `mode: "manual"` (Heureka) | Template for display URL only |

## Parser signals (needs_parser)

HTML contains shop-specific product markup the generic parser misses:

| Signal | Shop | Extractor |
|--------|------|-----------|
| `c-product-card__link` | tetadrogerie.cz | `extractTetaProductCardCandidates` |
| `product-tile__title` | rossmann.cz | `extractRossmannProductTileCandidates` (fetch AJAX XML, not display URL) |
| `data-gtm-product-name` | many shops | already handled |
| `data-prodprice` | istyle-style | already handled |

## AJAX / dual-template signals (needs_ajax_template)

| Signal | Example |
|--------|---------|
| `data-ajax-url="…search.xml"` | rossmann.cz |
| `/vyhledavani$d####-search.xml` | rossmann.cz (ID changes on redeploy) |
| POST + JSON/HTML fragment response | abc-zoo.sk (Luigi Box) |
| `product-search.services.dmtech.com` | dm.cz (not yet integrated) |

Dual-template shape:

```javascript
"shop.cz": [{
  url: "https://www.shop.cz/ajax-endpoint?query={queryPlus}",
  displayUrl: "https://www.shop.cz/search?q={queryPlus}"
}]
```

## CZ drugstore cluster (Garancia frequent)

| Shop | Typical failure | Notes |
|------|-----------------|-------|
| heureka.cz | `manual_only` | Cloudflare; expected |
| dm.cz | `spa_shell` / captcha | URL correct; SPA + reCAPTCHA |
| drmax.cz | `blocked` | Cloudflare 403 from extension fetch |
| notino.cz | `blocked` | Cloudflare 403 |
| rossmann.cz | was `needs_ajax_template` + `needs_parser` | Fixed via AJAX template + tile extractor |
| tetadrogerie.cz | was `needs_parser` | Fixed via Teta card extractor |

## SK bot-protected cluster

| Shop | Typical failure | Notes |
|------|-----------------|-------|
| hornbach.sk | `blocked` | Fastly Client Challenge on bare fetch; GraphQL also gated |
| nay.sk | `blocked` | Akamai TSPD challenge page (HTTP 200) |
| obi.sk | `blocked` / geo 404 | CloudFront may 404 outside SK; challenge from some regions |

When the extension previously showed “Nenašla sa zhodná ponuka” for these shops, it was often a bot challenge page misclassified as an empty search result. `isBotChallengePage()` now maps these to the blocked message.

## Matching vs parsing (planeo.sk)

Planeo returns SSR HTML with `data-gtm-product-name` tiles. Failures can be **strict token matching** (product line name absent from competitor titles) rather than a bad URL. Shop planning adds progressive variants: brand-only, brand + model token, and queries with color words stripped.

## Rossmann AJAX ID refresh

When Rossmann search breaks after a site deploy:

```bash
curl -sL "https://www.rossmann.cz/vyhledavani?q=test" | rg -o 'vyhledavani\$d[0-9]+-search\.xml' | head -1
```

Update `$d####` in the `rossmann.cz` policy in `src/shop-catalog.js`.
