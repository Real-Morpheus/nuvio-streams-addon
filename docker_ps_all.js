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

    conn.exec('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', (err, stream) => {
        let output = '';
        stream.on('data', (d) => output += d.toString());
        stream.on('close', () => {
            console.log(output);
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
