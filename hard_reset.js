const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    // Hard reset steps
    const command = 'cd /opt/nuvio-deployment/nuvio-addon && docker stop nuvio-streams-app || true && docker rm nuvio-streams-app || true && docker compose up -d';
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Command completed with code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
