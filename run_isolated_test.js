const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_netmirror_isolated.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        console.log('--- Uploading isolated test script to VPS ---');
        sftp.fastPut(localScriptPath, '/tmp/test_netmirror_isolated.js', {}, (err) => {
            if (err) throw err;
            console.log('📦 Uploaded test_netmirror_isolated.js to /tmp');

            // Copy to container and execute, ensuring we cat the logs even if it fails
            const cmd = `
                docker cp /tmp/test_netmirror_isolated.js nuvio-streams-app:/app/test_netmirror_isolated.js &&
                docker exec nuvio-streams-app sh -c "node test_netmirror_isolated.js > /tmp/out.log 2> /tmp/err.log; echo 'EXIT_CODE: $?'" &&
                echo "--- STDOUT ---" &&
                docker exec nuvio-streams-app cat /tmp/out.log &&
                echo "--- STDERR ---" &&
                docker exec nuvio-streams-app cat /tmp/err.log
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', (code) => {
                    console.log(`\n🚀 Test Complete (Exit Code: ${code})`);
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
