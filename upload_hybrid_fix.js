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
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\addon.js', '/opt/nuvio-deployment/nuvio-addon/addon.js', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded addon.js');

            // Rebuild
            const cmd = 'cd /opt/nuvio-deployment/nuvio-addon && docker compose restart app';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
