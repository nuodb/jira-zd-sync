#!/bin/sh
mkdir -p /app/logs
chmod 777 /app/logs
exec "$@"
