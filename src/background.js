importScripts("shared.js");

const FETCH_TIMEOUT_MS = 10000;
const HEUREKA_TAB_TIMEOUT_MS = 25000;
const HEUREKA_POLL_MS = 500;

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

function isHeurekaUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      hostname === "heureka.sk" ||
      hostname === "www.heureka.sk" ||
      hostname === "heureka.cz" ||
      hostname === "www.heureka.cz" ||
      hostname.endsWith(".heureka.sk") ||
      hostname.endsWith(".heureka.cz")
    );
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("Request timed out"));
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }).catch(reject);
  });
}

function readTabPage(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const html = document.documentElement?.outerHTML || "";
      const title = document.title || "";
      const sample = `${title}\n${html.slice(0, 12000)}`.toLowerCase();
      const isChallenge =
        sample.includes("just a moment") ||
        sample.includes("enable javascript") ||
        sample.includes("cf-browser-verification") ||
        sample.includes("challenge-platform") ||
        sample.includes("checking your browser");

      return {
        html,
        url: location.href,
        isChallenge,
        ready: html.length > 10000 && !isChallenge
      };
    }
  }).then((results) => results[0]?.result || null);
}

async function waitForHeurekaPage(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  await waitForTabComplete(tabId, Math.max(1000, deadline - Date.now()));

  while (Date.now() < deadline) {
    const page = await readTabPage(tabId);

    if (!page) {
      throw new Error("Nepodarilo sa nacitat stranku.");
    }

    if (page.ready) {
      return page;
    }

    await sleep(HEUREKA_POLL_MS);
  }

  throw new Error("Request timed out");
}

let hiddenTabQueue = Promise.resolve();

function enqueueHiddenTabFetch(url) {
  const task = hiddenTabQueue.then(() => fetchViaHiddenTab(url));
  hiddenTabQueue = task.catch(() => {});
  return task;
}

async function fetchViaHiddenTab(url) {
  let tabId = null;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;
    const page = await waitForHeurekaPage(tabId, HEUREKA_TAB_TIMEOUT_MS);

    return {
      ok: true,
      status: 200,
      url: page.url,
      text: page.html
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      error: error.name === "AbortError" ? "Request timed out" : error.message
    };
  } finally {
    if (tabId != null) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // Tab may already be closed.
      }
    }
  }
}

async function fetchForContentScript(message) {
  const method = (message.method || "GET").toUpperCase();

  if (method === "GET" && isHeurekaUrl(message.url)) {
    return enqueueHiddenTabFetch(message.url);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7"
  };

  if (message.body) {
    headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
  }

  try {
    const response = await fetch(message.url, {
      method,
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
