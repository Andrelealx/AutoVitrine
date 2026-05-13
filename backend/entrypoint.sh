#!/bin/sh
echo "=== ENTRYPOINT INICIANDO ==="
echo "PORT=$PORT"
echo "NODE_ENV=$NODE_ENV"
echo "DATABASE_URL definida: $([ -n "$DATABASE_URL" ] && echo SIM || echo NAO)"

exec node /app/dist/server.js
