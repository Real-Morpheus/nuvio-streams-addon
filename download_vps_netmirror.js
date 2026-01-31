const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker cp nuvio-streams-app:/app/providers/netmirror.js /tmp/remote_netmirror.js', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.sftp((err, sftp) => {
                if (err) throw err;
                sftp.fastGet('/tmp/remote_netmirror.js', 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\vps_netmirror.js', (err) => {
                    if (err) throw err;
                    console.log('✅ Remote netmirror.js downloaded');
                    conn.end();
                });
            });
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
