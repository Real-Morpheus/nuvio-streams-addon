const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const localHash = crypto.createHash('md5').update(fs.readFileSync('c:\\Users\\Administrator\\Desktop\\linux-deployment\\providers\\showbox.js')).digest('hex');
console.log('Local Hash:', localHash);

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker exec nuvio-streams-app md5sum /app/providers/showbox.js', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write('Remote Hash: ' + d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
