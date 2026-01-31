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
    conn.exec('docker logs -f nuvio-streams-app 2>&1', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => {
            const output = d.toString();
            if (output.includes('TMDB') || output.includes('Convert') || output.includes('find API')) {
                process.stdout.write(output);
            }
        });
    });
}).connect(sshConfig);
