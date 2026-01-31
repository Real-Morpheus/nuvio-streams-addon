const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const serverConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const productionDir = '/root/linux-deployment';
const containerName = 'nuvio-streams-app';

const filesToUpload = [
    { local: 'providers/netmirror.js', remote: `${productionDir}/providers/netmirror.js` },
    { local: 'server.js', remote: `${productionDir}/server.js` }
];

conn.on('ready', () => {
    console.log('[SSH] Connected to server');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('[SFTP] Error starting SFTP:', err.message);
            conn.end();
            return;
        }

        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.join(__dirname, file.local);
            console.log(`[SFTP] Uploading ${localPath} to ${file.remote}...`);

            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`[SFTP] Upload failed for ${file.local}:`, err.message);
                    conn.end();
                    return;
                }
                console.log(`[SFTP] Upload successful for ${file.local}`);
                completed++;

                if (completed === filesToUpload.length) {
                    proceedToRestart();
                }
            });
        });

        function proceedToRestart() {
            // Copy files into container and restart
            const commands = [
                `docker cp ${productionDir}/providers/netmirror.js ${containerName}:/app/providers/netmirror.js`,
                `docker cp ${productionDir}/server.js ${containerName}:/app/server.js`,
                `docker restart ${containerName}`
            ];

            const fullCommand = commands.join(' && ');
            console.log(`[SSH] Executing: ${fullCommand}`);

            conn.exec(fullCommand, (err, stream) => {
                if (err) {
                    console.error('[SSH] Execute error:', err.message);
                    conn.end();
                    return;
                }

                stream.on('close', (code) => {
                    console.log(`\n[SSH] Command completed with code: ${code}`);
                    console.log('Production deployment finished successfully!');
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        }
    });
}).connect(serverConfig);

conn.on('error', (err) => {
    console.error('[SSH] Connection error:', err.message);
});
