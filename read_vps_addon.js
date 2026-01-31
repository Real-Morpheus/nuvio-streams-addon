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

    const command = 'cat /opt/nuvio-deployment/nuvio-addon/addon.js';
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        let output = '';
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            // console.log('STDOUT: ' + output);
            const fs = require('fs');
            fs.writeFileSync('vps_addon.js', output);
            console.log('Saved VPS addon.js to vps_addon.js');
            conn.end();
        }).on('data', (data) => {
            output += data;
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
