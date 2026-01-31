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
    conn.exec('docker logs --tail 200 nuvio-streams-app 2>&1', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => {
            const output = d.toString();
            // Filter for debug logs
            if (output.includes('DEBUG_') || output.includes('Failed') || output.includes('TMDB')) {
                process.stdout.write(output);
            }
        });
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
