const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_raw_search.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut(localScriptPath, '/tmp/test_raw_search.js', {}, (err) => {
            if (err) throw err;
            const cmd = `
                docker cp /tmp/test_raw_search.js nuvio-streams-app:/app/test_raw_search.js &&
                docker exec nuvio-streams-app node test_raw_search.js
            `;
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d.toString()));
                stream.on('close', code => conn.end());
            });
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
