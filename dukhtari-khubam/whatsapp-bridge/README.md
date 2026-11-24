# LifeHub WhatsApp bridge

Sends LifeHub's SOS messages (her place to her parents) from **the owner's own WhatsApp number**, linked
like WhatsApp Web with a pairing code. It runs on its own small server (a VPS), always on; the app's server
calls it with a shared secret.

> Unofficial: it speaks WhatsApp Web's protocol (Baileys). Use a separate number, not a personal one — a
> number that sends too much can be banned. The bridge sends little and slowly (12 a minute, 12 an hour
> per person, 400 a day) and only SOS messages.

## Run it (any VPS with Docker, 1 GB RAM is enough)

1. Point a domain at the server (an A record, e.g. `wa.your-domain.tj`) and put it in `Caddyfile`.
2. Make a long secret: `openssl rand -hex 32`.
3. `BRIDGE_SECRET=<the secret> docker compose up -d` — Caddy gets the HTTPS certificate itself.
4. In Vercel → Settings → Environment Variables add `WHATSAPP_BRIDGE_URL=https://wa.your-domain.tj` and
   `WHATSAPP_BRIDGE_SECRET=<the same secret>`, then redeploy.
5. In the LifeHub panel → **SOS ва дӯстон**: enter the number, press «Гирифтани рамз», and on that phone open
   WhatsApp → Linked devices → Link a device → *Link with phone number instead* and type the code.

The link is kept in the `wa-auth` volume: restarts do not unlink the number.

## Endpoints (all but `/health` need `Authorization: Bearer <secret>`)

| | |
|---|---|
| `GET /health` | `{ ok: true }` |
| `GET /status` | `{ state: off \| connecting \| pairing \| open, number }` |
| `POST /pair {phone}` | `{ code }` — the 8-character pairing code |
| `POST /send {to, text, lat?, lng?}` | sends the text (and a location pin) |
| `POST /logout` | unlinks the number |

Tests: `npm test`.
