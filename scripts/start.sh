#!/bin/bash
# ModevI - Start Script
# Starts the backend server which serves both API and frontend

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "╔══════════════════════════════════════╗"
echo "║          ModevI Platform             ║"
echo "║   Tu dispositivo, infinitas          ║"
echo "║        posibilidades                 ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Start backend (serves both API and frontend)
echo "[ModevI] Starting server on http://0.0.0.0:8000 ..."
cd "$BACKEND_DIR"
python3 main.py
