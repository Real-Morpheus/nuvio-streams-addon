const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

async function runIntegratedTest() {
    const url = 'https://nuvio.stremio.click/netmirror/m3u8?url=https%3A%2F%2Fs21.freecdn4.top%2Ffiles%2F220884%2F1080p%2F1080p.m3u8%3Fin%3Dunknown%3A%3Aed&cookie=hd%3Don';
    console.log(`Requesting: ${url}`);

    // Start SSH connection to listen for logs
    const conn = new Client();
    conn.on('ready', async () => {
        console.log('SSH Ready');

        // Fetch the URL
        try {
            const res = await fetch(url);
            const text = await res.text();
            console.log('--- RESPONSE RECEIVED ---');
            console.log(`Status: ${res.status}`);
            console.log(`Length: ${text.length}`);
            console.log('--- END RESPONSE ---');

            // Now get logs
            conn.exec('docker logs --tail=50 nuvio-streams-app 2>&1', (err, stream) => {
                if (err) throw err;
                console.log('--- DOCKER LOGS ---');
                stream.on('data', (data) => {
                    process.stdout.write(data);
                }).on('close', () => {
                    console.log('\n--- END DOCKER LOGS ---');
                    conn.end();
                });
            });
        } catch (e) {
            console.error(`Fetch error: ${e.message}`);
            conn.end();
        }
    }).connect(sshConfig);
}

runIntegratedTest();
