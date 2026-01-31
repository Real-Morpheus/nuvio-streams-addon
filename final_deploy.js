const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localAddonPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\addon.js';
const localNetMirrorPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\providers\\netmirror.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    // 1. Upload to /tmp on VPS
    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('--- Uploading files to VPS ---');
        sftp.fastPut(localAddonPath, '/tmp/addon.js', {}, (err) => {
            if (err) throw err;
            console.log('📦 Uploaded addon.js to /tmp');

            sftp.fastPut(localNetMirrorPath, '/tmp/netmirror.js', {}, (err) => {
                if (err) throw err;
                console.log('📦 Uploaded netmirror.js to /tmp');

                // 2. Overwrite host files and copy to container
                const setupCmd = `
                    # Host files
                    cp /tmp/addon.js /root/linux-deployment/addon.js &&
                    cp /tmp/netmirror.js /root/linux-deployment/providers/netmirror.js &&
                    
                    # Container files (just in case)
                    docker cp /tmp/addon.js nuvio-streams-app:/app/addon.js &&
                    docker cp /tmp/netmirror.js nuvio-streams-app:/app/providers/netmirror.js &&
                    
                    # Restart
                    docker restart nuvio-streams-app
                `;

                conn.exec(setupCmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('data', (d) => process.stdout.write(d.toString()));
                    stream.on('stderr', (d) => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('🚀 Deployment and Restart Complete');
                        conn.end();
                    });
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
