#!/bin/bash
# Audio-Draft2 Startup Script

set -e

echo "============================================"
echo "  Audio-Draft2 — Starting Up"
echo "============================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check for .env file
if [ ! -f "database/.env" ]; then
    echo "WARNING: database/.env not found. Copying from .env.example..."
    cp database/.env.example database/.env
    echo "Please edit database/.env with your credentials."
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Start the server
echo ""
echo "Starting Audio-Draft2 server..."
echo "Open http://localhost:3000 in your browser"
echo "============================================"
node server.js
