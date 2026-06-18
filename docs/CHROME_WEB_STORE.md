# Chrome Web Store Listing Notes

## Recommended Disclaimer (use exact text)

`Results are generated automatically on a best-effort basis and may be inaccurate. Always verify the final product match and price manually. This extension is provided "as is", without warranties of any kind.`

## Positioning

- Keep listing focused on one primary purpose: Alza price-guarantee comparison support.
- Describe UI cleanup/ad-tracker suppression as supporting usability features.
- Keep privacy disclosures aligned with `PRIVACY.md` and actual extension behavior.

## Permissions (store review)

- Do **not** request `tabs` or `scripting` — Chrome Web Store rejected v1.0.2 for unnecessary `tabs` use.
- Heureka (`heureka.sk` / `heureka.cz`) is **manual-only**: show a search link; Cloudflare blocks background fetch anyway.
- Only request: `storage`, `declarativeNetRequest`, and host permissions for supported shops.
