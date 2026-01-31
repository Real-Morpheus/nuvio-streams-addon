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

    conn.exec('docker ps -f name=nuvio-streams-nginx', (err, stream) => {
        stream.on('data', (d) => console.log('Nginx Status:\n' + d.toString()));
        stream.on('close', () => {
            conn.exec('docker logs --tail 20 nuvio-streams-nginx', (err, logStream) => {
                logStream.on('data', (d) => console.log('Nginx Logs:\n' + d.toString()));
                logStream.on('close', () => conn.end());
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
