#!/bin/sh
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R node:node /app/data
  exec su-exec node "$@"
fi
exec "$@"
