# Alza Price Guarantee Checker

Unpacked Chrome extension for Alza.sk product pages. It reads the product name and Alza price, loads shops supported by `Garancia najlepsej ceny`, searches those shops, then lists the best matching product price and link it can extract.

## Install locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this repository folder.
5. Open an Alza.sk product page and click `Skontrolovat konkurenciu` in the injected panel.

## Notes

This is a generic first pass. Supported shops do not share one product API or one HTML layout, so the extension searches each supported shop and extracts the strongest price-like product match from the returned HTML. Rows that cannot be matched include a search link for manual checking.

## Verify

```sh
npm test
```
