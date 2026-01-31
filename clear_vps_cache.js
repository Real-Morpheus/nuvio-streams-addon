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
    // Clear the .streams_cache directory inside the container
    conn.exec('docker exec nuvio-streams-app rm -rf /app/.streams_cache/*', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('✅ Cache cleared successfully');
            conn.end();
        });
    });
}).connect(sshConfig);
