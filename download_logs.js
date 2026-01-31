const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastGet('/tmp/full_logs.txt', 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\vps_logs.txt', (err) => {
            if (err) throw err;
            console.log('✅ Logs downloaded');
            conn.end();
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
