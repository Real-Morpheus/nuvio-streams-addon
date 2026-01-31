const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const debugSearchScript = `
const { getStreams } = require('./providers/netmirror');
const axios = require('axios');

async function debug() {
    try {
        console.log('--- DEBUGGING NETMIRROR SEARCH ---');
        // We'll manually step through searchContent if needed,
        // but let's just see what getStreams does with some extra logging.
        // Actually, let's just use the provider as-is first.
        const streams = await getStreams({ type: 'movie', id: 'tt1375666', config: {} });
        console.log('Final Streams found:', streams.length);
        if (streams.length > 0) {
            console.log('First stream URL:', streams[0].url);
        }
    } catch (e) {
        console.error('Debug Error:', e);
    }
}
debug();
`;

// Also check the site directly
const checkSiteScript = `
const axios = require('axios');
async function check() {
    try {
        console.log('--- CHECKING NET51.CC DIRECTLY ---');
        const res = await axios.get('https://net51.cc/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        console.log('Site Status:', res.status);
        console.log('Title:', res.data.match(/<title>(.*?)<\\/title>/)?.[1]);
    } catch (e) {
        console.error('Site Error:', e.message);
    }
}
check();
`;

async function runDebug() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('✅ SSH Connected');
        // Upload both debug scripts
        conn.sftp((err, sftp) => {
            if (err) throw err;
            sftp.createWriteStream('/opt/nuvio-deployment/nuvio-addon/debug_nm_search.js').end(debugSearchScript);
            sftp.createWriteStream('/opt/nuvio-deployment/nuvio-addon/check_site.js').end(checkSiteScript);

            setTimeout(() => {
                console.log('✅ Uploaded debug scripts');
                conn.exec('docker cp /opt/nuvio-deployment/nuvio-addon/debug_nm_search.js nuvio-streams-app:/app/debug_nm_search.js && docker cp /opt/nuvio-deployment/nuvio-addon/check_site.js nuvio-streams-app:/app/check_site.js && docker exec nuvio-streams-app node debug_nm_search.js && docker exec nuvio-streams-app node check_site.js', (err, stream) => {
                    if (err) throw err;
                    stream.on('data', (d) => process.stdout.write(d.toString()));
                    stream.on('stderr', (d) => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('✅ Debug Finished');
                        conn.end();
                    });
                });
            }, 1000);
        });
    }).connect(sshConfig);
}

runDebug();
