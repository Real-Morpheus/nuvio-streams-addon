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
    // Check files in the container
    const cmd = 'docker exec nuvio-streams-app ls -F';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data.toString());
        }).on('close', () => {
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(sshConfig);
