#!/bin/bash
# Audio-Draft Startup Script

set -e

echo "============================================"
echo "  Audio-Draft — Starting Up"
echo "============================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check for .env file
if [ ! -f "database/.env" ]; then
    echo "============================================"
    echo "  INITIAL SETUP REQUIRED"
    echo "============================================"
    echo "Audio-Draft requires Supabase and Spotify to function."
    echo "Please follow the README instructions to create these accounts."
    echo ""
    read -p "Enter Supabase Project URL: " SUPA_URL
    read -p "Enter Supabase Anon Key: " SUPA_ANON
    read -p "Enter Supabase Direct Connection String: " SUPA_DB
    echo ""
    read -p "Enter Spotify Client ID: " SPOT_ID
    read -p "Enter Spotify Client Secret: " SPOT_SEC
    
    cat <<EOF > database/.env
API_URL="${SUPA_URL}"
ANON_PUBLIC_KEY="${SUPA_ANON}"
SUPABASE_DIRECT_CONNECT="${SUPA_DB}"
SPOTIFY_CLIENT_ID="${SPOT_ID}"
SPOTIFY_CLIENT_SECRET="${SPOT_SEC}"
EOF
    
    echo ""
    echo "Credentials saved to database/.env!"
    echo "Reminder: Make sure you run database/initialize_db.sql in your Supabase SQL Editor!"
    echo ""
else
    echo "database/.env found. Skipping initial setup."
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Start the server
echo ""
echo "Starting Audio-Draft server..."
echo "Open http://localhost:3000 in your browser"
echo "============================================"
node server.js
