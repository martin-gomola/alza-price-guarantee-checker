const assert = require("node:assert/strict");
const test = require("node:test");

const shared = require("./src/shared.js");

test("builds mi-store.sk search requests", () => {
  const [request] = shared.buildSearchRequests("mi-store.sk", "Samsung Galaxy Tab S10 FE+");

  assert.equal(request.method, "GET");
  assert.equal(request.url, "https://www.mi-store.sk/vyhladavanie?search=Samsung+Galaxy+Tab+S10+FE%2B");
  assert.equal(request.displayUrl, request.url);
});

test("includes mi-store.sk when merging supported shops", () => {
  assert.deepEqual(shared.mergeDefaultSearchShops(["mi-store.sk"], "sk"), [
    "heureka.sk",
    "mi-store.sk"
  ]);
  assert.equal(shared.hasSearchTemplate("mi-store.sk"), true);
});

test("describes blocked shop responses without HTTP codes", () => {
  assert.equal(
    shared.describeFetchFailure({ status: 403 }),
    "Obchod blokuje automaticku kontrolu. Overte cenu priamo na obchode."
  );
  assert.equal(
    shared.describeFetchFailure({ status: 429 }),
    "Obchod blokuje automaticku kontrolu. Overte cenu priamo na obchode."
  );
});

test("describes timeouts and network failures in plain language", () => {
  assert.equal(
    shared.describeFetchFailure({ error: "Request timed out" }),
    "Kontrola trvala prilis dlho. Skuste to priamo na obchode."
  );
  assert.equal(
    shared.describeFetchFailure({ status: 0, error: "Failed to fetch" }),
    "Nepodarilo sa spojit s obchodom. Skuste to priamo na obchode."
  );
});
