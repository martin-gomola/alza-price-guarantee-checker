importScripts("shared.js");

const FETCH_TIMEOUT_MS = 10000;

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

async function fetchForContentScript(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "accept-language": "cs-CZ,cs;q=0.9,sk-SK;q=0.8,en;q=0.7",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  if (message.body) {
    headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
  }

  try {
    const response = await fetch(message.url, {
      method: message.method || "GET",
      body: message.body || undefined,
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
      headers
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
