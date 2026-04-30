(async function gateAlzaCleanup() {
  if (!chrome?.storage?.local) return;
  try {
    const stored = await chrome.storage.local.get({ uiCleanupEnabled: true });
    if (stored.uiCleanupEnabled === false) {
      document.documentElement.classList.add("alza-checker-no-cleanup");
    }
  } catch {}
})();
