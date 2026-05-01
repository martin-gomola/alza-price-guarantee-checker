# Privacy Policy

**Alza Price Guarantee Checker** is a browser extension that compares Alza product prices with competitor shops used in Alza's price-guarantee workflow.

## Data Collection

This extension does **not** collect, sell, or share personal data. Specifically:

- No analytics or tracking scripts are included
- No data is sent to any developer-controlled remote server
- No browsing history is recorded
- No cookies are read or stored by the extension
- No accounts or registration are required

## How It Works

All processing happens locally in your browser:

1. The extension reads product information from the Alza.sk / Alza.cz page you are viewing
2. It fetches public search results from competitor e-shops to compare prices
3. Results are displayed directly on the page and are not stored or shared

## Network Requests

The extension makes requests only to domains listed in `host_permissions` in `manifest.json` (Alza, Heureka, and supported competitor shops) to fetch publicly available search or product pages needed for comparison. No credentials, auth tokens, or account data are included in these requests.

## Local Storage

The extension uses `chrome.storage.local` to save feature toggle preferences (for example UI cleanup, unit prices, and Heureka cleanup). This data stays on your device.

## Ad Blocking

The extension optionally blocks selected advertising/tracking domains on Alza and Heureka pages using Chrome's `declarativeNetRequest` API. This reduces page noise and improves comparison usability. This blocking does not collect personal data.

## Contact

For questions about this privacy policy, open an issue on the project's GitHub repository.

## Changes

This policy may be updated if the extension's functionality changes. The latest version is always available in this file.

*Last updated: May 2026*
