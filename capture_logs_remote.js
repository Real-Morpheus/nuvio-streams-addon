const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected');
    conn.exec('cd /root/linux-deployment && docker-compose logs --tail 500 addon > /root/captured_logs.txt', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Logs captured to /root/captured_logs.txt');
            conn.end();
        });
    });
}).connect(config);
