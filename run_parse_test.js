const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_parse.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut(localScriptPath, '/tmp/test_parse.js', {}, (err) => {
            if (err) throw err;
            const cmd = `
                docker cp /tmp/test_parse.js nuvio-streams-app:/app/test_parse.js &&
                docker exec nuvio-streams-app node test_parse.js > /tmp/parse_result.txt 2>&1
            `;
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', code => {
                    conn.exec('docker exec nuvio-streams-app cat /tmp/parse_result.txt', (err, stream2) => {
                        stream2.on('data', d => process.stdout.write(d.toString()));
                        stream2.on('close', () => conn.end());
                    });
                });
            });
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
