const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    // Search for the specific error message in the logs
    conn.exec('docker logs nuvio-streams-app 2>&1 | grep "\[NetMirror Proxy\] M3U8 failed" | tail -n 10', (err, stream) => {
        let output = '';
        stream.on('data', (d) => output += d.toString());
        stream.on('close', () => {
            console.log('--- M3U8 Failure Logs ---');
            console.log(output || '(No specific failure logs found)');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
