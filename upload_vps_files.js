const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989',
    remoteDir: '/opt/nuvio-deployment/nuvio-addon'
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

        const filesToUpload = [
            { local: 'server.js', remote: 'server.js' },
            { local: 'addon.js', remote: 'addon.js' },
            { local: 'Dockerfile', remote: 'Dockerfile' },
            { local: 'providers/netmirror.js', remote: 'providers/netmirror.js' }
        ];

        let completed = 0;
        filesToUpload.forEach(file => {
            const localFile = path.resolve(__dirname, file.local);
            const remoteFile = `${config.remoteDir}/${file.remote}`;

            console.log(`Uploading ${file.local} to ${remoteFile}...`);
            sftp.fastPut(localFile, remoteFile, (err) => {
                if (err) {
                    console.error(`Error uploading ${file.local}: ${err}`);
                } else {
                    console.log(`✅ Uploaded ${file.local}`);
                }

                completed++;
                if (completed === filesToUpload.length) {
                    conn.end();
                }
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
