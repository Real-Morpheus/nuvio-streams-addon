const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989',
    remoteDir: '/root/linux-deployment/providers'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        const files = ['netmirror.js'];
        const localDir = path.join(__dirname, 'providers');

        let completed = 0;
        files.forEach(file => {
            const localFile = path.join(localDir, file);
            const remoteFile = `${config.remoteDir}/${file}`;

            sftp.fastPut(localFile, remoteFile, (err) => {
                if (err) {
                    console.error(`Error uploading ${file}: ${err}`);
                } else {
                    console.log(`✅ Uploaded ${file}`);
                }

                completed++;
                if (completed === files.length) {
                    conn.end();
                }
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
