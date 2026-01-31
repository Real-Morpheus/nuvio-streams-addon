const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function checkNetMirrorProxy() {
    const logStream = fs.createWriteStream('server_output.txt');

    console.log('Starting server...');
    const serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'], // Pipe stdout and stderr
        env: { ...process.env, PORT: '7001' }
    });

    serverProcess.stdout.pipe(logStream);
    serverProcess.stderr.pipe(logStream);

    const PORT = 7001;
    const BASE_URL = `http://localhost:${PORT}`;

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        console.log('Server started. Fetching stream...');

        // Mock a stream request to the addon
        // Use Inception (27205) with tmdb prefix
        const tmdbId = 'tmdb:27205';
        const type = 'movie';

        const streamUrl = `${BASE_URL}/stream/${type}/${tmdbId}.json`;
        console.log(`Requesting: ${streamUrl}`);

        const response = await axios.get(streamUrl);

        if (!response.data || !response.data.streams) {
            console.error('No streams returned from addon.');
            return;
        }

        const netMirrorStream = response.data.streams.find(s =>
            (s.provider === 'NetMirror' || s.name.includes('NetMirror')) && s.url.includes('/netmirror/m3u8')
        );

        if (!netMirrorStream) {
            console.error('NetMirror proxied stream not found in results.');
            console.log('Available streams:', JSON.stringify(response.data.streams, null, 2));
            return;
        }

        console.log('Found NetMirror proxied stream:', netMirrorStream.url);

        // Verify the URL points to our local proxy
        if (!netMirrorStream.url.startsWith(`${BASE_URL}/netmirror/m3u8`)) {
            console.error('Stream URL does not point to local proxy:', netMirrorStream.url);
            return;
        }

        // Fetch the proxied M3U8
        console.log('Fetching proxied M3U8...');
        const m3u8Response = await axios.get(netMirrorStream.url);

        if (m3u8Response.status !== 200) {
            console.error('Failed to fetch proxied M3U8. Status:', m3u8Response.status);
            return;
        }

        console.log('Proxied M3U8 fetched successfully.');
        const m3u8Content = m3u8Response.data;

        // Check if segments are proxied
        if (!m3u8Content.includes('segment?url=')) {
            console.error('M3U8 content does not contain proxied segments.');
            console.log('Content snippet:', m3u8Content.substring(0, 200));
            return;
        }

        console.log('M3U8 contains proxied segments.');

        // Extract a segment URL
        const lines = m3u8Content.split('\n');
        const segmentLine = lines.find(l => l.includes('segment?url='));

        if (!segmentLine) {
            console.error('Could not find a segment line in M3U8.');
            return;
        }

        const segmentUrl = `${BASE_URL}/netmirror/${segmentLine.trim()}`;
        console.log('Fetching segment:', segmentUrl);

        // Fetch the segment (just the head or first few bytes to verify connectivity)
        const segmentResponse = await axios.get(segmentUrl, {
            responseType: 'stream'
        });

        if (segmentResponse.status !== 200) {
            console.error('Failed to fetch segment. Status:', segmentResponse.status);
            return;
        }

        console.log('Segment fetched successfully.');
        console.log('NetMirror Proxy Verification PASSED!');

    } catch (error) {
        console.log('Verification failed with error:', error);
        console.log('Error message:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        console.log('Stopping server...');
        serverProcess.kill();
        // Wait a bit for logs to flush
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('--- Server Log Output ---');
        try {
            const logs = fs.readFileSync('server_output.txt', 'utf8');
            console.log(logs);
        } catch (e) {
            console.log('Could not read server logs:', e.message);
        }
    }
}

checkNetMirrorProxy();
