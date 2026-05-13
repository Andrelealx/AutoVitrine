#!/bin/sh

echo "PORT=$PORT"
echo "Iniciando Node na porta 4000..."
node /app/dist/server.js &

echo "Iniciando Nginx na porta $PORT..."
sed -i "s/RAILWAY_PORT/$PORT/g" /etc/nginx/conf.d/backend.conf
nginx -g "daemon off;"
