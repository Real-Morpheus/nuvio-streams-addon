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
    // Common cache directories: /app/cache, /tmp/stremio-cache, etc.
    conn.exec('docker exec nuvio-streams-app find /app -name "*cache*" -type d', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
