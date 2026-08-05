#!/usr/bin/env bash
# Gera o pacote estático do site para subir na Hostinger.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
npx vite build
cp dist/client/_shell.html dist/client/index.html
cp deploy/htaccess dist/client/.htaccess
rm -f ../fest-vale-site.zip
(cd dist/client && zip -qr ../../../fest-vale-site.zip .)
echo "Pacote pronto: fest-vale-site.zip — extrair dentro de public_html"
