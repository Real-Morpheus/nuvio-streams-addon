const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker exec nuvio-streams-app ls -la /tmp/', (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.on('close', () => {
            console.log("--- CAT LOG ---");
            conn.exec('docker exec nuvio-streams-app cat /tmp/netmirror_debug.log', (err, stream2) => {
                if (err) throw err;
                stream2.on('data', d => process.stdout.write(d.toString()));
                stream2.on('close', () => conn.end());
            });
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
