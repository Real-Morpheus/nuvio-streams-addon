const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    // Create a timestamp for the backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = `/opt/nuvio-deployment/backup_${timestamp}`;
    const sourceDir = '/opt/nuvio-deployment/nuvio-addon';

    // Command to create backup directory and copy contents
    // excluding potentially large dirs if needed (like node_modules logs), but request was simplistic.
    // Let's just cp -r.
    const command = `
        mkdir -p "${backupDir}" && \
        cp -r "${sourceDir}/"* "${backupDir}/" && \
        echo "Backup created at ${backupDir}" && \
        ls -la "${backupDir}"
    `;

    console.log(`Executing backup...`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Command completed with code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
