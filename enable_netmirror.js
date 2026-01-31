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

    // Check if ENABLE_NETMIRROR_PROVIDER exists, if not append it
    const cmd = 'grep -q "ENABLE_NETMIRROR_PROVIDER" /opt/nuvio-deployment/nuvio-addon/.env || echo "ENABLE_NETMIRROR_PROVIDER=true" >> /opt/nuvio-deployment/nuvio-addon/.env && docker restart nuvio-streams-app';

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('✅ Added ENABLE_NETMIRROR_PROVIDER=true to .env and restarted container');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
