const { Client } = require('ssh2');

const conn = new Client();

const backupDir = '/opt/nuvio-deployment/backup_2026-01-26T14-27-21';
const targetDir = '/root/linux-deployment';
const containerName = 'nuvio-streams-app';

const files = [
    { src: 'addon.js', dst: 'addon.js' },
    { src: 'providers/netmirror.js', dst: 'providers/netmirror.js' },
    { src: 'server.js', dst: 'server.js' }
];

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    let cmd = '';
    files.forEach(f => {
        // Copy on host
        cmd += `cp ${backupDir}/${f.src} ${targetDir}/${f.dst} && `;
        // Copy to container
        cmd += `docker cp ${backupDir}/${f.src} ${containerName}:/app/${f.dst} && `;
    });

    cmd += `docker restart ${containerName}`;

    console.log('Running revert command...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('✅ Revert complete and container restarted');
            conn.end();
        });
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
