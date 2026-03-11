#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  Project Display - Installer & Starter
#  Dubbelklik om te starten op Mac Mini
# ═══════════════════════════════════════════════════════════════

cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Project Display - Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js niet gevonden. Installeren..."
    echo ""

    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "Homebrew installeren (dit duurt even)..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add brew to path for Apple Silicon Macs
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi

    echo "Node.js installeren..."
    brew install node
    echo ""
fi

echo "Node.js versie: $(node -v)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Dependencies installeren..."
    npm install
    echo ""
fi

# Get local IP address
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Server starten..."
echo ""
echo "  DISPLAY (Mac Mini):  http://localhost:3000"
echo "  iPAD CONTROLLER:     http://$IP:3000/ipad.html"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Druk Ctrl+C om te stoppen"
echo ""

# Open display in default browser
sleep 1
open "http://localhost:3000"

# Start server
node server.js
