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
        sftp.fastPut('c:\\Users\\Administrator\\Desktop\\linux-deployment\\reproduce_fetch.js', '/opt/nuvio-deployment/nuvio-addon/reproduce_fetch.js', (err) => {
            if (err) throw err;
            console.log('✅ Uploaded reproduction script');

            const cmd = 'docker cp /opt/nuvio-deployment/nuvio-addon/reproduce_fetch.js nuvio-streams-app:/app/reproduce_fetch.js && docker exec nuvio-streams-app node reproduce_fetch.js';
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (d) => process.stdout.write(d.toString()));
                stream.on('stderr', (d) => process.stderr.write(d.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect(sshConfig);
