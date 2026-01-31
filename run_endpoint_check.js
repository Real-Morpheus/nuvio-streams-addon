const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\check_endpoints.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('--- Uploading check_endpoints.js to VPS ---');
        sftp.fastPut(localScriptPath, '/tmp/check_endpoints.js', {}, (err) => {
            if (err) throw err;
            console.log('📦 Uploaded check_endpoints.js to /tmp');

            const cmd = `
                docker cp /tmp/check_endpoints.js nuvio-streams-app:/app/check_endpoints.js &&
                docker exec nuvio-streams-app node check_endpoints.js
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', (code) => {
                    console.log(`\n🚀 Check Complete (Exit Code: ${code})`);
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
