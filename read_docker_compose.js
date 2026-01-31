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
    conn.exec('cat /opt/nuvio-deployment/nuvio-addon/docker-compose.yml', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', (d) => data += d.toString());
        stream.on('close', () => {
            console.log(data);
            conn.end();
        });
    });
}).connect(sshConfig);
