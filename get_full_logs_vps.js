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

    conn.exec('docker logs --tail 200 nuvio-streams-app 2>&1', (err, stream) => {
        let output = '';
        stream.on('data', (d) => output += d.toString());
        stream.on('close', () => {
            fs.writeFileSync('full_logs_from_vps.txt', output);
            console.log('✅ Saved logs to full_logs_from_vps.txt');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
