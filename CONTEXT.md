# Domain context

## Glossary

### Price-guarantee check

The user-triggered workflow that discovers shops from Alza's Garancia najlepsej ceny flow, searches supported shops, and returns automatic matches or manual verification links.

### Search result candidate

A competitor-shop product match with a title, price, URL, and match score. A candidate is accepted only when its product identity, quantity, condition, URL, and price satisfy the matching policy.

### Candidate extraction

The in-process transformation from a fetched shop document plus its URL and product query into the best search result candidate, or no candidate. It includes response unwrapping, format parsing, price parsing, URL resolution, matching, rejection, deduplication, scoring, and fallback ordering. Network fetching and shop search planning are outside candidate extraction.

### Shop plan

The ordered, in-process description of how a price-guarantee check will handle discovered shops for one locale and product name. Each entry is automatic, manual, or unsupported and contains the prepared search requests plus detail-verification policy. Fetching and candidate extraction are outside the shop plan.
