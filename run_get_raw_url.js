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
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\get_raw_url.js', '/opt/nuvio-deployment/nuvio-addon/get_raw_url.js', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded script');

            const cmd = 'docker cp /opt/nuvio-deployment/nuvio-addon/get_raw_url.js nuvio-streams-app:/app/get_raw_url.js && docker exec nuvio-streams-app node get_raw_url.js';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
