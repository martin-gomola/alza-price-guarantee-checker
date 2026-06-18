# Alza Price Guarantee Checker

Chrome extension focused on one primary purpose: helping users verify Alza price-guarantee eligibility by comparing Alza.sk and Alza.cz product prices with competitor shops listed in Alza's "Garancia najlepsej ceny" flow.

Supporting UX features (unit price, UI cleanup, and optional ad/tracker suppression on Alza and Heureka) are included only to make that comparison workflow faster and clearer.

> Results are generated automatically on a best-effort basis and may be inaccurate. Always verify the final product match and price manually. This extension is provided "as is", without warranties of any kind.

> **Transparency:** On **heureka.sk** and **heureka.cz**, the extension can hide on-page ad slots (CSS) and block selected third-party ad/tracker requests (network rules). This is optional via settings and does not change Heureka product data — it only reduces banners and tracking noise while you compare prices. See [Settings](#settings) and [Privacy](#privacy).

<img src="docs/store-screenshot.png" alt="Price comparison panel on Alza product page" width="600">

## Features

- **Price comparison** — searches 20+ Slovak and 13+ Czech e-shops (drmax, nay, czc, mall, datart, etc.) and extracts the best matching price; Heureka opens a manual search link (Cloudflare blocks automated fetch)
- **Two-step verification** — fetches competitor detail pages for accurate pricing via JSON-LD, OpenGraph meta tags, and DOM extraction
- **Unit price** — shows price per kg/liter on listing and detail pages; price per piece for LEGO sets
- **Ad & tracker blocking on Alza and Heureka** — `declarativeNetRequest` blocks selected third-party ad and analytics domains (e.g. Google Ads, Criteo, Facebook, Hotjar, Microsoft Clarity) before they load on Alza and Heureka pages
- **Heureka cleanup** — on **heureka.sk** and **heureka.cz**, hides banner slots, sponsored blocks, and leaderboard ads via CSS (toggle: *Heureka: skryť reklamy*); works together with the network rules above
- **UI cleanup on Alza** — hides instalment pricing, warranty upsells, delivery promos, branding banners, and footer clutter
- **Copy product name** — one-click clipboard copy from the product title

## Permissions rationale

- **`storage`** — saves on/off toggles for UI cleanup and unit-price display.
- **`declarativeNetRequest`** — blocks selected ad/tracker requests initiated from Alza and Heureka pages (see `src/rules.json`). No browsing history is collected; blocked requests are dropped locally in the browser.
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

Click the extension icon to open settings in a dedicated tab:

| Toggle | Default | What it does |
|--------|---------|--------------|
| Čistenie UI | on | Hides Alza clutter (splátky, warranties, banners) |
| Jednotková cena | on | Shows €/kg, Kč/kg, €/l, ct/ks where applicable |
| Heureka: skryť reklamy | on | Skryje bannery a sponzorované bloky na heureka.sk / heureka.cz (CSS). Sieťové blokovanie vybraných reklamných a analytických domén na Alze a Heureke je vždy zapnuté — viď nastavenia rozšírenia. |

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

## Privacy

What the extension does **not** do: collect, sell, or transmit personal data. Network requests go only to Alza, Heureka, and competitor shop domains needed for price comparison.

Heureka-specific behaviour (when the toggle is on):

- **CSS** — hides known ad/sponsored containers on heureka.sk and heureka.cz
- **Network** — blocks a fixed list of third-party ad/tracker hostnames via Chrome’s `declarativeNetRequest` API when those requests are initiated from Alza or Heureka pages

Full details: [PRIVACY.md](PRIVACY.md)

## Publish readiness

- Privacy policy: [PRIVACY.md](PRIVACY.md)
- License: [LICENSE](LICENSE)
- Chrome Web Store checklist and disclosure notes: [docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md)
