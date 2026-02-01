#!/bin/sh
# Start Tor in background
tor > /dev/null 2>&1 &

# Wait for Tor to bootstrap
echo "Waiting for Tor to start..."
timeout 60s sh -c 'until nc -z 127.0.0.1 9050; do sleep 1; done'
echo "Tor started!"

# Background: Rotate Tor circuit every 5 minutes to avoid blocks
(
    while true; do
        sleep 300
        echo "[System] Rotating Tor IP..."
        pkill -HUP tor
    done
) &

# Start Node app
exec node server.js
