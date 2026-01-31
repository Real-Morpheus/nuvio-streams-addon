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
    conn.exec('docker exec nuvio-streams-app cat /app/debug_chain.log', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
