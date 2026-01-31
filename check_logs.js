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

conn.on('ready', () => {
    console.log('✅ Connected');

    const command = 'docker logs --tail=100 nuvio-streams-app 2>&1';
    const logFile = path.join(__dirname, 'remote_debug_logs.txt');
    const logStream = fs.createWriteStream(logFile);
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
            logStream.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
            logStream.write(data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
            logStream.write(data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
