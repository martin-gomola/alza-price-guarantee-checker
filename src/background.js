importScripts("shared.js");

const FETCH_TIMEOUT_MS = 10000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "alza-checker:fetch-text") {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  fetch(message.url, {
    method: message.method || "GET",
    body: message.body || undefined,
    credentials: "include",
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
      "content-type": message.body ? "application/x-www-form-urlencoded;charset=UTF-8" : "text/plain;charset=UTF-8"
    }
  })
    .then(async (response) => {
      const text = await response.text();

      sendResponse({
        ok: response.ok,
        status: response.status,
        url: response.url,
        text
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        url: message.url,
        error: error.name === "AbortError" ? "Request timed out" : error.message
      });
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  return true;
});
