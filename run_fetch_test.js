const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_fetch.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('--- Uploading test_fetch.js to VPS ---');
        sftp.fastPut(localScriptPath, '/tmp/test_fetch.js', {}, (err) => {
            if (err) throw err;
            console.log('📦 Uploaded test_fetch.js to /tmp');

            // Copy to container and execute
            const cmd = `
                docker cp /tmp/test_fetch.js nuvio-streams-app:/app/test_fetch.js &&
                docker exec nuvio-streams-app node test_fetch.js
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', (code) => {
                    console.log(`\n🚀 Fetch Test Complete (Exit Code: ${code})`);
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
