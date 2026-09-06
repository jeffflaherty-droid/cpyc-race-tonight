(function () {
  const PANEL_ID = "plan-offline-charts";
  function buttonByText(text) {
    return Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim() === text);
  }
  function runSafeAction(actionText) {
    const safeTab = buttonByText("SAFE");
    const planTab = buttonByText("PLAN");
    if (!safeTab || !planTab) return false;
    safeTab.click();
    window.setTimeout(() => {
      const action = Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim().startsWith(actionText));
      if (action) action.click();
      planTab.click();
      window.setTimeout(ensurePlanPanel, 50);
    }, 50);
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
    panel.innerHTML = '<p class="trip-cache-title">OFFLINE CHARTS — SELECTED MAP AREA</p><button type="button" class="action-btn">Cache trip charts</button><p class="trip-cache-note">First choose Burlington with the map search button. Then download the visible chart area for offline use for about 30 days.</p>';
    panel.querySelector("button").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const stopping = button.textContent.startsWith("Stop");
      if (!runSafeAction(stopping ? "Stop caching" : "Cache trip charts")) return;
      button.textContent = stopping ? "Cache trip charts" : "Stop caching";
      panel.querySelector(".trip-cache-note").textContent = stopping ? "Caching stopped." : "Downloading charts now. Keep the app open and the screen on for a few minutes.";
    });
    tabPanel.appendChild(panel);
  }
  new MutationObserver(ensurePlanPanel).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", ensurePlanPanel);
})();
