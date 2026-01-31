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
    conn.exec('ls -la /opt/nuvio-deployment/nuvio-addon/', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('close', () => {
            // Also try to grep properly this time
            conn.exec('grep -r "TMDB_API_KEY" /opt/nuvio-deployment/nuvio-addon/', (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('data', (d) => console.log('GREP RESULT:', d.toString()));
                stream2.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
