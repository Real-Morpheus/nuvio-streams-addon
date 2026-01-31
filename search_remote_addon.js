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
    conn.exec('grep -n "requestSpecificConfig =" /root/linux-deployment/addon.js', (err, stream) => {
        stream.on('data', d => console.log(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(config);
