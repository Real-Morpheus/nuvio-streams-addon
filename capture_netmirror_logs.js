const { Client } = require('ssh2');
const axios = require('axios');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

async function capture() {
    console.log('--- CAPTURING NETMIRROR LOGS FOR INCEPTION ---');

    // 1. Get current time (UTC) for docker logs --since
    const now = new Date();
    // Docker log --since expects RFC3339
    const since = now.toISOString();

    console.log(`Starting monitoring since ${since}`);

    // 2. Trigger the request
    try {
        console.log('Triggering request to addon...');
        await axios.get('https://nuvio.stremio.click/stream/movie/tt1375666.json', { timeout: 30000 });
        console.log('Request finished.');
    } catch (e) {
        console.log('Request finished with error (expected if NO_STREAMS):', e.message);
    }

    // Wait a moment for logs to flush
    console.log('Waiting 3s for logs...');
    await new Promise(r => setTimeout(r, 3000));

    // 3. Get logs via SSH
    const conn = new Client();
    conn.on('ready', () => {
        console.log('✅ SSH Connected');
        // We use --since with the exact time we started
        conn.exec(`docker logs --since ${since} nuvio-streams-app 2>&1`, (err, stream) => {
            if (err) throw err;
            let output = '';
            stream.on('data', (d) => {
                const chunk = d.toString();
                output += chunk;
            });
            stream.on('close', () => {
                console.log('--- LOGS START ---');
                console.log(output);
                console.log('--- LOGS END ---');
                conn.end();
            });
        });
    }).connect(sshConfig);
}

capture();
