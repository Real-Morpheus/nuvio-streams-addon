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
    conn.exec('cat /opt/nuvio-deployment/nuvio-addon/nm_homepage.html', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            console.log('--- CONTENT ---');
            console.log(data.toString());
            console.log('--- END ---');
        }).on('close', () => {
            conn.end();
        });
    });
}).connect(sshConfig);
