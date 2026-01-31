const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker logs --tail 1000 nuvio-streams-app 2>&1', (err, stream) => {
        if (err) throw err;
        let logs = '';
        stream.on('data', (data) => {
            logs += data.toString();
        }).on('close', () => {
            // Find recent "Request for" or stream requests
            console.log('--- RECENT REQUESTS ---');
            const lines = logs.split('\n');
            const requests = lines.filter(l => l.includes('Request for') || l.includes('streaming link') || l.includes('netmirror'));
            console.log(requests.join('\n'));
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(sshConfig);
