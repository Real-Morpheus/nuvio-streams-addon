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
    // Search for the log marker
    conn.exec('docker logs nuvio-streams-app --tail 50', (err, stream) => {
        stream.on('data', d => console.log('STDOUT:', d.toString()));
        stream.stderr.on('data', d => console.log('STDERR:', d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(config);
