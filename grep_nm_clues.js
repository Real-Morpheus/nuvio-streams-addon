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
    // Grep for scripts and forms in the saved homepage
    const cmd = "grep -E '<script|form|input' /opt/nuvio-deployment/nuvio-addon/nm_homepage.html | head -n 50";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data.toString());
        }).on('close', () => {
            conn.end();
        });
    });
}).connect(sshConfig);
