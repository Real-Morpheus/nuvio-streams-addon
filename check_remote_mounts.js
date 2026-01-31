const { Client } = require('ssh2');
const fs = require('fs');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    const command = 'cat /opt/nuvio-deployment/nuvio-addon/docker-compose.yml && ls -la /opt/nuvio-deployment/nuvio-addon/test_require.js';
    console.log(`Executing: ${command}`);

    let fullOutput = '';
    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            fs.writeFileSync('remote_mounts.txt', fullOutput);
            console.log('Full output written to remote_mounts.txt');
            conn.end();
        }).on('data', (data) => {
            fullOutput += 'STDOUT: ' + data;
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            fullOutput += 'STDERR: ' + data;
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
