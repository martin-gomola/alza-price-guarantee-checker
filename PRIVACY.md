# Privacy Policy

**Alza Price Guarantee Checker** is a browser extension that compares product prices on Alza.sk with competitor shops.

## Data Collection

This extension does **not** collect, store, or transmit any personal data. Specifically:

- No analytics or tracking scripts are included
- No user data is sent to any remote server
- No browsing history is recorded
- No cookies are read or stored by the extension
- No accounts or registration are required

## How It Works

All processing happens locally in your browser:

1. The extension reads product information from the Alza.sk page you are viewing
2. It fetches public search results from competitor e-shops to compare prices
3. Results are displayed directly on the page and are not stored or shared

## Network Requests

The extension makes requests only to the e-shop domains listed in its permissions (alza.sk, heureka.sk, drmax.sk, nay.sk, etc.) to fetch publicly available search results and product pages. No credentials or personal data are included in these requests.

## Local Storage

The extension uses `chrome.storage.local` to save your feature toggle preferences (e.g., whether ad blocking or unit prices are enabled). This data never leaves your device.

## Ad Blocking

The extension optionally blocks known advertising and tracking domains (Google Ads, Facebook, Criteo, etc.) on Alza.sk and Heureka.sk to improve page load performance. This is done via Chrome's `declarativeNetRequest` API and involves no data collection.

## Contact

For questions about this privacy policy, open an issue on the project's GitHub repository.

## Changes

This policy may be updated if the extension's functionality changes. The latest version is always available in this file.

*Last updated: April 2026*
