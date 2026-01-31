const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\discover_endpoints.js');
        const writeStream = sftp.createWriteStream('/tmp/disc.js');

        writeStream.on('close', () => {
            conn.exec('docker cp /tmp/disc.js nuvio-streams-app:/app/disc.js && docker exec nuvio-streams-app node disc.js', (err, stream) => {
                if (err) throw err;
                stream.on('data', (data) => process.stdout.write(data.toString()));
                stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
                stream.on('close', () => {
                    conn.end();
                });
            });
        });
        readStream.pipe(writeStream);
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
