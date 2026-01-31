const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
conn.on('ready', () => {
    conn.exec('docker logs --tail=100 nuvio-streams-app 2>&1', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data);
        }).on('close', () => {
            conn.end();
        });
    });
}).connect(config);
