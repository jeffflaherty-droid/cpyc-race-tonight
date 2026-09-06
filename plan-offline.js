(function () {
  const PANEL_ID = "plan-offline-charts";
  const TILE_CACHE = "planner-map-tiles";
  const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_CONCURRENCY = 6;
  let abortController = null;

  function buttonByText(text) {
    return Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === text,
    );
  }

  function visibleTileUrls() {
    return Array.from(document.querySelectorAll("img.leaflet-tile"))
      .filter((img) => img.complete && img.naturalWidth > 0)
      .map((img) => img.currentSrc || img.src)
      .filter(Boolean);
  }

  function expandTileUrl(source, output) {
    let url;
    try {
      url = new URL(source);
    } catch {
      return;
    }

    const slippy = url.pathname.match(/\/([0-9]+)\/([0-9]+)\/([0-9]+)(?:\.png)?$/);
    if (slippy && (url.hostname === "tile.openstreetmap.org" || url.hostname === "tiles.openseamap.org")) {
      const z = Number(slippy[1]);
      const x = Number(slippy[2]);
      const y = Number(slippy[3]);
      const prefix = url.pathname.slice(0, slippy.index);
      const suffix = url.pathname.endsWith(".png") ? ".png" : "";
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -2; dy <= 2; dy += 1) {
          const next = new URL(url);
          next.pathname = `${prefix}/${z}/${x + dx}/${y + dy}${suffix}`;
          output.add(next.href);
        }
      }
      return;
    }

    if (url.hostname === "gis.charttools.noaa.gov") {
      const bboxKey = Array.from(url.searchParams.keys()).find((key) => key.toUpperCase() === "BBOX");
      if (!bboxKey) {
        output.add(url.href);
        return;
      }
      const bbox = url.searchParams.get(bboxKey).split(",").map(Number);
      if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return;
      const [minX, minY, maxX, maxY] = bbox;
      const width = maxX - minX;
      const height = maxY - minY;
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -2; dy <= 2; dy += 1) {
          const next = new URL(url);
          next.searchParams.set(
            bboxKey,
            [minX + dx * width, minY + dy * height, maxX + dx * width, maxY + dy * height].join(","),
          );
          output.add(next.href);
        }
      }
    }
  }

  function urlsForVisibleArea() {
    const urls = new Set();
    visibleTileUrls().forEach((source) => expandTileUrl(source, urls));
    return Array.from(urls);
  }

  async function fetchAndCache(url, cache, signal) {
    const request = new Request(url, { mode: "no-cors", credentials: "omit" });
    const existing = await cache.match(request);
    if (existing) return "cached";
    const response = await fetch(request, { signal });
    await cache.put(request, response.clone());
    return "downloaded";
  }

  async function downloadTiles(urls, onProgress, signal) {
    const cache = await caches.open(TILE_CACHE);
    let nextIndex = 0;
    let completed = 0;
    let failed = 0;

    async function worker() {
      while (nextIndex < urls.length && !signal.aborted) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          await fetchAndCache(urls[index], cache, signal);
        } catch (error) {
          if (error && error.name === "AbortError") return;
          failed += 1;
        }
        completed += 1;
        onProgress(completed, urls.length, failed);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENCY, urls.length) }, () => worker()),
    );
    return { completed, failed };
  }

  function setStatus(panel, text) {
    const note = panel.querySelector(".trip-cache-note");
    if (note) note.textContent = text;
  }

  function ensurePlanPanel() {
    const planTab = buttonByText("PLAN");
    if (!planTab || !planTab.classList.contains("active")) return;
    const tabPanel = document.querySelector(".tab-panel");
    if (!tabPanel || document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "trip-cache";
    const saved = JSON.parse(localStorage.getItem("offlineChartDownload") || "null");
    const stillValid = saved && Date.now() - saved.completedAt < EXPIRY_MS;
    const savedText = stillValid
      ? `Charts saved for offline use until ${new Date(saved.completedAt + EXPIRY_MS).toLocaleDateString()}.`
      : "Choose a location with the map search button, wait for its chart to appear, then download that visible area.";

    panel.innerHTML =
      '<p class="trip-cache-title">OFFLINE CHARTS — SELECTED MAP AREA</p>' +
      '<button type="button" class="action-btn">Cache trip charts</button>' +
      `<p class="trip-cache-note">${savedText}</p>`;

    panel.querySelector("button").addEventListener("click", async (event) => {
      const button = event.currentTarget;

      if (abortController) {
        abortController.abort();
        abortController = null;
        button.textContent = "Cache trip charts";
        setStatus(panel, "Download stopped. Previously saved chart tiles are still available.");
        return;
      }

      const urls = urlsForVisibleArea();
      if (!urls.length) {
        setStatus(panel, "No chart tiles are visible yet. Choose Burlington, wait for the chart to load, then try again.");
        return;
      }

      abortController = new AbortController();
      button.textContent = "Stop caching";
      setStatus(panel, `Preparing ${urls.length} chart tiles…`);

      const result = await downloadTiles(
        urls,
        (done, total, failed) => {
          button.textContent = `Stop caching (${done}/${total})`;
          setStatus(
            panel,
            failed
              ? `Downloading charts: ${done}/${total} checked, ${failed} unavailable…`
              : `Downloading charts: ${done}/${total}… Keep this screen open.`,
          );
        },
        abortController.signal,
      );

      const wasStopped = abortController.signal.aborted;
      abortController = null;
      button.textContent = "Cache trip charts";
      if (wasStopped) return;

      if (result.completed === 0 || result.failed === result.completed) {
        setStatus(panel, "The chart server did not return any tiles. Check your connection and try again.");
        return;
      }

      const completedAt = Date.now();
      localStorage.setItem(
        "offlineChartDownload",
        JSON.stringify({ completedAt, total: result.completed, failed: result.failed }),
      );
      setStatus(
        panel,
        result.failed
          ? `Saved ${result.completed - result.failed} chart tiles. ${result.failed} unavailable tiles can be retried. Available offline for about 30 days.`
          : `Download complete — ${result.completed} chart tiles saved for offline use for about 30 days.`,
      );
    });

    tabPanel.appendChild(panel);
  }

  new MutationObserver(ensurePlanPanel).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("load", ensurePlanPanel);
})();
