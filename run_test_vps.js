const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_addon_streams.js');
        const writeStream = sftp.createWriteStream('/tmp/test_addon.js');

        writeStream.on('close', () => {
            console.log('✅ File uploaded');
            conn.exec('docker cp /tmp/test_addon.js nuvio-streams-app:/app/test_addon.js && docker exec nuvio-streams-app node test_addon.js', (err, stream) => {
                if (err) throw err;
                stream.on('data', (data) => console.log(data.toString()));
                stream.stderr.on('data', (data) => console.error(data.toString()));
                stream.on('close', () => {
                    console.log('✅ Execution finished');
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
