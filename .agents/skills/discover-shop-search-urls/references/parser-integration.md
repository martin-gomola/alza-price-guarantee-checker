# Parser integration (when URL is not enough)

Run `--probe DOMAIN` first. If diagnosis is `needs_parser`, follow this checklist.

## 1. Capture HTML

```bash
node .agents/skills/discover-shop-search-urls/scripts/discover-search-templates.js \
  --probe rossmann.cz --query BREF --save-fixture
```

Fixtures land in `references/fixtures/{domain}.html` (gitignored).

## 2. Find the product block

In DevTools or the fixture, locate one product card/tile. Note:

- Link `href` pattern
- Title location (`h3`, `alt`, `.c-product-card__title`, …)
- Price location (`.product-tile__price--final`, meta tags, JSON-LD)

## 3. Add extractor in `src/shared.js`

- Name: `extract{Shop}Candidates(html, baseUrl, queryTokens, queryText)`
- Use `buildCandidate()` for scoring/filtering consistency
- Register in `extractStructuredCandidates()` **before** generic extractors when shop-specific

Keep regex/HTML parsing minimal — one pattern per shop, mirror existing extractors (Teta, Rossmann, GTM, data-prodprice).

## 4. Add fixture test in `shared.test.js`

```javascript
test("extracts example.cz product cards", () => {
  const html = `...minimal realistic snippet...`;
  const [candidate] = shared.extractProductCandidates(html, "https://www.example.cz/", "query");
  assert.equal(candidate.price.value, 119);
});
```

Do not depend on live fetch in unit tests.

## 5. Optional: VERIFY_PRICE_DOMAINS

Add domain to `VERIFY_PRICE_DOMAINS` in `src/content.js` when search-result prices are promos/stale but detail pages are reliable.

## 6. Update skill references

Document the markup pattern in [template-patterns.md](template-patterns.md) and failure mode in [failure-modes.md](failure-modes.md).
