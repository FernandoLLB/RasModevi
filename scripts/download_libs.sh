#!/bin/bash
# Descarga las librerías JS del mirror local de ModevI.
# Ejecutar una vez al instalar el proyecto o al actualizar versiones.

set -e
LIBS_DIR="$(dirname "$0")/../backend/libs"
mkdir -p "$LIBS_DIR"
cd "$LIBS_DIR"

echo "Descargando librerías JS..."

curl -sLo chart.js  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"  && echo "  ✓ chart.js"
curl -sLo three.js  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"       && echo "  ✓ three.js"
curl -sLo alpine.js "https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js"        && echo "  ✓ alpine.js"
curl -sLo anime.js  "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"         && echo "  ✓ anime.js"
curl -sLo matter.js "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js"   && echo "  ✓ matter.js"
curl -sLo tone.js   "https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js"             && echo "  ✓ tone.js"
curl -sLo marked.js "https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"             && echo "  ✓ marked.js"

echo "Listo. $(ls | wc -l) librerías disponibles en $LIBS_DIR"
