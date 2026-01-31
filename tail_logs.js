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
        stream.on('data', (data) => {
            const logs = data.toString();
            // Filter for relevant logs
            const filtered = logs.split('\n').filter(l =>
                l.includes('NetMirror') ||
                l.includes('Solo Leveling') ||
                l.includes('tt13410710') ||
                l.includes('Searching') ||
                l.includes('Found')
            );
            console.log(filtered.join('\n'));
        }).on('close', () => {
            conn.end();
        });
    });
}).connect(sshConfig);
