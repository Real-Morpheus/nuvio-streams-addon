const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        // Upload local internal_test_script.js to /opt/nuvio-deployment/nuvio-addon/internal_test.js
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\internal_test_script.js', '/opt/nuvio-deployment/nuvio-addon/internal_test.js', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded test script');

            // Now run it via docker exec
            const cmd = 'docker cp /opt/nuvio-deployment/nuvio-addon/internal_test.js nuvio-streams-app:/app/internal_test.js && docker exec nuvio-streams-app node internal_test.js';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
