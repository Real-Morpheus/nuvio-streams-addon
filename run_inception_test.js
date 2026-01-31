const { Client } = require('ssh2');

const conn = new Client();
const localScriptPath = 'c:\\Users\\Administrator\\Desktop\\linux-deployment\\test_netmirror_inception.js';

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut(localScriptPath, '/tmp/test_netmirror_inception.js', {}, (err) => {
            if (err) throw err;
            const cmd = `
                docker cp /tmp/test_netmirror_inception.js nuvio-streams-app:/app/test_netmirror_inception.js &&
                docker exec nuvio-streams-app node test_netmirror_inception.js
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
