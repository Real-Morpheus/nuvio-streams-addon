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

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        const filesToDownload = [
            { remote: '/opt/nuvio-deployment/nuvio-addon/reproduce_log.txt', local: 'remote_reproduce_log.txt' },
            { remote: '/opt/nuvio-deployment/nuvio-addon/playlist_response.json', local: 'remote_playlist_response.json' }
        ];

        // Also try to get from container if they are not on host
        // But I did docker cp to /tmp previously

        let completed = 0;
        filesToDownload.forEach(file => {
            console.log(`Downloading ${file.remote}...`);
            sftp.fastGet(file.remote, path.resolve(__dirname, file.local), (err) => {
                if (err) {
                    console.error(`Error downloading ${file.remote}: ${err}`);
                } else {
                    console.log(`✅ Downloaded ${file.local}`);
                }

                completed++;
                if (completed === filesToDownload.length) {
                    conn.end();
                }
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
