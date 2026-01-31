const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const bypassTestScript = `
const axios = require('axios');
const NETMIRROR_BASE = 'https://net51.cc';

async function testBypass() {
    try {
        console.log('Attempting bypass...');
        const res = await axios.post(\`\${NETMIRROR_BASE}/tv/p.php\`, {}, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        
        const setCookie = res.headers['set-cookie'];
        let cookie = '';
        if (setCookie) {
            const match = setCookie[0].match(/t_hash_t=([^;]+)/);
            if (match) cookie = match[1];
        }
        console.log('Bypass cookie:', cookie);
        
        const searchUrl = \`\${NETMIRROR_BASE}/search.php?s=Solo%20Leveling\`;
        
        // Test 1: WITH t_hash_t
        const r1 = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': \`t_hash_t=\${cookie}\`
            }
        });
        console.log('WITH t_hash_t results:', r1.data.searchResult ? r1.data.searchResult.length : 0);

        // Test 2: NOTHING
        const r2 = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        console.log('WITHOUT cookies results:', r2.data.searchResult ? r2.data.searchResult.length : 0);

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
testBypass();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    // Save script, run it, and cat results
    const fullCmd = \`docker exec nuvio-streams-app node -e "\${bypassTestScript.replace(/"/g, '\\\\"').replace(/\\n/g, ' ')}" 2>&1\`;
    conn.exec(fullCmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
