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

const localAddonPath = path.join(__dirname, 'addon.js');
const localNetMirrorPath = path.join(__dirname, 'providers', 'netmirror.js');
const remoteAddonPath = '/opt/nuvio-deployment/nuvio-addon/addon.js';
const remoteNetMirrorPath = '/opt/nuvio-deployment/nuvio-addon/providers/netmirror.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('📤 Uploading addon.js to host...');
        sftp.fastPut(localAddonPath, remoteAddonPath, (err) => {
            if (err) throw err;
            console.log('✅ Uploaded addon.js to host');

            console.log('📤 Uploading netmirror.js to host...');
            sftp.fastPut(localNetMirrorPath, remoteNetMirrorPath, (err) => {
                if (err) throw err;
                console.log('✅ Uploaded netmirror.js to host');

                console.log('📦 Copying files into docker container...');
                const cmd = [
                    'docker cp /opt/nuvio-deployment/nuvio-addon/addon.js nuvio-streams-app:/app/addon.js',
                    'docker cp /opt/nuvio-deployment/nuvio-addon/providers/netmirror.js nuvio-streams-app:/app/providers/netmirror.js',
                    'docker restart nuvio-streams-app',
                    'docker exec nuvio-streams-app rm -rf /app/.streams_cache/*'
                ].join(' && ');

                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('data', (d) => process.stdout.write(d.toString()));
                    stream.on('stderr', (d) => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('✅ Files copied, container restarted, and cache cleared');
                        conn.end();
                    });
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
