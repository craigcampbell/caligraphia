#!/bin/sh
# Writes Docker disk usage (images, build cache, containers, volumes) to a file
# the admin panel reads. This runs on the HOST (via cron): the app container has
# no access to the Docker daemon by design — mounting the socket would undermine
# the admin panel's hardening — so the host reports the figures and the app just
# displays them.
#
# Install the cron entry with:  npm run stats:install-cron   (see package.json)

set -eu

DOCKER="${DOCKER_BIN:-/usr/local/bin/docker}"
[ -x "$DOCKER" ] || DOCKER="$(command -v docker || true)"
[ -n "$DOCKER" ] || { echo "docker not found" >&2; exit 1; }

DIR="$(cd "$(dirname "$0")/.." && pwd)/.runtime"
mkdir -p "$DIR"
OUT="$DIR/docker-stats.json"

df_lines="$("$DOCKER" system df --format '{{json .}}' 2>/dev/null | paste -sd, -)"
[ -n "$df_lines" ] || { echo "docker system df produced no output" >&2; exit 1; }

printf '{"capturedAt":"%s","df":[%s]}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$df_lines" > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
