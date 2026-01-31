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
    conn.exec('cd /opt/nuvio-deployment/nuvio-addon && node test_netmirror_fresh.js', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            console.log(data.toString());
        }).on('stderr', (data) => {
            console.error(data.toString());
        }).on('close', () => {
            console.log('✅ Test finished');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(sshConfig);
