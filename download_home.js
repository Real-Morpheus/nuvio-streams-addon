const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec('docker exec nuvio-streams-app curl -s -L -b /tmp/netmirror_cookies.txt "https://net52.cc/tv/home"', (err, stream) => {
        if (err) throw err;
        const writeStream = fs.createWriteStream('c:\\Users\\Administrator\\Desktop\\linux-deployment\\vps_home_full.html');
        stream.pipe(writeStream);
        stream.on('close', () => {
            console.log('✅ File downloaded');
            conn.end();
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
