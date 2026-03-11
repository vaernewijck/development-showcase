#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Development Showcase - Setup"
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

# Open setup in Chrome
sleep 1
open -a "Google Chrome" "http://localhost:3000/setup.html"

# Start server
node server.js
