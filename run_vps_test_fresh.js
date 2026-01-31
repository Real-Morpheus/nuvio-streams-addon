const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const vpsTestScript = `
const { getStreams: getNetMirrorStreams } = require('./providers/netmirror.js');
const axios = require('axios');

async function run() {
    try {
        console.log('--- SCRAPING FRESH LINK ON VPS ---');
        // Use a popular movie to ensure results
        const streams = await getNetMirrorStreams('tt1375666', 'movie'); // Inception
        if (!streams || streams.length === 0) {
            console.log('No streams found');
            return;
        }
        
        const stream = streams[0];
        let originalUrl = stream.url;
        console.log('Original URL from provider:', originalUrl);
        
        // Find the "in=" parameter
        const match = originalUrl.match(/(in=[^&]*::)[^&]*/);
        if (!match) {
            console.log('No in= parameter found in URL');
            return;
        }
        
        const baseIn = match[1];
        const baseUrl = originalUrl.split('?')[0];
        const suffixes = ['ni', 'ed', 'ti', 'unknown', ''];
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://net51.cc/',
            'Cookie': 'hd=on'
        };

        for (const suffix of suffixes) {
            const testUrl = \`\${baseUrl}?in=\${baseIn}\${suffix}\`;
            try {
                const res = await axios.get(testUrl, { 
                    headers, 
                    timeout: 10000,
                    validateStatus: () => true 
                });
                console.log(\`Suffix [\${suffix}]: Status \${res.status}, Length \${typeof res.data === 'string' ? res.data.length : JSON.stringify(res.data).length}\`);
                if (typeof res.data === 'string' && res.data.includes('EXTM3U')) {
                    console.log('   (SUCCESS: Valid M3U8)');
                    // console.log(res.data.substring(0, 100));
                } else if (typeof res.data === 'string' && res.data.includes('Only Valid Users Allowed')) {
                    console.log('   (FAILED: Only Valid Users Allowed)');
                }
            } catch (e) {
                console.log(\`Suffix [\${suffix}]: ERROR: \${e.message}\`);
            }
        }
    } catch (err) {
        console.error('Outer Error:', err.message);
    }
}
run();
`;

async function runOnVPS() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('✅ Connected to VPS');
        conn.sftp((err, sftp) => {
            if (err) throw err;
            const remotePath = '/opt/nuvio-deployment/nuvio-addon/test_netmirror_fresh.js';
            const stream = sftp.createWriteStream(remotePath);
            stream.end(vpsTestScript);
            stream.on('close', () => {
                console.log('✅ Uploaded test script');
                conn.exec('cd /opt/nuvio-deployment/nuvio-addon && node test_netmirror_fresh.js', (err, cm) => {
                    if (err) throw err;
                    cm.on('data', (d) => process.stdout.write(d));
                    cm.on('stderr', (d) => process.stderr.write(d));
                    cm.on('close', () => {
                        console.log('✅ VPS Test Finished');
                        conn.end();
                    });
                });
            });
        });
    }).connect(sshConfig);
}

runOnVPS();
