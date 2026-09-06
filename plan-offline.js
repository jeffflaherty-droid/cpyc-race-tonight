(function () {
  const PANEL_ID = "plan-offline-charts";
  let caching = false;
  function buttonByText(text) {
    return Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim() === text);
  }
  function waitFor(getValue, timeoutMs) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      function check() {
        const value = getValue();
        if (value) return resolve(value);
        if (Date.now() - startedAt >= timeoutMs) return resolve(null);
        window.setTimeout(check, 50);
      }
      check();
    });
  }
  async function runSafeAction(actionText) {
    const safeTab = buttonByText("SAFE");
    const planTab = buttonByText("PLAN");
    if (!safeTab || !planTab) return false;
    safeTab.click();
    await waitFor(() => safeTab.classList.contains("active"), 1500);

    // SAFE intentionally opens collapsed. Tap the active tab once more so its
    // controls (including the real chart-cache action) are mounted.
    const bottomPanel = safeTab.closest(".bottom-panel");
    if (bottomPanel && bottomPanel.classList.contains("collapsed")) {
      safeTab.click();
    }

    const action = await waitFor(
      () => Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent.trim().startsWith(actionText),
      ),
      2000,
    );
    if (!action) {
      planTab.click();
      window.setTimeout(ensurePlanPanel, 50);
      return false;
    }

    action.click();
    await waitFor(
      () => Array.from(document.querySelectorAll("button")).some((button) =>
        button.textContent.trim().startsWith(actionText === "Stop caching" ? "Cache trip charts" : "Stop caching"),
      ),
      1000,
    );
    planTab.click();
    window.setTimeout(ensurePlanPanel, 50);
    return true;
  }
  function ensurePlanPanel() {
    const planTab = buttonByText("PLAN");
    if (!planTab || !planTab.classList.contains("active")) return;
    const tabPanel = document.querySelector(".tab-panel");
    if (!tabPanel || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "trip-cache";
    panel.innerHTML = '<p class="trip-cache-title">OFFLINE CHARTS — SELECTED MAP AREA</p><button type="button" class="action-btn">' + (caching ? 'Stop caching' : 'Cache trip charts') + '</button><p class="trip-cache-note">' + (caching ? 'Downloading charts now. Keep the app open and the screen on for a few minutes.' : 'First choose Burlington with the map search button. Then download the visible chart area for offline use for about 30 days.') + '</p>';
    panel.querySelector("button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const stopping = button.textContent.startsWith("Stop");
      button.disabled = true;
      panel.querySelector(".trip-cache-note").textContent = stopping ? "Stopping chart download..." : "Starting chart download...";
      const started = await runSafeAction(stopping ? "Stop caching" : "Cache trip charts");
      if (!started) {
        button.disabled = false;
        panel.querySelector(".trip-cache-note").textContent = "Could not start the download. Tap SAFE, tap SAFE again to open it, then use Cache trip charts there.";
        return;
      }
      caching = !stopping;
      button.textContent = stopping ? "Cache trip charts" : "Stop caching";
      button.disabled = false;
      panel.querySelector(".trip-cache-note").textContent = stopping ? "Caching stopped." : "Downloading charts now. Keep the app open and the screen on for a few minutes.";
      const visiblePanel = document.getElementById(PANEL_ID);
      if (visiblePanel && visiblePanel !== panel) {
        visiblePanel.querySelector("button").textContent = stopping ? "Cache trip charts" : "Stop caching";
        visiblePanel.querySelector(".trip-cache-note").textContent = stopping ? "Caching stopped." : "Downloading charts now. Keep the app open and the screen on for a few minutes.";
      }
    });
    tabPanel.appendChild(panel);
  }
  new MutationObserver(ensurePlanPanel).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", ensurePlanPanel);
})();
