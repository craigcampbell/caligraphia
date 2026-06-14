# DigitalOcean Launch Checklist

Last updated: 2026-06-13

This is the simplest small-launch path for Caligraphia: one DigitalOcean Droplet running the app, Postgres, and MinIO in Docker Compose, with Caddy providing HTTPS. It is the cheapest path that still feels like a real launch.

Related files:

- [docker-compose.prod.yml](/Users/craigcampbell/Projects/caligraphia/docker-compose.prod.yml)
- [Caddyfile](/Users/craigcampbell/Projects/caligraphia/Caddyfile)
- [.env.example](/Users/craigcampbell/Projects/caligraphia/.env.example)

## What To Use

- 1 DigitalOcean Droplet
- Ubuntu 24.04 LTS
- 2 vCPU / 4 GB RAM as the default launch size
- Docker + Docker Compose plugin
- Caddy container for TLS termination
- Postgres container
- MinIO container for object storage
- Resend for magic-link email

## Day 0 Setup

1. Create the Droplet.
   - Pick the region closest to your first users.
   - Add your SSH key.
   - Leave the droplet publicly reachable on ports 80 and 443 only.

2. Point your domain at the Droplet.
   - Create an `A` record for your launch domain, for example `caligraphia.example.com`.
   - Use the exact same hostname in `SITE_DOMAIN` and `BASE_URL`.
   - No CDN or proxy is required for the first launch.

3. Lock the firewall down.
   - Allow `22/tcp` for SSH.
   - Allow `80/tcp` and `443/tcp` for Caddy.
   - Do not expose Postgres or MinIO to the internet.

4. Install the runtime.
   - Docker
   - Docker Compose plugin
   - `git`

5. Clone the repo onto the server.
   - A simple path like `/opt/caligraphia` is fine.

## Environment Variables

Create a server `.env` from [.env.example](/Users/craigcampbell/Projects/caligraphia/.env.example) and replace every placeholder.

Required values:

```env
DATABASE_URL=postgresql://croquis:change-me@db:5432/croquis
POSTGRES_USER=croquis
POSTGRES_PASSWORD=change-me
POSTGRES_DB=croquis

JWT_SECRET=change-me-to-a-long-random-secret
MAGIC_LINK_SECRET=change-me-to-a-long-random-secret

BASE_URL=https://caligraphia.example.com
SITE_DOMAIN=caligraphia.example.com
CADDY_EMAIL=admin@example.com
EMAIL_FROM=Caligraphia <login@caligraphia.example.com>
RESEND_API_KEY=your-resend-key

MINIO_ROOT_USER=change-me
MINIO_ROOT_PASSWORD=change-me
MINIO_ACCESS_KEY=change-me
MINIO_SECRET_KEY=change-me
MINIO_BUCKET=croquis
```

Notes:

- `BASE_URL` must be the public HTTPS URL your friends will use.
- `SITE_DOMAIN` is the hostname Caddy serves.
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` can match the root MinIO creds for launch simplicity.
- Keep `RESEND_API_KEY` empty only for local dev. Production needs real email.

## First Deploy

1. Pull the code onto the Droplet.
2. Put the production `.env` file in the repo root.
3. Start the stack:

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

4. Watch the logs until the app finishes the initial Prisma work and starts cleanly:

```sh
docker compose -f docker-compose.prod.yml logs -f app
```

5. Confirm the containers are healthy:

```sh
docker compose -f docker-compose.prod.yml ps
```

6. Visit `https://caligraphia.example.com`.

7. Request a magic link to your own email and make sure the email arrives.

8. Create one test post from web and one from each mobile app, then confirm the image shows up in feed and detail.

## Backups

The first launch keeps the operational footprint small, so backups need to be deliberate.

- Turn on DigitalOcean Droplet backups.
- Export Postgres nightly with `pg_dump`.
- Copy the dump off-box to a second location, ideally DigitalOcean Spaces or another storage target.
- Keep the `.env` file and other secrets in your password manager, not on the Droplet only.

## What To Watch

- If the app feels slow when someone submits a letter, the server is spending too long rendering and compressing the letter image.
- If the first login fails, check `RESEND_API_KEY`, `EMAIL_FROM`, and `BASE_URL`.
- If artwork fails to load, check the MinIO credentials and whether the storage container started before the app.
- If you see TLS errors, confirm `SITE_DOMAIN` matches the public DNS record exactly.

## When To Split Things Out

Keep the first launch simple. Only split the stack when the app earns the complexity.

- Move Postgres to DigitalOcean Managed Databases when you want less operational work.
- Move media to DigitalOcean Spaces when you are ready to patch the storage client for Spaces and want the off-box storage model.
- Add a worker queue only when render/OCR latency starts hurting the request path.

## First Checks After Launch

- `git status` is clean locally and on the server.
- `docker compose -f docker-compose.prod.yml ps` shows healthy containers.
- `https://caligraphia.example.com/login` loads over HTTPS.
- A magic-link email sends successfully.
- Feed, inbox, and detail all show the same server-rendered artwork.
