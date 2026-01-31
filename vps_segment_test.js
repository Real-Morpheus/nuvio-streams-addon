const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const vpsScript = `
const axios = require('axios');
async function run() {
    try {
        const manifestUrl = 'https://s21.freecdn4.top/files/220884/1080p/1080p.m3u8?in=ec8d0d4eb51a2a5729fbefdb7005e259::21ad378c0f9ca9c2b29eb56441b41e06::1769477544::ni';
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://net51.cc/',
            'Cookie': 'hd=on'
        };
        const res = await axios.get(manifestUrl, { headers });
        const lines = res.data.split('\\n');
        const segmentLine = lines.find(l => l && !l.startsWith('#'));
        if (!segmentLine) {
            console.log('No segment link found');
            return;
        }
        const segmentUrl = new URL(segmentLine, manifestUrl).toString();
        console.log('Segment URL:', segmentUrl);
        
        try {
            const r1 = await axios.get(segmentUrl, { headers, responseType: 'arraybuffer' });
            console.log('With Headers: SUCCESS, Length', r1.data.byteLength);
        } catch (e) {
            console.log('With Headers: FAILED', e.message);
        }
        
        try {
            const r2 = await axios.get(segmentUrl, { responseType: 'arraybuffer' });
            console.log('WITHOUT Headers: SUCCESS, Length', r2.data.byteLength);
        } catch (e) {
            console.log('WITHOUT Headers: FAILED', e.message);
        }
    } catch (e) {
        console.log('Test failed:', e.message);
    }
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec(`docker exec nuvio-streams-app node -e "${vpsScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('✅ VPS Test finished');
            conn.end();
        });
    });
}).connect(sshConfig);
