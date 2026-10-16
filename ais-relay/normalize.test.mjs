import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, bounds } from './normalize.mjs';
test('valid reports preserve position, speed and course', () => {
  const value = normalize({ MessageType: 'PositionReport', MetaData: { MMSI: 368207620, ShipName: ' TEST ' }, Message: { PositionReport: { Latitude: 42, Longitude: -71, Sog: 12, Cog: 90 } } }, 1000000);
  assert.deepEqual(value, { mmsi: '368207620', lat: 42, lon: -71, name: 'TEST', speed: 12, course: 90, updatedAt: 1000000 });
});
test('AIS sentinel positions and invalid reports never become boats', () => {
  for (const position of [{ Latitude: 91, Longitude: 181 }, { Latitude: 42, Longitude: -71, Valid: false }]) assert.equal(normalize({ MessageType: 'PositionReport', MetaData: { MMSI: 368207620 }, Message: { PositionReport: position } }), null);
});
test('unavailable speed and heading are null', () => {
  const v = normalize({ MessageType: 'StandardClassBPositionReport', MetaData: { MMSI: 368207620 }, Message: { StandardClassBPositionReport: { Latitude: 42, Longitude: -71, Sog: 102.3, Cog: 360 } } });
  assert.equal(v.speed, null); assert.equal(v.course, null);
});
test('old provider timestamps are rejected', () => {
  assert.equal(normalize({ MessageType: 'PositionReport', MetaData: { MMSI: 368207620, time_utc: '2020-01-01T00:00:00Z' }, Message: { PositionReport: { Latitude: 42, Longitude: -71 } } }), null);
});
test('bounds reject malformed or excessive subscriptions', () => {
  assert.deepEqual(bounds('41,-72,43,-70'), [41, -72, 43, -70]);
  for (const v of ['', 'a,b,c,d', '-90,-180,90,180', '43,-72,41,-70', '41,170,43,-170']) assert.equal(bounds(v), null);
});
