/* AIS map overlay. Credentials belong on the relay, never in this public site. */
(function () {
  'use strict';
  window.CPYC_AIS = {
    mount(map, L) {
      const group = L.layerGroup();
      const markers = new Map();
      let enabled = false, source = null, timer = null, refresh = null, lastUpdate = 0;
      const control = L.control({ position: 'bottomleft' });
      const container = document.createElement('div');
      container.className = 'ais-control';
      const label = document.createElement('label');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      label.append(toggle, document.createTextNode(' Vessels / AIS'));
      const status = document.createElement('div');
      status.className = 'ais-status';
      status.setAttribute('role', 'status');
      status.textContent = 'Off';
      const link = document.createElement('a');
      link.textContent = 'Open MarineTraffic ↗';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(label, status, link);
      control.onAdd = () => container;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      control.addTo(map);
      function updateLink() {
        const c = map.getCenter();
        link.href = `https://www.marinetraffic.com/en/ais/home/centerx:${c.lng.toFixed(4)}/centery:${c.lat.toFixed(4)}/zoom:${Math.min(16, map.getZoom())}`;
      }
      function disconnect() {
        if (source) source.close();
        source = null;
      }
      function popup(v, age) {
        const box = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = v.name || `MMSI ${v.mmsi}`;
        const details = document.createElement('div');
        details.textContent = `${v.speed == null ? '—' : v.speed.toFixed(1)} kt · Course ${v.course == null ? '—' : Math.round(v.course) + '°'} · Updated ${Math.floor(age / 1000)}s ago`;
        box.append(title, details);
        return box;
      }
      function render(vessels) {
        const now = Date.now(), seen = new Set();
        for (const v of vessels) {
          if (!/^\d{9}$/.test(String(v.mmsi)) || !Number.isFinite(v.lat) || !Number.isFinite(v.lon) || Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180 || !Number.isFinite(v.updatedAt)) continue;
          const age = now - v.updatedAt;
          if (age < -60000 || age > 600000) continue;
          seen.add(v.mmsi);
          const heading = Number.isFinite(v.course) && v.course >= 0 && v.course < 360 ? v.course : 0;
          const icon = L.divIcon({ className: 'ais-vessel', html: `<span style="transform:rotate(${heading}deg)">▲</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
          let marker = markers.get(v.mmsi);
          if (!marker) {
            marker = L.marker([v.lat, v.lon], { icon }).addTo(group);
            markers.set(v.mmsi, marker);
          }
          marker.setLatLng([v.lat, v.lon]).setIcon(icon).setOpacity(age > 120000 ? 0.4 : 1);
          marker.bindPopup(popup(v, age));
        }
        for (const [id, marker] of markers) if (!seen.has(id)) { group.removeLayer(marker); markers.delete(id); }
        status.textContent = `Connected · ${markers.size} vessels · faded = over 2 min old`;
      }
      function connect() {
        disconnect();
        if (!enabled) return;
        const endpoint = window.CPYC_AIS_ENDPOINT;
        if (!endpoint) { status.textContent = 'Setup required · live feed not connected'; return; }
        let url;
        try { url = new URL(endpoint); if (url.protocol !== 'https:') throw new Error('HTTPS required'); }
        catch { status.textContent = 'Live feed configuration unavailable'; return; }
        const b = map.getBounds();
        url.searchParams.set('bbox', [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].join(','));
        lastUpdate = Date.now();
        status.textContent = 'Connecting…';
        source = new EventSource(url.href);
        source.addEventListener('vessels', event => {
          try { const data = JSON.parse(event.data); if (Array.isArray(data.vessels)) { lastUpdate = Date.now(); render(data.vessels); } }
          catch { status.textContent = 'Invalid traffic update'; }
        });
        source.addEventListener('status', event => {
          try { const data = JSON.parse(event.data); if (typeof data.message === 'string') status.textContent = data.message; } catch {}
        });
        source.onerror = () => { group.clearLayers(); markers.clear(); status.textContent = 'Disconnected · retrying'; };
      }
      function moved() { updateLink(); clearTimeout(refresh); if (enabled) refresh = setTimeout(connect, 1200); }
      toggle.addEventListener('change', () => {
        enabled = toggle.checked;
        clearInterval(timer);
        if (enabled) { group.addTo(map); connect(); timer = setInterval(() => { if (!navigator.onLine) { disconnect(); group.clearLayers(); markers.clear(); status.textContent = 'Offline · live traffic unavailable'; } else if (source && Date.now() - lastUpdate > 20000) { group.clearLayers(); markers.clear(); status.textContent = 'No recent traffic updates'; } }, 5000); }
        else { disconnect(); map.removeLayer(group); group.clearLayers(); markers.clear(); status.textContent = 'Off'; }
      });
      const online = () => { if (enabled) connect(); };
      window.addEventListener('online', online);
      map.on('moveend', moved);
      updateLink();
      return () => { disconnect(); clearInterval(timer); clearTimeout(refresh); window.removeEventListener('online', online); map.off('moveend', moved); control.remove(); group.remove(); };
    }
  };
})();
