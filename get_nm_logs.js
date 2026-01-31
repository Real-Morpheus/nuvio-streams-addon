const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker logs nuvio-streams-app 2>&1 | grep "NetMirror" | tail -n 100', (err, stream) => {
        if (err) throw err;
        const writeStream = fs.createWriteStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\nm_logs.txt');
        stream.pipe(writeStream);
        stream.on('close', () => {
            console.log('✅ Logs downloaded');
            conn.end();
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
