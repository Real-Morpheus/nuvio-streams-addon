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
    // Check if file exists and run it, capturing all output
    conn.exec('ls -l /opt/nuvio-deployment/nuvio-addon/test_netmirror_fresh.js && cd /opt/nuvio-deployment/nuvio-addon && node test_netmirror_fresh.js', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            console.log('STDOUT:', data.toString());
        }).stderr.on('data', (data) => {
            console.error('STDERR:', data.toString());
        }).on('close', (code) => {
            console.log(`✅ Finished with code ${code}`);
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(sshConfig);
