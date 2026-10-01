#!/bin/sh
set -eu
password=$(cat /run/secrets/redis_password)
# A restricted alphabet avoids config injection. Generate a random base64url/hex password, >=32 characters.
case "$password" in *[!A-Za-z0-9_-]*|'') exit 1 ;; esac
[ "${#password}" -ge 32 ] || exit 1
mkdir -p /run/marketpilot
umask 077
printf 'bind 0.0.0.0\nprotected-mode yes\nappendonly yes\nappendfsync everysec\nmaxmemory-policy noeviction\nrequirepass "%s"\n' "$password" > /run/marketpilot/redis.conf
chown -R redis:redis /run/marketpilot
exec /usr/local/bin/docker-entrypoint.sh redis-server /run/marketpilot/redis.conf
