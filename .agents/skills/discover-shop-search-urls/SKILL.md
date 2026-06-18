---
name: discover-shop-search-urls
description: Discover search URLs and diagnose why Garancia najlepsej ceny shops fail in the Alza Price Guarantee Checker (missing template, bot block, AJAX endpoint, or parser gap). Use when a new shop appears in Alza's guarantee dialog, hasSearchTemplate is false, a shop shows only a homepage link or manual check despite having a template, or the user asks to add/fix shop search support.
---

# Discover Shop Search URLs

Find correct search URLs for Garancia shops **and** classify failures that need more than a template (AJAX fetch URL, custom parser, or manual-only acceptance).

## When to use

- New shop in guarantee dialog without `SEARCH_TEMPLATES` entry
- Shop shows **Skontrolovat na …** with error despite existing template
- User asks to add/fix support for a `.sk` / `.cz` competitor
- Periodic audit: manifest hosts vs configured templates

## Key files

| File | When to change |
|------|----------------|
| `src/shared.js` | `SEARCH_TEMPLATES`, shop-specific extractors |
| `manifest.json` | Missing `host_permissions` |
| `shared.test.js` | `buildSearchRequests` + extractor fixture tests |
| `src/content.js` | `VERIFY_PRICE_DOMAINS`, `MANUAL_ONLY_SHOPS` |
| `src/background.js` | Fetch headers when shops block bare requests |

Placeholders: `{query}` (`%20` spaces), `{queryPlus}` (`+` spaces).

Dual template (fetch ≠ browser URL):

```javascript
"rossmann.cz": [{
  url: "https://www.rossmann.cz/vyhledavani$d4063-search.xml?query={queryPlus}&async=true&limit=20",
  displayUrl: "https://www.rossmann.cz/vyhledavani?q={queryPlus}"
}]
```

## Commands

```bash
# Configured templates
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js --list

# Missing templates vs manifest
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js --audit

# Guess URL for a new shop
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js --discover newshop.cz --query "BREF"

# Diagnose existing shop (preferred after template exists)
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js --probe rossmann.cz --query "BREF"

# Save response HTML for parser work
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js --probe tetadrogerie.cz --save-fixture
```

Default probe query: `samsung`. Override with `--query`.

## Workflow (decision tree)

```
1. hasSearchTemplate(domain)?
   NO  → --discover → add template + manifest + buildSearchRequests test
   YES → --probe

2. --probe diagnosis?
   template_ok          → done; verify in extension
   needs_ajax_template  → dual SEARCH_TEMPLATES entry; see failure-modes.md
   needs_parser         → add extractor + fixture test; see parser-integration.md
   blocked              → manual link OK; try background.js User-Agent
   spa_shell            → DevTools Network; often not automatable (dm.cz)
   manual_only          → Heureka; display URL only
```

**Important:** `--discover` finding a 200 URL does **not** mean the extension will parse products. Always run `--probe` on configured shops.

## Apply a new template

1. Add to `SEARCH_TEMPLATES` in `src/shared.js` (SK/CZ blocks, alphabetical).
2. Add `host_permissions` in `manifest.json` if missing.
3. Add `buildSearchRequests` test in `shared.test.js`.
4. Run `--probe` — if `needs_parser`, follow [references/parser-integration.md](references/parser-integration.md).
5. Add to `VERIFY_PRICE_DOMAINS` when search snippets lie about price.
6. `npm test`, then reload extension and test on Alza product page.

## CZ drugstore cluster

Frequent Garancia CZ shops and typical outcomes — see [references/failure-modes.md](references/failure-modes.md):

| Shop | Status |
|------|--------|
| heureka.cz | Manual-only (Cloudflare) |
| dm.cz | URL OK; SPA + captcha blocks automation |
| drmax.cz, notino.cz | Often blocked (403) |
| rossmann.cz | AJAX XML fetch + tile parser |
| tetadrogerie.cz | SSR HTML + Teta card parser |

## Special cases

| Shop | Notes |
|------|-------|
| `heureka.sk/cz` | `MANUAL_ONLY_SHOPS`; template for manual link only |
| `abc-zoo.sk` | POST Luigi Box — never replace with guessed GET |
| `hornbach.sk` | Path search `/s/{query}` |
| `obi.sk` | Path search `/search/{queryPlus}` |
| `rossmann.cz` | `$d####` in AJAX path may change — refresh from search page HTML |

## References

- [template-patterns.md](references/template-patterns.md) — URL path conventions
- [failure-modes.md](references/failure-modes.md) — diagnosis codes and CZ cluster
- [parser-integration.md](references/parser-integration.md) — when HTML has products but parser returns 0

## Do not

- Treat every manual-check button as a missing template
- Commit templates without `--probe` or browser verification
- Add shops outside `.sk` / `.cz`
- Use Heureka/exit-click URLs as product links
