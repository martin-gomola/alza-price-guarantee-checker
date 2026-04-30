importScripts("shared.js");

const FETCH_TIMEOUT_MS = 10000;

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

async function fetchForContentScript(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(message.url, {
      method: message.method || "GET",
      body: message.body || undefined,
      credentials: "include",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "content-type": message.body ? "application/x-www-form-urlencoded;charset=UTF-8" : "text/plain;charset=UTF-8"
      }
    });

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text: await response.text()
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: message.url,
      error: error.name === "AbortError" ? "Request timed out" : error.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "alza-checker:fetch-text") {
    return false;
  }

  fetchForContentScript(message).then(sendResponse);
  return true;
});
