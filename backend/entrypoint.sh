#!/bin/sh
set -e

echo "PORT=$PORT"
echo "Nginx vai escutar na porta: $PORT"
echo "Node rodando na porta: 4000"

sed -i "s/\${PORT}/$PORT/g" /etc/nginx/conf.d/default.conf

echo "=== nginx.conf após substituição ==="
cat /etc/nginx/conf.d/default.conf
echo "===================================="

nginx -t

node /app/dist/server.js &

nginx -g "daemon off;"
