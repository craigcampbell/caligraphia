#!/bin/sh
# Installs a cron entry that refreshes the admin panel's Docker disk stats every
# 30 minutes. Idempotent. To remove it later: `crontab -e` and delete the line
# tagged "caligraphia-docker-stats".
set -eu

SCRIPT="$(cd "$(dirname "$0")" && pwd)/refresh-docker-stats.sh"
LINE="*/30 * * * * $SCRIPT >/dev/null 2>&1 # caligraphia-docker-stats"

current="$(crontab -l 2>/dev/null || true)"
if printf '%s\n' "$current" | grep -qF "caligraphia-docker-stats"; then
  echo "Cron entry already installed — nothing to do."
  exit 0
fi

printf '%s\n%s\n' "$current" "$LINE" | grep -v '^$' | crontab -
echo "Installed. The admin panel's Docker stats will refresh every 30 minutes."
echo "Remove later with: crontab -e   (delete the caligraphia-docker-stats line)"
