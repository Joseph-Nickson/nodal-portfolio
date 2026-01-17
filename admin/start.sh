#!/bin/bash

echo "Starting Portfolio Admin..."
echo ""

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install express cors multer
    echo ""
fi

echo "Server will start on http://localhost:3001"
echo "Open http://localhost:3001/admin in your browser"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.js
