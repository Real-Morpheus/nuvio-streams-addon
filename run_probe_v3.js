const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\probe_endpoints_v3.js');
        const writeStream = sftp.createWriteStream('/tmp/probe3.js');

        writeStream.on('close', () => {
            conn.exec('docker cp /tmp/probe3.js nuvio-streams-app:/app/probe3.js && docker exec nuvio-streams-app node probe3.js && docker cp nuvio-streams-app:/tmp/probe_results.txt /tmp/probe_results.txt', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    sftp.fastGet('/tmp/probe_results.txt', 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\probe_results.txt', (err) => {
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
