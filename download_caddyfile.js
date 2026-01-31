const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    const remoteFile = '/root/linux-deployment/Caddyfile';
    const localFile = path.join(__dirname, 'vps_Caddyfile');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        sftp.fastGet(remoteFile, localFile, (err) => {
            if (err) {
                console.error('Download error: ' + err);
            } else {
                console.log('✅ Downloaded Caddyfile');
            }
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
