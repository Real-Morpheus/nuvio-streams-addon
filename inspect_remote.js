const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
const fs = require('fs');
const outputFile = 'remote_inspect.txt';
const logStream = fs.createWriteStream(outputFile);

conn.on('ready', () => {
    console.log('✅ Connected');

    const command = 'grep -A 30 "netmirror: async" /opt/nuvio-deployment/nuvio-addon/addon.js';
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            logStream.write(`\n--- CLOSED (code: ${code}, signal: ${signal}) ---\n`);
            logStream.end();
            conn.end();
        }).on('data', (data) => {
            logStream.write(data);
        }).stderr.on('data', (data) => {
            logStream.write('[STDERR] ' + data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
