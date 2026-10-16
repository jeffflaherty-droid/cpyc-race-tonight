# AIS relay setup

This Node server is separate from GitHub Pages, which cannot run a persistent AIS connection.

1. Create an AISStream account at https://aisstream.io/account and generate a key.
2. Deploy this folder to an HTTPS Node host with WebSocket outbound access and unbuffered streaming responses. Run `npm install` then `npm start`.
3. Set `AISSTREAM_API_KEY` as a private host environment secret. Set `ALLOWED_ORIGIN=https://jeffflaherty-droid.github.io`. Never commit the key.
4. Set `window.CPYC_AIS_ENDPOINT` in the site's `ais-config.js` to `https://YOUR-RELAY/events`, then bump the shell cache version in `sw.js`.
5. Test actual reports in the sailing area before treating coverage as available. Toggle Vessels / AIS in SAFE. Pan to change the subscription area.

The relay limits subscriptions to a 10 by 10 degree area and two active clients. For public use, add authenticated access and per-user rate limits at the host; Origin checks alone are not authentication. Each browser holds one provider connection. Deploy a single relay instance under this design, because provider account limits apply across instances.

Positions older than two minutes fade; reports older than ten minutes disappear. Connection losses clear vessels. This internet feed is for situational awareness, not collision avoidance. Missing targets do not mean clear water.
