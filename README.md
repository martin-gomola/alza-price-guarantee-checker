# Alza Price Guarantee Checker

Chrome extension focused on one primary purpose: helping users verify Alza price-guarantee eligibility by comparing Alza.sk and Alza.cz product prices with competitor shops listed in Alza's "Garancia najlepsej ceny" flow.

Supporting UX features (unit price, cleanup, ad/tracker suppression on relevant pages) are included only to make that comparison workflow faster and clearer.

> Results are generated automatically on a best-effort basis and may be inaccurate. Always verify the final product match and price manually. This extension is provided "as is", without warranties of any kind.

<img src="docs/store-screenshot.png" alt="Price comparison panel on Alza product page" width="600">

## Features

- **Price comparison** — searches 20+ Slovak and 13+ Czech e-shops (heureka, drmax, nay, czc, mall, datart, etc.) and extracts the best matching price
- **Two-step verification** — fetches competitor detail pages for accurate pricing via JSON-LD, OpenGraph meta tags, and DOM extraction
- **Unit price** — shows price per kg/liter on listing and detail pages; price per piece for LEGO sets
- **Ad blocking** — `declarativeNetRequest` rules kill Google Ads, Criteo, Facebook, Hotjar, Clarity, and 10 other tracking domains before they load
- **UI cleanup** — hides instalment pricing, warranty upsells, delivery promos, branding banners, and footer clutter on Alza; hides ads on Heureka
- **Copy product name** — one-click clipboard copy from the product title

## Permissions rationale

- **`storage`** — saves on/off toggles for UI cleanup and unit-price display.
- **`declarativeNetRequest`** — blocks selected ad/tracker requests on Alza/Heureka pages to reduce noise and speed up price-check UX.
- **`tabs` / `scripting`** — opens a short-lived background tab on Heureka only, so Cloudflare-protected search pages can load in a real browser context.
- **Host permissions** — required to fetch public search/result pages from shops that participate in the Alza guarantee comparison flow.

## Install

### From GitHub Release (recommended)

1. Download the latest `.zip` from [Releases](https://github.com/martin-gomola/alza-price-guarantee-checker/releases)
2. Extract the zip to a folder
3. Open `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked**, select the extracted folder
6. Visit any Alza.sk or Alza.cz product page

### From source

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**, select the repo folder
5. Visit any Alza.sk or Alza.cz product page

The comparison panel appears below the buy button. Click **Skontrolovať konkurenciu** to run.

## Settings

Click the extension icon to toggle:

| Toggle | Default | What it does |
|--------|---------|--------------|
| Čistenie UI | on | Hides Alza clutter (splátky, warranties, banners) |
| Jednotková cena | on | Shows €/kg, Kč/kg, €/l, ct/ks where applicable |
| Heureka: skryť reklamy | on | Hides banner ads on heureka.sk and heureka.cz |

## How it works

1. Reads the product name and price from the Alza page
2. Detects supported shops from Alza's price guarantee dialog or API
3. Searches each shop (heureka first, then alphabetical)
4. Parses results: JSON-LD structured data > meta tags > DOM heuristics > full-text regex
5. Optionally fetches the detail page for price verification
6. Displays results with direct links

## Verify

```sh
make test
# or: npm test
```

## Release

```sh
make version VERSION=1.0.3   # sync version in package.json + manifest.json
make dist                    # test + zip → dist/alza-price-guarantee-checker-v1.0.3.zip
```

Then commit, tag, and publish:

```sh
git add package.json manifest.json
git commit -m "Release v1.0.3: …"
git tag v1.0.3
git push origin main --tags
gh release create v1.0.3 dist/alza-price-guarantee-checker-v1.0.3.zip --title v1.0.3 --notes "…"
```

Upload the same zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Publish readiness

- Privacy policy: [PRIVACY.md](PRIVACY.md)
- License: [LICENSE](LICENSE)
- Chrome Web Store checklist and disclosure notes: [docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md)
