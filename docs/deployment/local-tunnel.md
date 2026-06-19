# Host Caligraphia from your Mac via Cloudflare Tunnel

Last updated: 2026-06-18

This serves **https://caligraphia.com** straight from this machine — no server, no
public IP, no open firewall ports. Cloudflare Tunnel makes an outbound connection
and proxies traffic to the app running locally in Docker. Perfect for sharing with
a handful of friends.

Trade-off: the site is only up while this Mac is awake and the stack is running.
That's fine for a small share.

```
friends ──▶ Cloudflare (TLS, caligraphia.com) ──▶ tunnel ──▶ app:3000 (this Mac)
                                                              ├─ Postgres
                                                              └─ MinIO (images)
```

Files involved:
- [docker-compose.tunnel.yml](/Users/craigcampbell/Projects/caligraphia/docker-compose.tunnel.yml) — the whole stack + tunnel
- [.env](/Users/craigcampbell/Projects/caligraphia/.env) — secrets (already generated; fill the two blanks)

Two values in `.env` are still blank and need you: `RESEND_API_KEY` and `TUNNEL_TOKEN`.

---

## Step 1 — Move caligraphia.com onto Cloudflare (one time)

The tunnel can only answer for `caligraphia.com` if Cloudflare manages its DNS.

1. Create a free account at https://dash.cloudflare.com/sign-up
2. **Add a site** → enter `caligraphia.com` → choose the **Free** plan.
3. Cloudflare scans existing records and shows you **two nameservers**, e.g.
   `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`.
4. In **Namecheap** → Domain List → caligraphia.com → **Manage** →
   **Nameservers** → switch from "Namecheap BasicDNS" to **Custom DNS** and paste
   Cloudflare's two nameservers. Save.
   - Your current Namecheap parking CNAME and the `@ → www` URL-redirect stop
     applying once nameservers move; that's expected and fine.
   - Keep the SPF `TXT` record — re-add it in Cloudflare if the scan didn't carry
     it over (it doesn't hurt, and helps email).
5. Wait for Cloudflare to show the domain as **Active** (usually minutes, up to a
   few hours). You'll get an email.

---

## Step 2 — Create the tunnel and get its token

Once the domain is **Active** in Cloudflare:

1. In the Cloudflare dashboard go to **Zero Trust** → **Networks** → **Tunnels**
   → **Create a tunnel** → **Cloudflared**.
2. Name it `caligraphia`. Cloudflare shows an install command containing a long
   token (`--token eyJ...`). **Copy just the token.**
3. Paste it into `.env`:
   ```
   TUNNEL_TOKEN=eyJ...your token...
   ```
4. Still in the tunnel setup, add **Public Hostnames**:
   | Subdomain | Domain          | Service              |
   |-----------|-----------------|----------------------|
   | (blank)   | caligraphia.com | `http://app:3000`    |
   | `www`     | caligraphia.com | `http://app:3000`    |

   The service is `http://app:3000` because cloudflared runs in the same Docker
   network as the app container. Save.

> CLI alternative (instead of the dashboard): `cloudflared tunnel login`, then
> `cloudflared tunnel create caligraphia`, then
> `cloudflared tunnel route dns caligraphia caligraphia.com`. The dashboard token
> path above is simpler and is what this compose file expects.

---

## Step 3 — Set up email (Resend) so friends can log in

Login is by magic link, so the app needs to send mail.

1. Sign up free at https://resend.com
2. **Domains** → **Add Domain** → `caligraphia.com`. Resend gives you a handful of
   DNS records (DKIM `CNAME`s, an SPF/MX `TXT`).
3. Add those records in **Cloudflare** → caligraphia.com → **DNS**. Wait for Resend
   to show the domain **Verified**.
4. **API Keys** → create one → paste into `.env`:
   ```
   RESEND_API_KEY=re_...
   ```
   `EMAIL_FROM` is already set to `login@caligraphia.com` — keep it on the verified
   domain.

---

## Step 4 — Launch

Make sure Docker Desktop is running, then from the repo root:

```sh
docker compose -f docker-compose.tunnel.yml up -d --build
```

First build takes a few minutes (installs deps, runs Prisma, builds Next). Watch it:

```sh
docker compose -f docker-compose.tunnel.yml logs -f app
docker compose -f docker-compose.tunnel.yml logs -f cloudflared   # "Registered tunnel connection"
```

Check health:

```sh
docker compose -f docker-compose.tunnel.yml ps
```

Then visit **https://caligraphia.com**. Request a magic link to your own email,
confirm it arrives, log in, and post one test letter.

Optional: seed some demo content first —
`docker compose -f docker-compose.tunnel.yml exec app npm run db:seed-demo`.

---

## Day-to-day

- **Stop:** `docker compose -f docker-compose.tunnel.yml down` (data is kept in the
  `pgdata` / `miniodata` volumes).
- **Restart after a reboot:** `docker compose -f docker-compose.tunnel.yml up -d`.
- **Update after code changes:** `docker compose -f docker-compose.tunnel.yml up -d --build`.
- **Keep it online:** the site is up only while this Mac is awake and the stack is
  running. In System Settings → Battery/Lock Screen, prevent sleep while plugged in.

## If something's off

- **Site won't load:** check `cloudflared` logs for a registered connection, and
  that the public hostname points at `http://app:3000`.
- **Login fails:** verify `RESEND_API_KEY`, the Resend domain is **Verified**, and
  `BASE_URL=https://caligraphia.com`.
- **Images don't show:** check the `storage` container is healthy and the app
  started after it.
- **Local sanity check (bypasses tunnel):** http://localhost:3000 on this Mac.
