#!/bin/sh
echo "=== ENTRYPOINT INICIANDO ==="
echo "PORT=$PORT"
echo "NODE_ENV=$NODE_ENV"

exec node /app/dist/server.js
