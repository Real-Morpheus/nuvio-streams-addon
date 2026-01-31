const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\get_stream_url.js';
// We also want to upload helper scripts if needed, but get_stream_url.js depends on providers/netmirror.js which is already there, and addon.js logic.
// Actually get_stream_url.js likely imports ./providers/netmirror.js.

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('--- Uploading verification script to VPS ---');
        sftp.fastPut(localScriptPath, '/tmp/get_stream_url.js', {}, (err) => {
            if (err) throw err;
            console.log('📦 Uploaded get_stream_url.js to /tmp');

            // Copy to container and execute
            const cmd = `
                docker cp /tmp/get_stream_url.js nuvio-streams-app:/app/get_stream_url.js &&
                docker exec nuvio-streams-app node get_stream_url.js
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', (code, signal) => {
                    console.log(`\n🚀 Verification Complete (Exit Code: ${code})`);
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
