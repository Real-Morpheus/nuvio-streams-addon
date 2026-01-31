const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\discover_endpoints_v2.js');
        const writeStream = sftp.createWriteStream('/tmp/disc2.js');

        writeStream.on('close', () => {
            conn.exec('docker cp /tmp/disc2.js nuvio-streams-app:/app/disc2.js && docker exec nuvio-streams-app node disc2.js && docker cp nuvio-streams-app:/tmp/disc_results.txt /tmp/disc_results.txt', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    sftp.fastGet('/tmp/disc_results.txt', 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\disc_results.txt', (err) => {
                        if (err) throw err;
                        console.log('✅ Results downloaded');
                        conn.end();
                    });
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
