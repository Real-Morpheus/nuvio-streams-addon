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
        // Upload local .env to remote .env
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\.env', '/opt/nuvio-deployment/nuvio-addon/.env', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded .env file');

            // Restart
            const cmd = 'cd /opt/nuvio-deployment/nuvio-addon && docker compose up -d app';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
