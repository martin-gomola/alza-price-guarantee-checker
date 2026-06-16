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
