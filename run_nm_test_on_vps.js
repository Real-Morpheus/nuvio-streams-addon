const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_netmirror_direct.js');
        const writeStream = sftp.createWriteStream('/tmp/test_nm_direct.js');

        writeStream.on('close', () => {
            console.log('✅ Test script uploaded');
            conn.exec('docker cp /tmp/test_nm_direct.js nuvio-streams-app:/app/test_nm_direct.js && docker exec nuvio-streams-app node test_nm_direct.js', (err, stream) => {
                if (err) throw err;
                stream.on('data', (data) => process.stdout.write(data.toString()));
                stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
                stream.on('close', () => {
                    console.log('✅ Test finished');
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
