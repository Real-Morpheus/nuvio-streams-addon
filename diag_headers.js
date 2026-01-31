const { Client } = require('ssh2');
const fs = require('fs');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    const tm = Math.floor(Date.now() / 1000).toString();
    const id = "0KVQ8MNNEUBI4MPGFI1WSFPTYD";
    const salt = "ed";

    const crypto = require('crypto');
    function md5(input) { return crypto.createHash('md5').update(input).digest('hex'); }
    const token = md5(id + tm + salt);

    const url = `https://net51.cc/pv/hls/${id}.m3u8?q=720p&in=::${token}::${tm}::${salt}`;

    const tests = [
        { name: 'UA: Mozilla/5.0, Referer: https://net51.cc/', h: '-H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/"' },
        { name: 'Same as working curl', h: '-H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/"' },
        { name: 'Current Proxy Headers', h: '-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1" -H "Referer: https://net51.cc/" -H "Origin: https://net51.cc"' },
        { name: 'Proxy Headers NO ORIGIN', h: '-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1" -H "Referer: https://net51.cc/"' },
        { name: 'Desktop UA, Referer: https://net51.cc/', h: '-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Referer: https://net51.cc/"' }
    ];

    let output = '';
    async function run() {
        for (const t of tests) {
            output += `--- ${t.name} ---\n`;
            const command = `curl -I -s ${t.h} "${url}" | head -n 1`;
            await new Promise(resolve => {
                conn.exec(command, (err, stream) => {
                    stream.on('data', d => output += 'Res: ' + d.toString().trim() + '\n');
                    stream.on('close', resolve);
                });
            });
        }
        fs.writeFileSync('header_diag_results.txt', output);
        console.log('✅ Diagnostic results saved');
        conn.end();
    }
    run();
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
