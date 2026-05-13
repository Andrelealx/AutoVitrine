#!/bin/sh
echo "=== ENTRYPOINT INICIANDO ==="
echo "PORT=$PORT"

# Substitui placeholder pela porta real
sed -i "s/RAILWAY_PORT/$PORT/g" /etc/nginx/conf.d/backend.conf

echo "=== TESTANDO CONFIG NGINX ==="
nginx -t

echo "=== INICIANDO NODE ==="
node /app/dist/server.js &
NODE_PID=$!
echo "Node PID: $NODE_PID"

echo "=== AGUARDANDO NODE ==="
sleep 3

echo "=== INICIANDO NGINX ==="
nginx -g "daemon off;" &
NGINX_PID=$!
echo "Nginx PID: $NGINX_PID"

echo "=== TUDO INICIADO, AGUARDANDO ==="
wait $NODE_PID
