const { Client } = require('ssh2');

const config = {
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
        let output = '';
        stream.on('data', (d) => output += d.toString());
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('--- docker-compose.yml content ---');
            console.log(output);
            console.log('--- end ---');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
