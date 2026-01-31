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

    conn.exec('curl -s ifconfig.me', (err, stream) => {
        stream.on('data', (d) => console.log('VPS External IP: ' + d.toString()));
        stream.on('close', () => conn.end());
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
