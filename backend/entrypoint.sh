#!/bin/sh
echo "=== ENTRYPOINT INICIANDO ==="
echo "PORT externo (Railway) = $PORT"
echo "Nginx vai escutar: $PORT"
echo "Node vai escutar: 4000 (fixo interno)"

# Substitui placeholder pela porta real do Railway
sed -i "s/RAILWAY_PORT/$PORT/g" /etc/nginx/conf.d/backend.conf

echo "=== TESTANDO CONFIG NGINX ==="
nginx -t

echo "=== INICIANDO NODE (porta interna 4000) ==="
PORT=4000 node /app/dist/server.js &
NODE_PID=$!
echo "Node PID: $NODE_PID"

echo "=== AGUARDANDO NODE ==="
sleep 3

echo "=== INICIANDO NGINX (porta externa $PORT) ==="
nginx -g "daemon off;" &
NGINX_PID=$!
echo "Nginx PID: $NGINX_PID"

echo "=== TUDO INICIADO, AGUARDANDO ==="
wait $NODE_PID
