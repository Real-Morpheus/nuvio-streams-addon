const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const exhaustiveSearchScript = `
const axios = require('axios');
async function run() {
    const endpoints = {
        'nf': 'https://net51.cc/search.php',
        'pv': 'https://net51.cc/pv/search.php',
        'hs': 'https://net51.cc/mobile/hs/search.php'
    };
    const query = 'Solo Leveling';
    
    for (const [key, url] of Object.entries(endpoints)) {
        console.log(\`--- Testing [\${key}]: \${url} ---\`);
        try {
            const res = await axios.get(\`\${url}?s=\${encodeURIComponent(query)}&t=\` + Math.floor(Date.now() / 1000), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://net51.cc/tv/home',
                    'Cookie': 'hd=on; user_token=233123f803cf02184bf6c67e149cdd50'
                }
            });
            console.log('Status:', res.status);
            console.log('Response:', JSON.stringify(res.data).substring(0, 500));
            if (res.data.searchResult) {
                console.log(\`✅ FOUND in [\${key}]: \${res.data.searchResult.length} items\`);
            }
        } catch (e) {
            console.log(\`FAILED [\${key}]: \${e.message}\`);
        }
    }
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec(`docker exec nuvio-streams-app node -e "${exhaustiveSearchScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('✅ Exhaustive Search Finished');
            conn.end();
        });
    });
}).connect(sshConfig);
