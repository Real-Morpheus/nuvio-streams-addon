const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\debug_proxy_chain.js', '/opt/nuvio-deployment/nuvio-addon/debug_proxy_chain.js', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded debug script');

            // Rebuild/Copy
            const cmd = 'docker cp /opt/nuvio-deployment/nuvio-addon/debug_proxy_chain.js nuvio-streams-app:/app/debug_proxy_chain.js && docker exec nuvio-streams-app sh -c "echo > /app/debug_chain.log && node debug_proxy_chain.js && cat /app/debug_chain.log"';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
