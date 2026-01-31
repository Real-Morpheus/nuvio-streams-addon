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
const localFile = path.join(__dirname, 'docker-compose.remote.yml');
const remotePath = '/opt/nuvio-deployment/nuvio-addon/docker-compose.yml';

conn.on('ready', () => {
    console.log('✅ Connected');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        console.log(`Uploading ${localFile} to ${remotePath}...`);

        // Use fastPut for file transfer
        sftp.fastPut(localFile, remotePath, (err) => {
            if (err) {
                console.error('Upload error: ' + err);
                conn.end();
                return;
            }

            console.log('✅ docker-compose.yml updated successfully via SFTP');

            // Now recreate the container to apply changes
            const restartCommand = 'cd /opt/nuvio-deployment/nuvio-addon && docker compose up -d --force-recreate app';
            console.log(`Executing restart: ${restartCommand}`);

            conn.exec(restartCommand, (err, stream) => {
                if (err) {
                    console.error('Exec error: ' + err);
                    conn.end();
                    return;
                }

                stream.on('close', (code, signal) => {
                    console.log('Restart completed with code: ' + code);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('STDERR: ' + data);
                });
            });
        });
    });

}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
