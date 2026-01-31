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
    conn.exec('cat /root/linux-deployment/providers/netmirror.js', (err, stream) => {
        const fs = require('fs');
        const fileStream = fs.createWriteStream('remote_mirror_dump.js');
        stream.pipe(fileStream);
        stream.on('close', () => {
            console.log('Saved to remote_mirror_dump.js');
            conn.end();
        });
    });
}).connect(config);
