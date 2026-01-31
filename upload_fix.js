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
const localFile = path.join(__dirname, 'providers', 'netmirror.js');
const remotePath = '/opt/nuvio-deployment/nuvio-addon/providers/netmirror.js';

conn.on('ready', () => {
    console.log('✅ Connected');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        console.log(`Uploading ${localFile} to ${remotePath}...`);

        sftp.fastPut(localFile, remotePath, (err) => {
            if (err) {
                console.error('Upload error: ' + err);
                conn.end();
                return;
            }

            console.log('✅ netmirror.js updated successfully via SFTP');

            // Now restart the container
            const restartCommand = 'cd /opt/nuvio-deployment/nuvio-addon && docker compose restart app';
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
