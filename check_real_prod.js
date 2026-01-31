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

    // Check for the fix in the REAL production directory
    conn.exec('grep "calculateNetMirrorToken" /root/linux-deployment/providers/netmirror.js', (err, stream) => {
        stream.on('data', (d) => console.log('Grep Output (netmirror.js):\n' + d.toString()));
        stream.on('close', () => {
            conn.exec('grep "NetMirror Proxy" /root/linux-deployment/server.js', (err, stream2) => {
                stream2.on('data', (d) => console.log('Grep Output (server.js):\n' + d.toString()));
                stream2.on('close', () => conn.end());
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
