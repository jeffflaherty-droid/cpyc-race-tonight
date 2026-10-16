export function normalize(data, now = Date.now()) {
  const meta = data.MetaData;
  const p = data.Message?.[data.MessageType];
  if (!meta || !p || !['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'].includes(data.MessageType) || p.Valid === false) return null;
  const mmsi = String(meta.MMSI);
  const lat = p.Latitude ?? meta.latitude ?? meta.Latitude;
  const lon = p.Longitude ?? meta.longitude ?? meta.Longitude;
  const reported = Date.parse(meta.time_utc);
  // Never refresh an old report merely because it arrived now.
  const updatedAt = Number.isFinite(reported) ? reported : now;
  if (!/^\d{9}$/.test(mmsi) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || updatedAt > now + 60000 || now - updatedAt > 600000) return null;
  return { mmsi, lat, lon, name: String(meta.ShipName || '').trim().slice(0, 80), speed: Number.isFinite(p.Sog) && p.Sog >= 0 && p.Sog < 102.3 ? p.Sog : null, course: Number.isFinite(p.Cog) && p.Cog >= 0 && p.Cog < 360 ? p.Cog : null, updatedAt };
}
export function bounds(value) {
  const b = String(value || '').split(',').map(Number);
  if (b.length !== 4 || b.some(x => !Number.isFinite(x)) || b[0] < -90 || b[2] > 90 || b[1] < -180 || b[3] > 180 || b[0] >= b[2] || b[1] >= b[3] || b[2] - b[0] > 10 || b[3] - b[1] > 10) return null;
  return b;
}
