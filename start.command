#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Development Showcase"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js niet gevonden!"
    echo "Installeer via: https://nodejs.org"
    echo ""
    read -p "Druk Enter om af te sluiten..."
    exit 1
fi

echo "Node.js versie: $(node -v)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Dependencies installeren..."
    npm install
    echo ""
fi

echo "Server starten..."
echo "Druk Ctrl+C om te stoppen"
echo ""

# Start server in background, wait for it to be ready, then open browser
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open setup in default browser
open "http://localhost:3000/setup.html"

# Wait for server process
wait $SERVER_PID
